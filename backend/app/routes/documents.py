from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)

from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from pathlib import Path, PurePosixPath

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.database import get_db

from app.models.document import Document
from app.models.user import User

from app.routes.auth import get_current_user

from app.services.document_service import (
    create_documents,
    delete_document,
    extract_document_archive,
)

from app.services.storage_service import (
    get_file_path,
    save_upload_files,
    delete_files,
    cleanup_download_file,
)


router = APIRouter(
    prefix="/documents",
    tags=["Documents"]
)


# ==================================================
# GET CURRENT USER DOCUMENTS
# ==================================================

@router.get("")
def get_documents(
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    )
):

    if current_user.role == "readonlyemployee":
        raise HTTPException(
            status_code=403,
            detail=(
                "Read-only employees can only access "
                "administrator-uploaded documents."
            )
        )

    documents = (
        db.query(Document)
        .filter(
            Document.owner_id == current_user.id
        )
        .order_by(
            Document.uploaded_at.desc()
        )
        .all()
    )

    return [
        {
            "id": document.id,

            "document_name":
                document.document_name,

            "category":
                document.category,

            "file_type":
                document.file_type,

            "file_size":
                document.file_size,

            "version":
                document.version,

            "uploaded_at":
                document.uploaded_at,

            "updated_at":
                document.updated_at,

            "is_archive":
                document.is_archive,

            "extracted":
                document.extracted,

            "parent_document_id":
                document.parent_document_id,

            "share_token":
                document.share_token,

            "directory_name":
                current_user.directory_name,

            "public_path":
                f"/{current_user.directory_name}/{document.document_name}",
        }

        for document in documents
    ]


# ==================================================
# EMPLOYEE UPLOAD DOCUMENT
# ==================================================

@router.post("")
def upload_document(
    file: UploadFile = File(...),

    category: str = Form(
        "Other"
    ),

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    )
):

    # --------------------------------------------------
    # ONLY ACTIVE EMPLOYEES CAN UPLOAD
    # --------------------------------------------------

    if (
        current_user.role != "employee"
        or current_user.status != "active"
    ):

        raise HTTPException(
            status_code=403,
            detail=(
                "Only active employees can upload documents."
            )
        )

    # --------------------------------------------------
    # CREATE DOCUMENT
    # --------------------------------------------------

    try:

        documents = create_documents(
            db,
            current_user,
            file,
            category
        )

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    is_archive = bool(documents and documents[0].is_archive)

    return {
        "message": (
            "ZIP uploaded successfully. Use Extract when you want "
            "to create its folder and extract the contents."
            if is_archive
            else "Document uploaded successfully."
        ),

        "document_id":
            documents[0].id
            if documents
            else None,

        "document_name":
            documents[0].document_name
            if documents
            else None,

        "document_count":
            len(documents),

        "documents": [
            {
                "id": document.id,
                "document_name": document.document_name,
            }
            for document in documents
        ],
    }


# ==================================================
# ADMIN UPLOAD DOCUMENT FOR EMPLOYEE
# ==================================================

