from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.user import User
from app.services.storage_service import (
    delete_files,
    save_upload_files,
)


def create_documents(
    db: Session,
    user,
    upload_file,
    category: str
):
    """
    Create one Document record for a normal file or one record per
    extracted file when the upload is a ZIP archive.

    ZIP files are retained as normal documents. Their contents are only
    extracted when the user explicitly requests extraction.
    """

    saved_files = save_upload_files(
        user.directory_name,
        upload_file
    )

    total_size = sum(
        int(item["file_size"] or 0)
        for item in saved_files
    )

    current_usage = (
        db.query(
            func.coalesce(
                func.sum(Document.file_size),
                0,
            )
        )
        .filter(
            Document.owner_id == user.id
        )
        .scalar()
        or 0
    )

    storage_limit = (
        user.storage_limit_bytes or 0
    )

    if (
        current_usage + total_size
        > storage_limit
    ):
        delete_files(
            user.directory_name,
            [
                item["stored_name"]
                for item in saved_files
            ],
        )

        raise ValueError(
            "Your storage limit has been reached. "
            "Please request additional storage from the administrator."
        )

    documents = []

    try:
        for item in saved_files:
            document = Document(
                owner_id=user.id,
                document_name=item["document_name"],
                stored_name=item["stored_name"],
                category=(
                    category.strip()
                    if category
                    else "Other"
                ),
                file_type=item["file_type"],
                file_size=item["file_size"],
                version=1,
                is_archive=bool(item.get("is_archive", False)),
                extracted=bool(item.get("extracted", False)),
                parent_document_id=item.get("parent_document_id"),
            )

            db.add(document)
            documents.append(document)

        db.commit()

        for document in documents:
            db.refresh(document)

        return documents

    except Exception:
        db.rollback()

        delete_files(
            user.directory_name,
            [
                item["stored_name"]
                for item in saved_files
            ],
        )

        raise


def delete_document(
    db: Session,
    document: Document,
    user
):

    from app.services.storage_service import delete_file

    # Delete extracted children and their storage objects when an
    # archive parent is deleted. The database FK then cascades the rows.
    if document.is_archive:
        children = (
            db.query(Document)
            .filter(
                Document.parent_document_id == document.id
            )
            .all()
        )

        for child in children:
            child_owner = (
                db.query(User)
                .filter(User.id == child.owner_id)
                .first()
            )
            delete_file(
                child_owner.directory_name if child_owner else user.directory_name,
                child.stored_name,
            )

    delete_file(
        user.directory_name,
        document.stored_name
    )

    db.delete(document)
    db.commit()


def extract_document_archive(db: Session, document: Document, user):
    """
    Explicitly extract a ZIP document and create child Document records.
    The ZIP remains intact and the extracted files live in a folder named
    after the ZIP file (without the .zip extension).
    """
    from app.services.storage_service import (
        archive_folder_name,
        extract_zip_file,
    )

    if not document.is_archive:
        raise ValueError("Only ZIP documents can be extracted.")

    if document.owner_id != user.id and user.role != "admin":
        raise ValueError("Access denied.")

    folder_name = archive_folder_name(
        document.document_name
    )

    # Always check for child records before touching Storage. This covers
    # double-clicks, browser retries, and requests that completed the
    # database transaction but lost the HTTP response.
    existing_children = (
        db.query(Document)
        .filter(
            Document.parent_document_id == document.id,
            Document.owner_id == user.id,
        )
        .order_by(Document.id.asc())
        .all()
    )

    if existing_children:
        if user.id == document.owner_id and not document.extracted:
            document.extracted = True
            db.commit()
        return existing_children

    if document.extracted:
        # The flag can exist without child rows after an interrupted/legacy
        # deployment. Do not silently create a broken state.
        raise ValueError(
            "This ZIP is marked as extracted, but no extracted files were found. "
            "Please contact the administrator."
        )

    # The ZIP always lives in the document owner's directory.
    # The extracted copy is written to the directory of the user who
    # clicked Extract. This is important when an admin extracts an
    # employee-owned ZIP: source=employee, target=admin.
    owner_record = (
        db.query(User)
        .filter(User.id == document.owner_id)
        .first()
    )

    if not owner_record:
        raise ValueError("Document owner not found.")

    source_directory = owner_record.directory_name
    target_directory = user.directory_name

    saved_files = extract_zip_file(
        source_directory,
        document.stored_name,
        document.document_name,
        target_directory_name=target_directory,
    )

    total_size = sum(int(item["file_size"] or 0) for item in saved_files)

    current_usage = (
        db.query(
            func.coalesce(
                func.sum(Document.file_size),
                0,
            )
        )
        .filter(Document.owner_id == user.id)
        .scalar()
        or 0
    )

    # Administrators use their own directory but do not have an employee
    # storage quota. Employee extractions still respect the employee quota.
    storage_limit = user.storage_limit_bytes or 0

    if user.role != "admin" and current_usage + total_size > storage_limit:
        delete_files(
            user.directory_name,
            [item["stored_name"] for item in saved_files],
        )
        raise ValueError(
            "Extracting this ZIP would exceed your storage limit."
        )

    children = []

    try:
        for item in saved_files:
            child = Document(
                # Extracted files belong to the user who performed the
                # extraction. Normally this is the document owner; when an
                # admin extracts an employee ZIP, the files belong to admin.
                owner_id=user.id,
                document_name=item["document_name"],
                stored_name=item["stored_name"],
                category=document.category,
                file_type=item["file_type"],
                file_size=item["file_size"],
                version=1,
                is_archive=False,
                extracted=False,
                parent_document_id=document.id,
            )
            db.add(child)
            children.append(child)

        # A cross-user extraction must not mark the original ZIP as
        # extracted for its owner. This lets the employee later extract
        # their own copy as well.
        if user.id == document.owner_id:
            document.extracted = True
            db.add(document)
        db.commit()

        for child in children:
            db.refresh(child)

        db.refresh(document)
        return children

    except Exception:
        db.rollback()
        delete_files(
            user.directory_name,
            [item["stored_name"] for item in saved_files],
        )
        raise
