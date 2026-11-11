import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


BASE_DIR = Path(__file__).resolve().parents[2]


class Settings:
    BASE_DIR = BASE_DIR
    DATABASE_URL = os.getenv("DATABASE_URL")

    # Always retain the production EDMS origins even when Render's
    # CORS_ORIGINS variable is configured. Render environment variables
    # commonly contain only one of the www/non-www variants; merging these
    # defaults prevents production uploads from failing at the browser's
    # OPTIONS preflight stage.
    _configured_cors_origins = [
        origin.strip().rstrip("/")
        for origin in os.getenv("CORS_ORIGINS", "").split(",")
        if origin.strip()
    ]
    _default_cors_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://web-a2z.com",
        "https://www.web-a2z.com",
        "https://employee-document-management-system.vercel.app",
    ]
    CORS_ORIGINS = list(dict.fromkeys(
        _configured_cors_origins + _default_cors_origins
    ))
    # Allow the owned production domain and its first-level subdomains
    # (including www), without allowing arbitrary origins.
    CORS_ORIGIN_REGEX = r"^https://([A-Za-z0-9-]+\.)?web-a2z\.com$"

    STORAGE_PROVIDER = os.getenv("STORAGE_PROVIDER", "local").lower()
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "edms-files")

    SECRET_KEY = os.getenv("SECRET_KEY", "change-me")
    JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

    TOKEN_EXPIRE_MINUTES = int(
        os.getenv("TOKEN_EXPIRE_MINUTES", "60")
    )

    STORAGE_PATH = os.getenv(
        "STORAGE_PATH",
        "../storage/employees"
    )

    UPLOAD_MAX_SIZE = int(
        os.getenv("UPLOAD_MAX_SIZE", "524288000")  # 500 MiB for compatible storage providers
    )

    # Supabase Free projects cannot accept a single object larger than 50 MB.
    # Use decimal MB (50,000,000 bytes) to stay safely within the plan limit.
    # This is configurable for projects on plans with a higher configured limit.
    SUPABASE_MAX_FILE_SIZE = int(
        os.getenv("SUPABASE_MAX_FILE_SIZE", "50000000")
    )

    # ZIP safety limits
    ZIP_MAX_FILES = int(
        os.getenv("ZIP_MAX_FILES", "20000")
    )

    ZIP_MAX_UNCOMPRESSED_SIZE = int(
        os.getenv(
            "ZIP_MAX_UNCOMPRESSED_SIZE",
            str(2 * 1024 ** 3)
        )
    )

    STORAGE_RETRY_COUNT = int(
        os.getenv("STORAGE_RETRY_COUNT", "3")
    )

    STORAGE_RETRY_DELAY_SECONDS = float(
        os.getenv("STORAGE_RETRY_DELAY_SECONDS", "0.8")
    )

    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
    ADMIN_NAME = os.getenv(
        "ADMIN_NAME",
        "System Administrator"
    )

    # Optional SMTP configuration for email delivery
    SMTP_HOST = os.getenv("SMTP_HOST")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER = os.getenv("SMTP_USER")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
    EMAILS_FROM = os.getenv("EMAILS_FROM", "noreply@edms.local")
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


settings = Settings()


# Convert storage path into an absolute path
storage_path = Path(settings.STORAGE_PATH)

if not storage_path.is_absolute():
    storage_path = (BASE_DIR / storage_path).resolve()

settings.STORAGE_PATH = str(storage_path)