@router.post("/admin-upload")
def admin_upload_document(
    file: UploadFile = File(...),

    employee_id: int = Form(...),

    category: str = Form(
        "Other"
    ),

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    )
):

    # --------------------------------------------------
    # ADMIN ONLY
    # --------------------------------------------------

    if current_user.role != "admin":

        raise HTTPException(
            status_code=403,
            detail="Administrator access required."
        )

    # --------------------------------------------------
    # FIND TARGET EMPLOYEE
    # --------------------------------------------------

    employee = (
        db.query(User)
        .filter(
            User.id == employee_id
        )
        .first()
    )

    if not employee:

        raise HTTPException(
            status_code=404,
            detail="Employee not found."
        )

    # --------------------------------------------------
    # DO NOT ALLOW ADMIN TO USE THIS ENDPOINT
    # FOR ANOTHER ADMIN
    # --------------------------------------------------

    if (
        employee.role != "employee"
        or employee.status != "active"
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Documents can only be assigned to active "
                "employee accounts."
            )
        )

    # --------------------------------------------------
    # SAVE FILE / EXTRACT ZIP
    # --------------------------------------------------

    try:

        saved_files = save_upload_files(
            employee.directory_name,
            file
        )

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    # --------------------------------------------------
    # STORAGE QUOTA
    # --------------------------------------------------

    uploaded_size = sum(
        int(item["file_size"] or 0)
        for item in saved_files
    )

    current_usage = (
        db.query(
            func.coalesce(
                func.sum(Document.file_size),
                0
            )
        )
        .filter(
            Document.owner_id == employee.id
        )
        .scalar()
        or 0
    )

    storage_limit = (
        employee.storage_limit_bytes or 0
    )

    if (
        current_usage + uploaded_size
        > storage_limit
    ):

        delete_files(
            employee.directory_name,
            [
                item["stored_name"]
                for item in saved_files
            ]
        )

        raise HTTPException(
            status_code=400,
            detail=(
                "Employee storage limit exceeded. "
                "Please request additional storage from the administrator."
            )
        )

    # --------------------------------------------------
    # CREATE DATABASE RECORDS
    # --------------------------------------------------

    documents = []

    try:

        for item in saved_files:

            document = Document(

                owner_id=
                    employee.id,

                document_name=
                    item["document_name"],

                stored_name=
                    item["stored_name"],

                category=
                    category.strip()
                    if category
                    else "Other",

                file_type=
                    item["file_type"],

                file_size=
                    item["file_size"],

                version=
                    1,

            )

            db.add(document)
            documents.append(document)

        db.commit()

        for document in documents:
            db.refresh(document)

    except Exception:

        db.rollback()

        delete_files(
            employee.directory_name,
            [
                item["stored_name"]
                for item in saved_files
            ]
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to save document."
        )

    is_archive = any(
        "/" in document.stored_name
        for document in documents
    )

    return {
        "message": (
            f"ZIP extracted successfully. "
            f"{len(documents)} file(s) added to the employee's directory."
            if is_archive
            else "Document uploaded successfully."
        ),

        "document_id":
            documents[0].id
            if documents
            else None,

        "document_name":
            documents[0].document_name
            if documents
            else None,

        "document_count":
            len(documents),

        "documents": [
            {
                "id": document.id,
                "document_name": document.document_name,
            }
            for document in documents
        ],

        "employee_id":
            employee.id,

        "employee_name":
            employee.full_name,

        "category":
            category.strip()
            if category
            else "Other",
    }



# ==================================================
# EXTRACT ZIP DOCUMENT
# ==================================================

@router.post(
    "/{document_id}/extract"
)
def extract_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = (
        db.query(Document)
        .filter(Document.id == document_id)
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found.",
        )

    if current_user.role != "admin" and document.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Access denied.",
        )

    if current_user.role == "readonlyemployee":
        raise HTTPException(
            status_code=403,
            detail="Read-only employees cannot extract documents.",
        )

    owner = (
        db.query(User)
        .filter(User.id == document.owner_id)
        .first()
    )

    if not owner:
        raise HTTPException(
            status_code=404,
            detail="Document owner not found.",
        )

    try:
        # Extract into the directory of the user who clicked Extract.
        # The service resolves the original ZIP from its owner's directory.
        children = extract_document_archive(
            db,
            document,
            current_user,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )
    except Exception as error:
        print(
            "Document ZIP extraction error:",
            repr(error),
            "document_id=",
            document_id,
            "user_id=",
            current_user.id,
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to extract the ZIP file. Check backend logs for details.",
        )

    return {
        "message": (
            f"ZIP extracted successfully. "
            f"{len(children)} file(s) added to the folder."
        ),
        "folder": (
            children[0].stored_name.split("/", 1)[0]
            if children
            else None
        ),
        "document_count": len(children),
        "documents": [
            {
                "id": child.id,
                "document_name": child.document_name,
            }
            for child in children
        ],
    }


# ==================================================
# PUBLIC VIEW / SHARE LINK
# ==================================================

