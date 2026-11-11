import io
import httpx
import mimetypes
import re
import shutil
import tempfile
import time
import uuid
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any, BinaryIO
from urllib.parse import quote

from fastapi import HTTPException, UploadFile

from app.core.config import settings


_SUPABASE_CLIENT = None


class _NonClosingRawStream(io.RawIOBase):
    """Expose a seekable file stream as a BufferedReader without owning it.

    Supabase's Python SDK closes BufferedReader upload objects after each
    request. This adapter lets the SDK/HTTPX stream FastAPI's spooled file in
    bounded chunks while keeping the original UploadFile open for retries and
    request cleanup.
    """

    def __init__(self, source):
        super().__init__()
        self._source = source

    def readable(self):
        return True

    def seekable(self):
        return bool(getattr(self._source, "seekable", lambda: True)())

    def readinto(self, buffer):
        chunk = self._source.read(len(buffer))
        if not chunk:
            return 0
        count = len(chunk)
        buffer[:count] = chunk
        return count

    def seek(self, offset, whence=io.SEEK_SET):
        return self._source.seek(offset, whence)

    def tell(self):
        return self._source.tell()

    def close(self):
        # Do not close the underlying UploadFile/ZIP stream. The caller owns it.
        super().close()


def _sdk_upload_payload(payload):
    """Create an SDK-supported stream wrapper without duplicating the file."""
    if isinstance(payload, (bytes, bytearray, memoryview, str, Path)):
        return payload

    payload.seek(0)
    return io.BufferedReader(
        _NonClosingRawStream(payload),
        buffer_size=1024 * 1024,
    )


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


def storage_upload_http_exception(error: Exception) -> HTTPException:
    """Translate storage-provider failures into safe, useful API errors."""
    error_text = str(error).lower()
    response = getattr(error, "response", None)
    status_code = getattr(error, "status_code", None) or getattr(response, "status_code", None)

    if status_code == 413 or any(token in error_text for token in (
        "entitytoolarge",
        "payload too large",
        "maximum allowed size",
        "max file size",
        "file size limit",
        "413",
    )):
        return HTTPException(
            status_code=413,
            detail=(
                "Supabase Storage rejected this file because it exceeds the "
                "configured global or edms-files bucket upload limit. On "
                "Supabase Free, the maximum is 50 MB per file."
            ),
        )

    if any(token in error_text for token in (
        "timeout", "timed out", "connecterror", "connection reset", "temporarily unavailable",
    )):
        return HTTPException(
            status_code=503,
            detail=(
                "Supabase Storage could not be reached. Please retry the upload. "
                "If this continues, check the Render service logs and Supabase status."
            ),
        )

    if "not configured" in error_text:
        return HTTPException(
            status_code=503,
            detail=(
                "Supabase Storage is not configured correctly. Check SUPABASE_URL, "
                "SUPABASE_SERVICE_ROLE_KEY and SUPABASE_BUCKET in the Render environment."
            ),
        )

    return HTTPException(
        status_code=502,
        detail=(
            "The document upload could not be completed because the storage or "
            "database service returned an error. Check the Render logs for the "
            "underlying error and verify the edms-files bucket, upload limits, "
            "and available storage quota."
        ),
    )


def _supabase_cache_path(path: str) -> Path:
    cache_base = Path(settings.STORAGE_PATH) / ".cache"
    normalized = str(path).replace("\\", "/").strip("/")
    return cache_base / Path(normalized)


def _payload_size(payload) -> int:
    if isinstance(payload, (bytes, bytearray, memoryview)):
        return len(payload)
    if isinstance(payload, (str, Path)):
        return Path(payload).stat().st_size

    payload.seek(0, io.SEEK_END)
    size = payload.tell()
    payload.seek(0)
    return size


def _rewind_payload(payload):
    if not isinstance(payload, (bytes, bytearray, memoryview, str, Path)):
        payload.seek(0)


