import io
import mimetypes
import os
import re
import shutil
import tempfile
import uuid
import time
import zipfile
from pathlib import Path, PurePosixPath

from fastapi import UploadFile

from app.core.config import settings


_SUPABASE_CLIENT = None


def _supabase_client():
    """Return one reusable Supabase client for faster repeated storage calls."""
    global _SUPABASE_CLIENT

    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("Supabase storage is not configured.")

    if _SUPABASE_CLIENT is None:
        from supabase import create_client

        _SUPABASE_CLIENT = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY,
        )

    return _SUPABASE_CLIENT


def validate_directory_name(directory_name: str):
    if not re.fullmatch(r"^[A-Za-z0-9_]+$", directory_name):
        raise ValueError(
            "Directory name can contain only letters, numbers and underscore."
        )


def _safe_relative_path(stored_name: str) -> Path:
    normalized = str(stored_name).replace("\\", "/")
    relative = PurePosixPath(normalized)

    if relative.is_absolute():
        raise ValueError("Invalid stored file path.")

    if any(part in {"", ".", ".."} for part in relative.parts):
        raise ValueError("Invalid stored file path.")

    return Path(*relative.parts)


def _cloud_path(directory_name: str, stored_name: str) -> str:
    validate_directory_name(directory_name)
    relative = _safe_relative_path(stored_name)
    return f"{directory_name}/{relative.as_posix()}"


def _storage_retry_count() -> int:
    return max(1, int(getattr(settings, "STORAGE_RETRY_COUNT", 3)))


def _storage_retry_delay() -> float:
    return max(0.1, float(getattr(settings, "STORAGE_RETRY_DELAY_SECONDS", 0.8)))


def _upload_supabase(path: str, data: bytes, content_type: str):
    """Create or replace a Supabase Storage object safely.

    IMPORTANT: storage3/httpx versions used by supabase-py can treat unknown
    option keys as HTTP headers. Passing ``upsert`` as a Python bool can
    therefore cause: ``Header value must be str or bytes, not <class 'bool'>``.
    Use the Storage HTTP header explicitly as a string.
    """
    client = _supabase_client()
    bucket = client.storage.from_(settings.SUPABASE_BUCKET)

    # x-upsert is the Storage REST header and MUST be a string.
    options = {
        "content-type": str(content_type or "application/octet-stream"),
        "x-upsert": "true",
    }

    last_error = None

    for attempt in range(_storage_retry_count()):
        try:
            bucket.upload(path, data, options)
            return
        except Exception as upload_error:
            last_error = upload_error
            message = str(upload_error).lower()

            # If the object already exists, explicitly replace it. This also
            # makes extraction safe after an interrupted/retried request.
            duplicate = (
                "409" in message
                or "duplicate" in message
                or "already exists" in message
            )

            if duplicate:
                try:
                    bucket.update(path, data, options)
                    return
                except Exception as update_error:
                    last_error = update_error

                    # Some storage3 versions expose update differently.
                    # Remove + upload is the final deterministic fallback.
                    try:
                        bucket.remove([path])
                    except Exception:
                        pass

                    try:
                        bucket.upload(path, data, options)
                        return
                    except Exception as replacement_error:
                        last_error = replacement_error

            if attempt + 1 < _storage_retry_count():
                time.sleep(_storage_retry_delay() * (attempt + 1))

    raise last_error

def _delete_supabase(path: str):
    client = _supabase_client()
    client.storage.from_(settings.SUPABASE_BUCKET).remove([path])


def _download_supabase(path: str) -> Path:
    last_error = None
    data = None

    for attempt in range(_storage_retry_count()):
        try:
            client = _supabase_client()
            data = client.storage.from_(settings.SUPABASE_BUCKET).download(path)
            break
        except Exception as error:
            last_error = error
            if attempt + 1 < _storage_retry_count():
                time.sleep(_storage_retry_delay() * (attempt + 1))

    if data is None:
        raise last_error

    temp = tempfile.NamedTemporaryFile(
        delete=False,
        suffix=Path(path).suffix,
    )
    temp.write(data)
    temp.close()

    return Path(temp.name)


def get_employee_directory(directory_name: str) -> Path:
    validate_directory_name(directory_name)

    base_path = Path(settings.STORAGE_PATH)
    return base_path / directory_name