@router.get(
    "/public/{share_token}"
)
def public_view_document(
    share_token: str,
    db: Session = Depends(get_db),
):
    document = (
        db.query(Document)
        .filter(Document.share_token == share_token)
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Shared document not found or the link is invalid.",
        )

    owner = (
        db.query(User)
        .filter(User.id == document.owner_id)
        .first()
    )

    if not owner:
        raise HTTPException(
            status_code=404,
            detail="Document owner not found.",
        )

    try:
        file_path = get_file_path(
            owner.directory_name,
            document.stored_name,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    if not file_path.exists():
        cleanup_download_file(file_path)
        raise HTTPException(
            status_code=404,
            detail="Shared file is no longer available.",
        )

    return FileResponse(
        path=file_path,
        filename=document.document_name,
        media_type=document.file_type or "application/octet-stream",
        content_disposition_type="inline",
        headers={
            "X-Robots-Tag": "noindex, nofollow",
            "Cache-Control": "private, no-store",
        },
        background=BackgroundTask(
            cleanup_download_file,
            file_path,
        ),
    )


# ==================================================
# CLEAN PUBLIC VIEW URL
# ==================================================

@router.get(
    "/public-path/{directory_name}/{file_path:path}"
)
def public_view_document_by_path(
    directory_name: str,
    file_path: str,
    db: Session = Depends(get_db),
):
    """
    Public, read-only document endpoint used by clean URLs such as:

        https://web-a2z.com/rahul_123/index.html

    The endpoint only serves a file that already exists as a Document record
    belonging to the requested employee directory. No authentication is
    required and there are no write operations exposed here.
    """
    if not directory_name or not file_path:
        raise HTTPException(
            status_code=404,
            detail="Document not found.",
        )

    # Reject traversal and backslash-based alternate paths before querying.
    normalized_path = file_path.replace("\\", "/").strip("/")
    path_parts = PurePosixPath(normalized_path).parts

    if (
        not normalized_path
        or not path_parts
        or any(part in {"", ".", ".."} for part in path_parts)
        or any("\\" in part for part in path_parts)
    ):
        raise HTTPException(
            status_code=404,
            detail="Document not found.",
        )

    owner = (
        db.query(User)
        .filter(User.directory_name == directory_name)
        .first()
    )

    if not owner:
        raise HTTPException(
            status_code=404,
            detail="Document not found.",
        )

    document = (
        db.query(Document)
        .filter(
            Document.owner_id == owner.id,
            Document.document_name == normalized_path,
        )
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found.",
        )

    try:
        file_path_on_disk = get_file_path(
            owner.directory_name,
            document.stored_name,
        )
    except ValueError:
        raise HTTPException(
            status_code=404,
            detail="Document not found.",
        )

    if not file_path_on_disk.exists():
        cleanup_download_file(file_path_on_disk)
        raise HTTPException(
            status_code=404,
            detail="Document file is no longer available.",
        )

    public_headers = {
        "X-Robots-Tag": "noindex, nofollow, noarchive",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
    }

    # Uploaded HTML is rendered in the public viewer's iframe. Sandbox it so
    # a shared HTML file cannot execute with normal origin privileges.
    if (document.file_type or "").lower().startswith("text/html"):
        public_headers["Content-Security-Policy"] = "sandbox"

    return FileResponse(
        path=file_path_on_disk,
        filename=Path(document.document_name).name,
        media_type=document.file_type or "application/octet-stream",
        content_disposition_type="inline",
        headers=public_headers,
        background=BackgroundTask(
            cleanup_download_file,
            file_path_on_disk,
        ),
    )


# ==================================================
# GET DOCUMENT + FILE PATH
# ==================================================

def get_document_file(
    document_id: int,
    current_user: User,
    db: Session
):

    # --------------------------------------------------
    # GET DOCUMENT
    # --------------------------------------------------

    document = (
        db.query(Document)
        .filter(
            Document.id == document_id
        )
        .first()
    )

    if not document:

        raise HTTPException(
            status_code=404,
            detail="Document not found."
        )

    # --------------------------------------------------
    # READ-ONLY EMPLOYEES CANNOT ACCESS EMPLOYEE-OWNED
    # DOCUMENTS. They only use /admin-documents/employee/*
    # for administrator-uploaded documents.
    # --------------------------------------------------

    if current_user.role == "readonlyemployee":

        raise HTTPException(
            status_code=403,
            detail=(
                "Read-only employees can only access "
                "documents uploaded by administrators."
            )
        )

    # --------------------------------------------------
    # ACCESS CONTROL
    # --------------------------------------------------

    if (
        current_user.role != "admin"
        and
        document.owner_id != current_user.id
    ):

        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    # --------------------------------------------------
    # GET OWNER
    # --------------------------------------------------

    owner = (
        db.query(User)
        .filter(
            User.id == document.owner_id
        )
        .first()
    )

    if not owner:

        raise HTTPException(
            status_code=404,
            detail="Document owner not found."
        )

    # --------------------------------------------------
    # GET PHYSICAL FILE
    # --------------------------------------------------

    file_path = get_file_path(
        owner.directory_name,
        document.stored_name
    )

    if not file_path.exists():

        raise HTTPException(
            status_code=404,
            detail="Physical file not found."
        )

    return document, file_path


# ==================================================
# VIEW DOCUMENT
# ==================================================

@router.get(
    "/{document_id}/view"
)
def view_document(
    document_id: int,

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    )
):

    document, file_path = (
        get_document_file(
            document_id,
            current_user,
            db
        )
    )

    return FileResponse(
        path=file_path,

        filename=
            document.document_name,

        media_type=
            document.file_type,

        content_disposition_type=
            "inline",
        background=BackgroundTask(
            cleanup_download_file,
            file_path,
        ),
    )