def _cache_small_upload(path: str, payload, payload_size: int):
    # Keep the fast local cache for small everyday files only. Large files
    # would duplicate storage on a small Render instance and waste disk/RAM.
    if payload_size > 2 * 1024 * 1024:
        return

    try:
        if isinstance(payload, (bytes, bytearray, memoryview)):
            data = bytes(payload)
        elif isinstance(payload, (str, Path)):
            with open(payload, "rb") as source:
                data = source.read(payload_size + 1)
        else:
            payload.seek(0)
            data = payload.read(payload_size + 1)
            payload.seek(0)

        if len(data) != payload_size:
            return

        cache_file = _supabase_cache_path(path)
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        with open(cache_file, "wb") as cache_stream:
            cache_stream.write(data)
    except Exception:
        # Caching is an optimization only; it must never fail an upload.
        pass


def _upload_supabase(path: str, data, content_type: str, payload_size: int | None = None):
    """Upload through Supabase using bounded-memory multipart streaming.

    File-like inputs are wrapped as an SDK-supported BufferedReader adapter;
    no second temporary copy is made. The Supabase SDK/HTTPX multipart layer
    reads the source incrementally, and the adapter prevents the SDK from
    closing FastAPI's underlying UploadFile stream. ZIP extraction passes
    staged member paths, also streamed by the SDK.
    """
    client = _supabase_client()
    bucket = client.storage.from_(settings.SUPABASE_BUCKET)

    size = payload_size if payload_size is not None else _payload_size(data)
    actual_size = _payload_size(data)
    if actual_size != size:
        raise ValueError("The uploaded file could not be read completely.")

    options: Any = {
        "content-type": str(content_type or "application/octet-stream"),
        "x-upsert": "true",
    }
    last_error: Exception | None = None

    def upload_once(method: str):
        _rewind_payload(data)
        sdk_payload = _sdk_upload_payload(data)
        if method == "update":
            return bucket.update(path, sdk_payload, options)
        return bucket.upload(path, sdk_payload, options)

    for attempt in range(_storage_retry_count()):
        try:
            upload_once("upload")
            _cache_small_upload(path, data, size)
            return
        except Exception as upload_error:
            last_error = upload_error
            message = str(upload_error).lower()
            duplicate = (
                "409" in message
                or "duplicate" in message
                or "already exists" in message
            )

            if duplicate:
                try:
                    upload_once("update")
                    _cache_small_upload(path, data, size)
                    return
                except Exception as update_error:
                    last_error = update_error
                    try:
                        bucket.remove([path])
                    except Exception:
                        pass

                    try:
                        upload_once("upload")
                        _cache_small_upload(path, data, size)
                        return
                    except Exception as replacement_error:
                        last_error = replacement_error

            if attempt + 1 < _storage_retry_count():
                time.sleep(_storage_retry_delay() * (attempt + 1))

    if last_error is not None:
        raise last_error
    raise RuntimeError("Upload to Supabase Storage failed.")


def _delete_supabase(path: str):
    client = _supabase_client()
    client.storage.from_(settings.SUPABASE_BUCKET).remove([path])
    try:
        cache_file = _supabase_cache_path(path)
        if cache_file.exists():
            cache_file.unlink(missing_ok=True)
    except Exception:
        pass