def create_employee_directory(directory_name: str):
    """
    Ensure the employee's top-level storage directory exists.

    Local storage uses a real directory. Supabase Storage represents folders
    through object-key prefixes, so a small placeholder object keeps the
    employee directory visible even before the first document is uploaded.
    """
    employee_path = get_employee_directory(directory_name)

    if settings.STORAGE_PROVIDER == "supabase":
        client = _supabase_client()
        client.storage.from_(settings.SUPABASE_BUCKET).upload(
            f"{directory_name}/.keep",
            b"EDMS directory placeholder",
            {
                "content-type": "text/plain",
                "x-upsert": "true",
            },
        )
        return employee_path

    employee_path.mkdir(parents=True, exist_ok=True)
    return employee_path


def get_file_path(directory_name: str, stored_name: str):
    if settings.STORAGE_PROVIDER == "supabase":
        return _download_supabase(
            _cloud_path(directory_name, stored_name)
        )

    employee_path = get_employee_directory(directory_name)
    relative_path = _safe_relative_path(stored_name)

    file_path = (employee_path / relative_path).resolve()

    try:
        file_path.relative_to(employee_path.resolve())
    except ValueError:
        raise ValueError("Invalid stored file path.")

    return file_path


def _extension_for_name(original_name: str) -> str:
    extension = Path(original_name).suffix.lower()
    if extension and len(extension) <= 32:
        return extension
    return ""


def archive_folder_name(original_name: str) -> str:
    """
    Return the stable folder name used for an extracted ZIP.
    """
    return (
        re.sub(
            r"[^A-Za-z0-9_-]+",
            "_",
            Path(original_name).stem,
        ).strip("_")
        or "archive"
    )


def save_file(directory_name: str, upload_file: UploadFile):
    """
    Save any file type. There is intentionally no extension whitelist.
    File size is still limited by UPLOAD_MAX_SIZE.
    """
    original_name = upload_file.filename or "document"
    extension = _extension_for_name(original_name)
    stored_name = f"{uuid.uuid4().hex}{extension}"
    content_type = (
        upload_file.content_type
        or mimetypes.guess_type(original_name)[0]
        or "application/octet-stream"
    )

    if settings.STORAGE_PROVIDER == "supabase":
        data = upload_file.file.read()

        if len(data) > settings.UPLOAD_MAX_SIZE:
            raise ValueError(
                "File size exceeds the maximum allowed size."
            )

        _upload_supabase(
            _cloud_path(directory_name, stored_name),
            data,
            content_type,
        )

        return stored_name, len(data)

    employee_path = create_employee_directory(directory_name)
    file_path = employee_path / stored_name

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)

    file_size = file_path.stat().st_size

    if file_size > settings.UPLOAD_MAX_SIZE:
        file_path.unlink(missing_ok=True)
        raise ValueError(
            "File size exceeds the maximum allowed size."
        )

    return stored_name, file_size


def _is_zip_symlink(info: zipfile.ZipInfo) -> bool:
    unix_mode = (info.external_attr >> 16) & 0o170000
    return unix_mode == 0o120000


def _zip_relative_path(filename: str) -> Path:
    if not filename:
        raise ValueError("ZIP contains an invalid empty path.")

    if (
        filename.startswith(("/", "\\"))
        or "\\" in filename
        or re.match(r"^[A-Za-z]:", filename)
    ):
        raise ValueError("ZIP contains an unsafe path.")

    name = filename.strip("/")
    relative = PurePosixPath(name)

    if relative.is_absolute() or any(
        part in {"", ".", ".."} for part in relative.parts
    ):
        raise ValueError("ZIP contains an unsafe path.")

    return Path(*relative.parts)


def _is_ignored_zip_member(relative_path: Path) -> bool:
    parts_lower = {part.lower() for part in relative_path.parts}
    return ".ds_store" in parts_lower or "__macosx" in parts_lower


def _validate_zip(archive: zipfile.ZipFile):
    infos = archive.infolist()

    max_files = int(getattr(settings, "ZIP_MAX_FILES", 1000))
    max_uncompressed = int(
        getattr(
            settings,
            "ZIP_MAX_UNCOMPRESSED_SIZE",
            2 * 1024 ** 3,
        )
    )

    if len(infos) > max_files:
        raise ValueError(
            f"ZIP contains too many files. Maximum allowed is {max_files}."
        )

    total_uncompressed = 0
    valid_files = []
    seen_paths = set()

    for info in infos:
        relative_path = _zip_relative_path(info.filename)

        if _is_ignored_zip_member(relative_path) or info.is_dir():
            continue

        if _is_zip_symlink(info):
            raise ValueError(
                "ZIP files containing symbolic links are not allowed."
            )

        key = relative_path.as_posix().lower()

        if key in seen_paths:
            raise ValueError("ZIP contains duplicate file paths.")

        seen_paths.add(key)

        total_uncompressed += int(info.file_size or 0)

        if total_uncompressed > max_uncompressed:
            raise ValueError(
                "ZIP uncompressed content exceeds the maximum allowed size."
            )

        valid_files.append((info, relative_path))

    return valid_files