# ==================================================
# DOWNLOAD DOCUMENT
# ==================================================

@router.get(
    "/{document_id}/download"
)
def download_document(
    document_id: int,

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    )
):

    document, file_path = (
        get_document_file(
            document_id,
            current_user,
            db
        )
    )

    return FileResponse(
        path=file_path,

        filename=
            document.document_name,

        media_type=
            document.file_type,

        content_disposition_type=
            "attachment",
        background=BackgroundTask(
            cleanup_download_file,
            file_path,
        ),
    )


# ==================================================
# DELETE DOCUMENT
# ==================================================

@router.delete(
    "/{document_id}"
)
def delete_document_endpoint(
    document_id: int,

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    )
):

    # --------------------------------------------------
    # GET DOCUMENT
    # --------------------------------------------------

    document = (
        db.query(Document)
        .filter(
            Document.id == document_id
        )
        .first()
    )

    if not document:

        raise HTTPException(
            status_code=404,
            detail="Document not found."
        )

    # ==================================================
    # ADMIN DELETE
    # ==================================================

    if current_user.role == "admin":

        owner = (
            db.query(User)
            .filter(
                User.id == document.owner_id
            )
            .first()
        )

        if not owner:

            raise HTTPException(
                status_code=404,
                detail=
                    "Document owner not found."
            )

    # ==================================================
    # READ-ONLY EMPLOYEE DELETE
    # ==================================================

    elif current_user.role == "readonlyemployee":

        raise HTTPException(
            status_code=403,
            detail="Read-only employees cannot delete documents."
        )

    # ==================================================
    # EMPLOYEE DELETE
    # ==================================================

    else:

        # --------------------------------------------------
        # ONLY OWNER CAN DELETE
        # --------------------------------------------------

        if (
            document.owner_id != current_user.id
        ):

            raise HTTPException(
                status_code=403,
                detail="Access denied."
            )

        owner = current_user

        # --------------------------------------------------
        # ACTIVE EMPLOYEE ONLY
        # --------------------------------------------------

        if owner.status != "active":

            raise HTTPException(
                status_code=403,
                detail=(
                    "Documents cannot be deleted "
                    "after employee deactivation."
                )
            )

    # ==================================================
    # DELETE
    # ==================================================

    try:

        delete_document(
            db,
            document,
            owner
        )

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    return {
        "message":
            "Document deleted successfully."
    }