def _download_supabase(path: str) -> Path:
    """Stream a private Supabase object to disk in bounded-size chunks."""
    cache_file = _supabase_cache_path(path)
    if cache_file.exists() and cache_file.stat().st_size > 0:
        return cache_file

    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("Supabase storage is not configured.")

    encoded_bucket = quote(settings.SUPABASE_BUCKET, safe="")
    encoded_path = "/".join(quote(part, safe="") for part in path.split("/"))
    download_url = (
        f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/"
        f"authenticated/{encoded_bucket}/{encoded_path}"
    )
    headers = {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
    }

    cache_file.parent.mkdir(parents=True, exist_ok=True)
    temp_file = cache_file.with_name(
        f"{cache_file.name}.tmp.{uuid.uuid4().hex}"
    )
    last_error: Exception | None = None

    for attempt in range(_storage_retry_count()):
        try:
            timeout = httpx.Timeout(
                connect=15.0,
                read=120.0,
                write=30.0,
                pool=15.0,
            )
            with httpx.stream(
                "GET",
                download_url,
                headers=headers,
                timeout=timeout,
                follow_redirects=True,
            ) as response:
                response.raise_for_status()
                with open(temp_file, "wb") as destination:
                    for chunk in response.iter_bytes(chunk_size=1024 * 1024):
                        if chunk:
                            destination.write(chunk)

            if temp_file.stat().st_size <= 0:
                raise RuntimeError("Supabase returned an empty file.")

            temp_file.replace(cache_file)
            return cache_file
        except Exception as error:
            last_error = error
            temp_file.unlink(missing_ok=True)
            if attempt + 1 < _storage_retry_count():
                time.sleep(_storage_retry_delay() * (attempt + 1))

    if last_error is not None:
        raise last_error
    raise RuntimeError("Download from Supabase Storage failed.")


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
        placeholder_options: Any = {
            "content-type": "text/plain",
            "x-upsert": "true",
        }
        client.storage.from_(settings.SUPABASE_BUCKET).upload(
            f"{directory_name}/.keep",
            b"EDMS directory placeholder",
            placeholder_options,
        )
        return employee_path

    employee_path.mkdir(parents=True, exist_ok=True)
    return employee_path


def delete_employee_directory(directory_name: str):
    """
    Completely and permanently delete an employee's storage directory and all files inside it.
    Works for both local filesystem and Supabase cloud storage.
    """
    validate_directory_name(directory_name)
    employee_path = get_employee_directory(directory_name)

    if settings.STORAGE_PROVIDER == "supabase":
        try:
            client = _supabase_client()
            objects = client.storage.from_(settings.SUPABASE_BUCKET).list(directory_name)
            if objects:
                paths = [
                    f"{directory_name}/{obj['name']}"
                    for obj in objects
                    if isinstance(obj, dict) and "name" in obj
                ]
                if paths:
                    client.storage.from_(settings.SUPABASE_BUCKET).remove(paths)
        except Exception:
            pass
        return

    if employee_path.exists() and employee_path.is_dir():
        shutil.rmtree(employee_path, ignore_errors=True)


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


def _upload_stream_size(upload_file: UploadFile) -> int:
    """Get upload size without reading the complete file into memory."""
    file_obj = upload_file.file
    current_position = file_obj.tell()
    file_obj.seek(0, io.SEEK_END)
    size = file_obj.tell()
    file_obj.seek(current_position)
    return size


def save_file(directory_name: str, upload_file: UploadFile):
    """Save any file type to local storage using a bounded-memory copy."""
    original_name = upload_file.filename or "document"
    extension = _extension_for_name(original_name)
    stored_name = f"{uuid.uuid4().hex}{extension}"
    file_size = _upload_stream_size(upload_file)

    if file_size > settings.UPLOAD_MAX_SIZE:
        raise ValueError("File size exceeds the maximum allowed size.")

    employee_path = create_employee_directory(directory_name)
    file_path = employee_path / stored_name
    upload_file.file.seek(0)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(upload_file.file, buffer, length=1024 * 1024)

        actual_size = file_path.stat().st_size
        if actual_size != file_size:
            raise ValueError("The uploaded file could not be read completely.")
        return stored_name, actual_size
    except Exception:
        file_path.unlink(missing_ok=True)
        raise


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

    max_files = int(getattr(settings, "ZIP_MAX_FILES", 20000))
    max_uncompressed = int(
        getattr(
            settings,
            "ZIP_MAX_UNCOMPRESSED_SIZE",
            2 * 1024 ** 3,
        )
    )

    total_uncompressed = 0
    valid_files = []
    seen_paths = set()

    for info in infos:
        relative_path = _zip_relative_path(info.filename)

        if _is_ignored_zip_member(relative_path) or info.is_dir():
            continue

        if len(valid_files) >= max_files:
            raise ValueError(
                f"ZIP contains too many files. Maximum allowed is {max_files}."
            )

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


