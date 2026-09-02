from datetime import date
import secrets
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.database import (
    Base,
    SessionLocal,
    engine
)

from app.models.user import User
from app.models.document import Document
from app.models.notification import Notification
from app.models.admin_document import AdminDocument
from app.models.storage_request import StorageRequest

from app.core.config import settings
from app.core.security import hash_password
from app.services.storage_service import create_employee_directory

from app.routes import (
    auth,
    employees,
    documents,
    admin,
    notifications,
    admin_documents,
    storage,
)


app = FastAPI(
    title="Employee Document Management System",

    description=(
        "Enterprise Employee "
        "Document Management System API"
    ),

    version="1.0.0"
)


# ==================================================
# CORS
# ==================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=settings.CORS_ORIGINS,

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)


# ==================================================
# DATABASE
# ==================================================

Base.metadata.create_all(
    bind=engine
)

# --------------------------------------------------
# Lightweight schema migration for existing installs
# --------------------------------------------------

from sqlalchemy import text

with engine.begin() as connection:
    connection.execute(text("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS storage_limit_bytes BIGINT NOT NULL DEFAULT 2147483648
    """))

    connection.execute(text("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS storage_limit_gb NUMERIC(10,2) NOT NULL DEFAULT 2
    """))

    connection.execute(text("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN NOT NULL DEFAULT FALSE
    """))

    connection.execute(text("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP NULL
    """))

    # Existing installations may already have a storage_requests table
    # created by an earlier version of the application.  CREATE TABLE IF
    # NOT EXISTS does not add columns to an existing table, so explicitly
    # migrate the new column as well.
    connection.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS storage_requests (
                id SERIAL PRIMARY KEY,
                employee_id INTEGER NOT NULL
                    REFERENCES users(id)
                    ON DELETE CASCADE,
                requested_gb DOUBLE PRECISION NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                admin_note VARCHAR(500),
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                decided_at TIMESTAMP NULL
            )
            """
        )
    )

    connection.execute(text("""
        ALTER TABLE storage_requests
        ADD COLUMN IF NOT EXISTS requested_gb DOUBLE PRECISION NOT NULL DEFAULT 0
    """))

    connection.execute(text("""
        ALTER TABLE storage_requests
        ADD COLUMN IF NOT EXISTS decided_at TIMESTAMP NULL
    """))

    connection.execute(text("""
        ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'pending'
    """))

    connection.execute(text("""
        ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT
    """))

    connection.execute(text("""
        ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS is_archive BOOLEAN NOT NULL DEFAULT FALSE
    """))

    connection.execute(text("""
        ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS extracted BOOLEAN NOT NULL DEFAULT FALSE
    """))

    connection.execute(text("""
        ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS parent_document_id INTEGER NULL
        REFERENCES documents(id) ON DELETE CASCADE
    """))

    connection.execute(text("""
        ALTER TABLE documents
        ALTER COLUMN file_type TYPE VARCHAR(255)
    """))

    connection.execute(text("""
        ALTER TABLE admin_documents
        ALTER COLUMN file_type TYPE VARCHAR(255)
    """))

    connection.execute(text("""
        ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS share_token VARCHAR(128) NULL
    """))

    connection.execute(text("""
        CREATE UNIQUE INDEX IF NOT EXISTS ix_documents_share_token
        ON documents(share_token)
    """))

    connection.execute(text("""
        ALTER TABLE admin_documents
        ADD COLUMN IF NOT EXISTS is_archive BOOLEAN NOT NULL DEFAULT FALSE
    """))

    connection.execute(text("""
        ALTER TABLE admin_documents
        ADD COLUMN IF NOT EXISTS extracted BOOLEAN NOT NULL DEFAULT FALSE
    """))

    connection.execute(text("""
        ALTER TABLE admin_documents
        ADD COLUMN IF NOT EXISTS parent_document_id INTEGER NULL
        REFERENCES admin_documents(id) ON DELETE CASCADE
    """))

    connection.execute(text("""
        ALTER TABLE admin_documents
        ADD COLUMN IF NOT EXISTS storage_directory VARCHAR(100) NULL
    """))

    connection.execute(text("""
        ALTER TABLE admin_documents
        ADD COLUMN IF NOT EXISTS share_token VARCHAR(128) NULL
    """))

    connection.execute(text("""
        CREATE UNIQUE INDEX IF NOT EXISTS ix_admin_documents_share_token
        ON admin_documents(share_token)
    """))

    # Backfill archive flags for ZIPs uploaded by older versions.
    # Older admin uploads could be stored correctly but have is_archive=false,
    # which hid the Extract action in the UI.
    connection.execute(text("""
        UPDATE documents
        SET is_archive = TRUE
        WHERE is_archive = FALSE
          AND LOWER(document_name) LIKE '%.zip'
    """))

    connection.execute(text("""
        UPDATE admin_documents
        SET is_archive = TRUE
        WHERE is_archive = FALSE
          AND LOWER(document_name) LIKE '%.zip'
    """))


    # Older versions used requested_limit/current_limit/reason/processed_at.
    # Keep those columns untouched for compatibility; the current application
    # uses requested_gb/status/admin_note/created_at/decided_at.
    connection.execute(
        text(
            """
            ALTER TABLE storage_requests
            ALTER COLUMN requested_gb SET DEFAULT 0
            """
        )
    )

    connection.execute(
        text(
            """
            UPDATE users
            SET storage_limit_bytes = 0
            WHERE role = 'readonlyemployee'
            """
        )
    )

    connection.execute(
        text(
            """
            UPDATE users
            SET storage_limit_bytes = 2147483648
            WHERE role = 'employee'
              AND (
                  storage_limit_bytes IS NULL
                  OR storage_limit_bytes <= 0
              )
            """
        )
    )


# --------------------------------------------------
# Backfill public share tokens for existing documents.
# --------------------------------------------------

db_migration = SessionLocal()

try:
    for document in db_migration.query(Document).filter(
        Document.share_token.is_(None)
    ).all():
        document.share_token = secrets.token_urlsafe(32)

    for document in db_migration.query(AdminDocument).filter(
        AdminDocument.share_token.is_(None)
    ).all():
        document.share_token = secrets.token_urlsafe(32)

    db_migration.commit()

    with engine.begin() as connection:
        connection.execute(text("""
            ALTER TABLE documents
            ALTER COLUMN share_token SET NOT NULL
        """))
        connection.execute(text("""
            ALTER TABLE admin_documents
            ALTER COLUMN share_token SET NOT NULL
        """))
except Exception:
    db_migration.rollback()
    raise
finally:
    db_migration.close()


# ==================================================
# STORAGE
# ==================================================

if settings.STORAGE_PROVIDER != "supabase":
    Path(settings.STORAGE_PATH).mkdir(
        parents=True,
        exist_ok=True
    )


# ==================================================
# CREATE DEFAULT ADMIN
# ==================================================

def create_default_admin():

    if not settings.ADMIN_EMAIL:
        return

    db = SessionLocal()

    try:

        existing_admin = (
            db.query(User)
            .filter(
                User.email ==
                settings.ADMIN_EMAIL.lower()
            )
            .first()
        )

        if existing_admin:
            create_employee_directory(existing_admin.directory_name)
            return

        admin_user = User(

            employee_id=
                "ADMIN001",

            full_name=
                settings.ADMIN_NAME,

            email=
                settings.ADMIN_EMAIL.lower(),

            password_hash=
                hash_password(
                    settings.ADMIN_PASSWORD
                ),

            mobile_number=
                "0000000000",

            department=
                "Administration",

            designation=
                "System Administrator",

            joining_date=
                date(2026, 1, 1),

            aadhaar_number=
                "N/A",

            pan_number=
                "N/A",

            address=
                "Organization",

            emergency_contact=
                "N/A",

            directory_name=
                "admin",

            role=
                "admin",

            status=
                "active",

            is_active=
                True,

            storage_limit_bytes=
                0,

            storage_limit_gb=
                0,

            terms_accepted=
                True,
        )

        db.add(admin_user)

        db.commit()

        create_employee_directory(
            admin_user.directory_name
        )

        print(
            "Default admin created."
        )

    except Exception as error:

        db.rollback()

        print(
            "Admin creation error:",
            error
        )

    finally:

        db.close()


create_default_admin()


# ==================================================
# ROUTES
# ==================================================

app.include_router(
    auth.router
)

app.include_router(
    employees.router
)

app.include_router(
    documents.router
)

app.include_router(
    admin.router
)

app.include_router(
    notifications.router
)

app.include_router(
    admin_documents.router
)

app.include_router(
    storage.router
)


# ==================================================
# ROOT
# ==================================================

@app.get("/")
def root():

    return {

        "message":
            "Employee Document Management System API",

        "status":
            "running",

        "version":
            "1.0.0"
    }


# ==================================================
# HEALTH
# ==================================================

@app.get("/health")
def health():
    # Render uses this endpoint to verify that the API and database
    # are reachable. Supabase Storage is checked only when a storage
    # operation is performed because the service-role key must remain
    # server-side.
    from sqlalchemy import text

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "healthy"}
    except Exception:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=503,
            detail="Database is unavailable.",
        )