def save_upload_files(directory_name: str, upload_file: UploadFile):
    """Upload one file of any type, without an extension whitelist.

    ZIP archives are detected from their actual contents when possible, so a
    ZIP renamed with another extension can still be extracted later. Upload
    validation happens before the Supabase object is created to avoid a
    second network download and make uploads noticeably faster.
    """
    original_name = upload_file.filename or "document"
    content_type = (
        upload_file.content_type
        or mimetypes.guess_type(original_name)[0]
        or "application/octet-stream"
    )

    if settings.STORAGE_PROVIDER == "supabase":
        data = upload_file.file.read()
        if len(data) > settings.UPLOAD_MAX_SIZE:
            raise ValueError("File size exceeds the maximum allowed size.")

        is_archive = False
        if zipfile.is_zipfile(io.BytesIO(data)):
            is_archive = True
            try:
                with zipfile.ZipFile(io.BytesIO(data), "r") as archive:
                    _validate_zip(archive)
            except zipfile.BadZipFile:
                raise ValueError("The uploaded ZIP file is invalid or corrupted.")

        extension = _extension_for_name(original_name)
        stored_name = f"{uuid.uuid4().hex}{extension}"
        _upload_supabase(
            _cloud_path(directory_name, stored_name),
            data,
            content_type,
        )
        file_size = len(data)
    else:
        stored_name, file_size = save_file(directory_name, upload_file)
        archive_path = get_employee_directory(directory_name) / stored_name
        is_archive = zipfile.is_zipfile(archive_path)

        if is_archive:
            try:
                with zipfile.ZipFile(archive_path, "r") as archive:
                    _validate_zip(archive)
            except zipfile.BadZipFile:
                delete_file(directory_name, stored_name)
                raise ValueError("The uploaded ZIP file is invalid or corrupted.")
            except Exception:
                delete_file(directory_name, stored_name)
                raise

    return [
        {
            "stored_name": stored_name,
            "file_size": file_size,
            "document_name": original_name,
            "file_type": content_type,
            "is_archive": is_archive,
            "extracted": False,
            "parent_document_id": None,
        }
    ]


