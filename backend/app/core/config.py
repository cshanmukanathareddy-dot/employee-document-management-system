import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


BASE_DIR = Path(__file__).resolve().parents[2]


class Settings:
    DATABASE_URL = os.getenv("DATABASE_URL")

    CORS_ORIGINS = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,"
            "http://127.0.0.1:5173,"
            "https://web-a2z.com,"
            "https://www.web-a2z.com,"
            "https://employee-document-management-system.vercel.app"
        ).split(",")
        if origin.strip()
    ]

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
        os.getenv("UPLOAD_MAX_SIZE", "104857600")
    )

    # ZIP safety limits
    ZIP_MAX_FILES = int(
        os.getenv("ZIP_MAX_FILES", "1000")
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


settings = Settings()


# Convert storage path into an absolute path
storage_path = Path(settings.STORAGE_PATH)

if not storage_path.is_absolute():
    storage_path = (BASE_DIR / storage_path).resolve()

settings.STORAGE_PATH = str(storage_path)