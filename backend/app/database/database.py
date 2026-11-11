from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings


if not settings.DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is missing. Add the Supabase PostgreSQL connection string "
        "to the Render environment variables."
    )

# SQLAlchemy 2.1 may select the Psycopg 3 dialect for a plain
# postgresql:// URL. This project intentionally installs psycopg2-binary,
# so select its dialect explicitly and avoid a missing 'psycopg' import
# during Render startup. Explicitly configured non-default drivers are kept.
_database_url = make_url(settings.DATABASE_URL)
if (
    _database_url.get_backend_name() in {"postgresql", "postgres"}
    and _database_url.drivername in {"postgresql", "postgres"}
):
    _database_url = _database_url.set(drivername="postgresql+psycopg2")

_connect_args = {}

# Supabase PostgreSQL and pooler connections use TLS. Keep local
# PostgreSQL development connections unchanged.
if _database_url.get_backend_name() == "postgresql":
    _host = (_database_url.host or "").lower()
    if _host not in {"localhost", "127.0.0.1", "::1"}:
        _connect_args["sslmode"] = "require"
        _connect_args["connect_timeout"] = 10

engine = create_engine(
    _database_url,
    pool_pre_ping=True,
    pool_size=3,
    max_overflow=2,
    pool_timeout=30,
    pool_recycle=1800,
    connect_args=_connect_args,
)


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


Base = declarative_base()


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()