def _open_zip_for_extraction(zip_path: Path, password: str | None = None):
    """Open plain ZIPs with stdlib and encrypted ZIPs with AES-capable pyzipper.

    Python's built-in zipfile supports traditional ZipCrypto but does not
    support WinZip AES (method 99). The archive metadata can still be safely
    inspected with zipfile; use pyzipper only for encrypted extraction so
    ordinary ZIP uploads keep the existing lightweight code path.
    """
    metadata_archive = None
    try:
        metadata_archive = zipfile.ZipFile(str(zip_path), "r")
        valid_files = _validate_zip(metadata_archive)
    except zipfile.BadZipFile:
        if metadata_archive is not None:
            metadata_archive.close()
        raise ValueError("The stored ZIP file is invalid or corrupted.")
    except Exception:
        if metadata_archive is not None:
            metadata_archive.close()
        raise

    encrypted = any(info.flag_bits & 0x1 for info, _ in valid_files)
    if not encrypted:
        # Keep this already-open archive and its validated metadata. Plain ZIP
        # extraction therefore retains the original single-open fast path.
        return metadata_archive, valid_files

    metadata_archive.close()

    if password is None or password == "":
        raise ValueError(
            "This ZIP is password-protected. Enter its password to extract it."
        )

    try:
        import pyzipper
    except ImportError as error:
        raise ValueError(
            "Password-protected ZIP support is not installed on this server. "
            "Please deploy the updated backend dependencies."
        ) from error

    try:
        archive = pyzipper.AESZipFile(str(zip_path), "r")
        archive.setpassword(password.encode("utf-8"))
        valid_files = _validate_zip(archive)
        return archive, valid_files
    except ValueError:
        try:
            archive.close()
        except Exception:
            pass
        raise
    except Exception as error:
        try:
            archive.close()
        except Exception:
            pass
        raise ValueError(
            "Unable to open the encrypted ZIP. Check that it is a valid ZIP archive."
        ) from error