def extract_zip_file(
    directory_name: str,
    stored_name: str,
    original_name: str,
    target_directory_name: str | None = None,
):
    """
    Extract a previously uploaded ZIP only when explicitly requested.

    A real directory is created for local storage. In Supabase Storage,
    the same folder structure is represented by object-key prefixes.
    """
    # The ZIP is read from directory_name. Extracted files can optionally
    # be written to a different directory (used when an employee extracts
    # an administrator-shared ZIP into their own directory).
    target_directory_name = target_directory_name or directory_name

    zip_path = get_file_path(directory_name, stored_name)
    temporary_download = settings.STORAGE_PROVIDER == "supabase"

    try:
        try:
            archive = zipfile.ZipFile(zip_path, "r")
        except zipfile.BadZipFile:
            raise ValueError(
                "The stored ZIP file is invalid or corrupted."
            )

        with archive:
            valid_files = _validate_zip(archive)

            if not valid_files:
                raise ValueError(
                    "ZIP does not contain any files."
                )

            # Verify every member can actually be read before creating any
            # Supabase objects. This gives a clean error for damaged,
            # encrypted, or unsupported ZIP archives instead of leaving a
            # half-extracted folder behind.
            try:
                bad_member = archive.testzip()
            except Exception as error:
                raise ValueError(
                    f"ZIP cannot be read by the server: {error}"
                ) from error

            if bad_member:
                raise ValueError(
                    f"ZIP contains a corrupted file: {bad_member}"
                )

            # The extracted folder is intentionally named after the ZIP
            # file (without ".zip"), e.g. documents.zip -> documents/.
            # Directory names are kept predictable so public URLs can also
            # remain clean, e.g. /rahul_123/documents/index.html.
            folder_name = archive_folder_name(
                original_name
            )

            # Many ZIP tools wrap the entire project in a top-level folder
            # whose name is the same as the ZIP. Because EDMS already creates
            # that folder as the extraction root, strip only that redundant
            # wrapper so we get `archive/index.html`, not
            # `archive/archive/index.html`. Other nested folders are kept.
            top_levels = {
                relative_path.parts[0]
                for _, relative_path in valid_files
                if relative_path.parts
            }
            strip_redundant_root = (
                len(top_levels) == 1
                and archive_folder_name(next(iter(top_levels))) == folder_name
            )

            extraction_files = []
            for info, relative_path in valid_files:
                if strip_redundant_root and len(relative_path.parts) > 1:
                    relative_path = Path(*relative_path.parts[1:])
                extraction_files.append((info, relative_path))

            # Extraction is idempotent. If a previous request created part
            # of the folder, reuse that folder and replace only the members
            # belonging to this ZIP. This also makes local retries match the
            # Supabase behaviour.
            extraction_root = None
            if settings.STORAGE_PROVIDER != "supabase":
                extraction_root = (
                    get_employee_directory(target_directory_name)
                    / folder_name
                )
                extraction_root.mkdir(
                    parents=True,
                    exist_ok=True,
                )

            saved_files = []
            uploaded_paths = []

            try:
                # Keep extraction deliberately sequential. Supabase Storage
                # is much more reliable with a simple one-file-at-a-time
                # workflow, and this avoids intermittent failures on ZIPs
                # containing many small website assets.
                for info, relative_path in extraction_files:
                    if int(info.file_size or 0) > settings.UPLOAD_MAX_SIZE:
                        raise ValueError(
                            f"Extracted file is too large: {relative_path}"
                        )

                    stored_child = Path(folder_name) / relative_path
                    stored_child_name = stored_child.as_posix()
                    content_type = (
                        mimetypes.guess_type(relative_path.name)[0]
                        or "application/octet-stream"
                    )

                    try:
                        with archive.open(info, "r") as source:
                            if settings.STORAGE_PROVIDER == "supabase":
                                data = source.read()
                                actual_size = len(data)

                                if actual_size != int(info.file_size or 0):
                                    raise ValueError(
                                        "ZIP member could not be read completely."
                                    )

                                cloud_path = _cloud_path(
                                    target_directory_name,
                                    stored_child_name,
                                )
                                _upload_supabase(
                                    cloud_path,
                                    data,
                                    content_type,
                                )
                                uploaded_paths.append(cloud_path)
                            else:
                                target_path = (
                                    extraction_root / relative_path
                                ).resolve()

                                try:
                                    target_path.relative_to(
                                        extraction_root.resolve()
                                    )
                                except ValueError:
                                    raise ValueError(
                                        "ZIP contains an unsafe extraction path."
                                    )

                                target_path.parent.mkdir(
                                    parents=True,
                                    exist_ok=True,
                                )

                                with open(target_path, "wb") as destination:
                                    shutil.copyfileobj(source, destination)

                                actual_size = target_path.stat().st_size
                    except ValueError:
                        raise
                    except Exception as error:
                        # Include the exact member so Render logs immediately
                        # show which website asset caused extraction to fail.
                        raise ValueError(
                            f"Could not extract '{relative_path}': {error}"
                        ) from error

                    saved_files.append(
                        {
                            "stored_name": stored_child_name,
                            "file_size": actual_size,
                            "document_name": (
                                f"{folder_name}/"
                                f"{relative_path.as_posix()}"
                            ),
                            "file_type": content_type,
                            "is_archive": False,
                            "extracted": False,
                            "parent_document_id": None,
                            "folder_name": folder_name,
                        }
                    )

                return saved_files

            except Exception:
                if settings.STORAGE_PROVIDER == "supabase":
                    for cloud_path in uploaded_paths:
                        try:
                            _delete_supabase(cloud_path)
                        except Exception:
                            pass
                else:
                    shutil.rmtree(
                        extraction_root,
                        ignore_errors=True,
                    )
                raise

    finally:
        if temporary_download:
            cleanup_download_file(zip_path)


def cleanup_download_file(file_path: Path):
    if settings.STORAGE_PROVIDER == "supabase":
        try:
            file_path.unlink(missing_ok=True)
        except Exception:
            pass


def delete_file(directory_name: str, stored_name: str):
    if settings.STORAGE_PROVIDER == "supabase":
        _delete_supabase(
            _cloud_path(directory_name, stored_name)
        )
        return

    file_path = get_file_path(
        directory_name,
        stored_name,
    )

    if file_path.exists():
        file_path.unlink()


def delete_files(directory_name: str, stored_names):
    for stored_name in stored_names:
        try:
            delete_file(
                directory_name,
                stored_name,
            )
        except Exception:
            pass