def save_upload_files(directory_name: str, upload_file: UploadFile):
    """Validate and store one arbitrary file without buffering it in RAM.

    ZIP metadata is inspected while the upload is still in FastAPI's spooled
    temporary file. The original ZIP remains intact until the user explicitly
    requests extraction.
    """
    original_name = upload_file.filename or "document"
    content_type = (
        upload_file.content_type
        or mimetypes.guess_type(original_name)[0]
        or "application/octet-stream"
    )
    file_size = _upload_stream_size(upload_file)

    effective_max_size = settings.UPLOAD_MAX_SIZE
    if settings.STORAGE_PROVIDER == "supabase":
        effective_max_size = min(
            effective_max_size,
            int(getattr(settings, "SUPABASE_MAX_FILE_SIZE", 50_000_000)),
        )

    if file_size > effective_max_size:
        if settings.STORAGE_PROVIDER == "supabase":
            limit_mb = effective_max_size / 1_000_000
            actual_mb = file_size / 1_000_000
            raise ValueError(
                f"This file is {actual_mb:.1f} MB, but the current Supabase "
                f"upload limit is {limit_mb:.0f} MB per file. Supabase Free "
                "supports a maximum of 50 MB per file. Please choose a smaller "
                "file or use a storage plan with a higher configured limit."
            )
        raise ValueError("File size exceeds the maximum allowed size.")

    file_obj = upload_file.file
    file_obj.seek(0)
    is_archive = zipfile.is_zipfile(file_obj)
    file_obj.seek(0)

    if is_archive:
        try:
            with zipfile.ZipFile(file_obj, "r") as archive:
                _validate_zip(archive)
        except zipfile.BadZipFile:
            raise ValueError("The uploaded ZIP file is invalid or corrupted.")
        finally:
            file_obj.seek(0)

    extension = _extension_for_name(original_name)
    stored_name = f"{uuid.uuid4().hex}{extension}"

    if settings.STORAGE_PROVIDER == "supabase":
        _upload_supabase(
            _cloud_path(directory_name, stored_name),
            file_obj,
            content_type,
            payload_size=file_size,
        )
    else:
        stored_name, saved_size = save_file(directory_name, upload_file)
        if saved_size != file_size:
            delete_file(directory_name, stored_name)
            raise ValueError("The uploaded file could not be read completely.")

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
    password: str | None = None,
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
            archive, valid_files = _open_zip_for_extraction(
                zip_path,
                password=password,
            )
        except ValueError:
            raise
        except Exception as error:
            raise ValueError("The stored ZIP file is invalid or corrupted.") from error

        with archive:
            if not valid_files:
                raise ValueError(
                    "ZIP does not contain any files."
                )

            # ZIP CRC/authentication checks run while each member is streamed
            # out below. Avoid archive.testzip() because it decompresses every
            # file once before extraction, doubling work for large archives.

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
            extraction_root: Path | None = None
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
                                # Stage each member to disk so the Supabase SDK
                                # can stream it from a real path. Reading to EOF
                                # verifies the ZIP member CRC without allocating
                                # the full extracted file in the Render worker.
                                staged_member_path = None
                                try:
                                    with tempfile.NamedTemporaryFile(
                                        mode="w+b",
                                        prefix="edms-zip-member-",
                                        suffix=".tmp",
                                        delete=False,
                                    ) as staged_file:
                                        staged_member_path = Path(staged_file.name)
                                        shutil.copyfileobj(
                                            source,
                                            staged_file,
                                            length=1024 * 1024,
                                        )
                                        actual_size = staged_file.tell()

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
                                        staged_member_path,
                                        content_type,
                                        payload_size=actual_size,
                                    )
                                    uploaded_paths.append(cloud_path)
                                finally:
                                    if staged_member_path is not None:
                                        staged_member_path.unlink(missing_ok=True)
                            else:
                                if extraction_root is None:
                                    raise RuntimeError(
                                        "Extraction root directory not found."
                                    )

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
                                    shutil.copyfileobj(
                                        source,
                                        destination,
                                        length=1024 * 1024,
                                    )

                                actual_size = target_path.stat().st_size
                                if actual_size != int(info.file_size or 0):
                                    raise ValueError(
                                        "ZIP member could not be read completely."
                                    )
                    except Exception as error:
                        # For encrypted members, a wrong password commonly
                        # surfaces as a CRC/authentication error while reading.
                        # Do not echo or log the supplied password.
                        if info.flag_bits & 0x1:
                            raise ValueError(
                                "The ZIP password is incorrect, or an encrypted "
                                "file is damaged. Please check the password and try again."
                            ) from error
                        if isinstance(error, ValueError):
                            raise
                        # CRC/read errors are associated with the exact ZIP member.
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
                    if extraction_root is not None:
                        shutil.rmtree(
                            extraction_root,
                            ignore_errors=True,
                        )
                raise

    finally:
        if temporary_download:
            cleanup_download_file(zip_path, force=True)


def cleanup_download_file(file_path: Path, force: bool = False):
    if settings.STORAGE_PROVIDER == "supabase":
        try:
            cache_base = (Path(settings.STORAGE_PATH) / ".cache").resolve()
            resolved = Path(file_path).resolve()
            in_cache = str(resolved).startswith(str(cache_base))
            large_cached_file = (
                in_cache
                and file_path.exists()
                and file_path.stat().st_size > 16 * 1024 * 1024
            )
            if force or not in_cache or large_cached_file:
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
