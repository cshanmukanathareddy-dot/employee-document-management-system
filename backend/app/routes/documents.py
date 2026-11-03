from pathlib import Path, PurePosixPath

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.document import Document
from app.models.user import User
from app.routes.auth import get_current_user
from app.services.document_service import create_documents, delete_document, extract_document_archive
from app.services.storage_service import get_file_path, save_upload_files, delete_files, cleanup_download_file

router = APIRouter(prefix="/documents", tags=["Documents"])


# ==================================================
# GET CURRENT USER DOCUMENTS
# ==================================================

@router.get("")
def get_documents(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "readonlyemployee":
        raise HTTPException(
            status_code=403,
            detail="Read-only employees can only access administrator-uploaded documents.",
        )

    documents = (
        db.query(Document)
        .filter(Document.owner_id == current_user.id)
        .order_by(Document.uploaded_at.desc())
        .all()
    )

    return [
        {
            "id": doc.id,
            "document_name": doc.document_name,
            "category": doc.category,
            "file_type": doc.file_type,
            "file_size": doc.file_size,
            "version": doc.version,
            "uploaded_at": doc.uploaded_at,
            "updated_at": doc.updated_at,
            "is_archive": doc.is_archive,
            "extracted": doc.extracted,
            "parent_document_id": doc.parent_document_id,
            "share_token": doc.share_token,
            "directory_name": current_user.directory_name,
            "public_path": f"/{current_user.directory_name}/{doc.document_name}",
        }
        for doc in documents
    ]


# ==================================================
# EMPLOYEE UPLOAD DOCUMENT
# ==================================================

@router.post("")
def upload_document(
    file: UploadFile = File(...),
    category: str = Form("Other"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "employee" or current_user.status != "active":
        raise HTTPException(status_code=403, detail="Only active employees can upload documents.")

    try:
        documents = create_documents(db, current_user, file, category)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    is_archive = bool(documents and documents[0].is_archive)

    return {
        "message": (
            "ZIP uploaded successfully. Use Extract when you want to create its folder and extract the contents."
            if is_archive
            else "Document uploaded successfully."
        ),
        "document_id": documents[0].id if documents else None,
        "document_name": documents[0].document_name if documents else None,
        "document_count": len(documents),
        "documents": [
            {
                "id": doc.id,
                "document_name": doc.document_name,
                "category": doc.category,
                "file_type": doc.file_type,
                "file_size": doc.file_size,
                "version": doc.version,
                "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
                "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
                "is_archive": doc.is_archive,
                "extracted": doc.extracted,
                "parent_document_id": doc.parent_document_id,
                "share_token": doc.share_token,
                "directory_name": current_user.directory_name,
                "public_path": f"/{current_user.directory_name}/{doc.document_name}",
            }
            for doc in documents
        ],
    }


# ==================================================
# ADMIN UPLOAD DOCUMENT FOR EMPLOYEE
# ==================================================

@router.post("/admin-upload")
def admin_upload_document(
    file: UploadFile = File(...),
    employee_id: int = Form(...),
    category: str = Form("Other"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Administrator access required.")

    employee = db.query(User).filter(User.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")

    if employee.role != "employee" or employee.status != "active":
        raise HTTPException(status_code=400, detail="Documents can only be assigned to active employee accounts.")

    try:
        saved_files = save_upload_files(employee.directory_name, file)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    uploaded_size = sum(int(item["file_size"] or 0) for item in saved_files)
    current_usage = db.query(func.coalesce(func.sum(Document.file_size), 0)).filter(Document.owner_id == employee.id).scalar() or 0
    storage_limit = employee.storage_limit_bytes or 0

    if current_usage + uploaded_size > storage_limit:
        delete_files(employee.directory_name, [item["stored_name"] for item in saved_files])
        raise HTTPException(
            status_code=400,
            detail="Employee storage limit exceeded. Please request additional storage from the administrator.",
        )

    documents = []
    try:
        for item in saved_files:
            doc = Document(
                owner_id=employee.id,
                document_name=item["document_name"],
                stored_name=item["stored_name"],
                category=category.strip() if category else "Other",
                file_type=item["file_type"],
                file_size=item["file_size"],
                version=1,
            )
            db.add(doc)
            documents.append(doc)

        db.commit()
        for doc in documents:
            db.refresh(doc)
    except Exception:
        db.rollback()
        delete_files(employee.directory_name, [item["stored_name"] for item in saved_files])
        raise HTTPException(status_code=500, detail="Unable to save document.")

    is_archive = any("/" in doc.stored_name for doc in documents)

    return {
        "message": (
            f"ZIP extracted successfully. {len(documents)} file(s) added to the employee's directory."
            if is_archive
            else "Document uploaded successfully."
        ),
        "document_id": documents[0].id if documents else None,
        "document_name": documents[0].document_name if documents else None,
        "document_count": len(documents),
        "documents": [
            {
                "id": doc.id,
                "document_name": doc.document_name,
                "category": doc.category,
                "file_type": doc.file_type,
                "file_size": doc.file_size,
                "version": doc.version,
                "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
                "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
                "is_archive": doc.is_archive,
                "extracted": doc.extracted,
                "parent_document_id": doc.parent_document_id,
                "share_token": doc.share_token,
                "directory_name": employee.directory_name,
                "public_path": f"/{employee.directory_name}/{doc.document_name}",
            }
            for doc in documents
        ],
        "employee_id": employee.id,
        "employee_name": employee.full_name,
        "category": category.strip() if category else "Other",
    }


# ==================================================
# EXTRACT ZIP DOCUMENT
# ==================================================

@router.post("/{document_id}/extract")
def extract_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")

    if current_user.role != "admin" and document.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied.")

    if current_user.role == "readonlyemployee":
        raise HTTPException(status_code=403, detail="Read-only employees cannot extract documents.")

    owner = db.query(User).filter(User.id == document.owner_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Document owner not found.")

    try:
        children = extract_document_archive(db, document, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        print("Document ZIP extraction error:", repr(error), "document_id=", document_id, "user_id=", current_user.id)
        raise HTTPException(status_code=500, detail="Unable to extract the ZIP file. Check backend logs for details.")

    return {
        "message": f"ZIP extracted successfully. {len(children)} file(s) added to the folder.",
        "folder": children[0].stored_name.split("/", 1)[0] if children else None,
        "document_count": len(children),
        "documents": [{"id": child.id, "document_name": child.document_name} for child in children],
    }


# ==================================================
# PUBLIC VIEW / SHARE LINK
# ==================================================

@router.get("/public/{share_token}")
def public_view_document(share_token: str, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.share_token == share_token).first()
    if not document:
        raise HTTPException(status_code=404, detail="Shared document not found or the link is invalid.")

    owner = db.query(User).filter(User.id == document.owner_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Document owner not found.")

    try:
        file_path = get_file_path(owner.directory_name, document.stored_name)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    if not file_path.exists():
        cleanup_download_file(file_path)
        raise HTTPException(status_code=404, detail="Shared file is no longer available.")

    return FileResponse(
        path=file_path,
        filename=Path(document.document_name).name,
        media_type=document.file_type or "application/octet-stream",
        content_disposition_type="inline",
        headers={
            "X-Robots-Tag": "noindex, nofollow",
            "Cache-Control": "private, max-age=3600, must-revalidate",
        },
        background=BackgroundTask(cleanup_download_file, file_path),
    )


# ==================================================
# CLEAN PUBLIC VIEW URL
# ==================================================

@router.get("/public-path/{directory_name}")
@router.get("/public-path/{directory_name}/")
def public_view_directory_root(directory_name: str, db: Session = Depends(get_db)):
    """Direct navigation to employee directory root. Automatically serves index.html."""
    return public_view_document_by_path(directory_name=directory_name, file_path="index.html", db=db)


@router.get("/public-path/{directory_name}/{file_path:path}")
def public_view_document_by_path(directory_name: str, file_path: str, db: Session = Depends(get_db)):
    """Public, read-only document endpoint used by clean URLs."""
    if not directory_name or not file_path:
        raise HTTPException(status_code=404, detail="Document not found.")

    normalized_path = file_path.replace("\\", "/").strip("/")
    path_parts = PurePosixPath(normalized_path).parts

    if (
        not normalized_path
        or not path_parts
        or any(part in {"", ".", ".."} for part in path_parts)
        or any("\\" in part for part in path_parts)
    ):
        raise HTTPException(status_code=404, detail="Document not found.")

    owner = db.query(User).filter(User.directory_name == directory_name).first()
    document = None

    if owner:
        document = (
            db.query(Document)
            .filter(Document.owner_id == owner.id, Document.document_name == normalized_path)
            .first()
        )

        if not document and normalized_path == "index.html":
            document = (
                db.query(Document)
                .filter(Document.owner_id == owner.id, Document.document_name.like("%index.html"))
                .order_by(Document.id.desc())
                .first()
            )

    if not document:
        from app.models.admin_document import AdminDocument

        admin_doc = (
            db.query(AdminDocument)
            .filter(
                (AdminDocument.storage_directory == directory_name) | (AdminDocument.uploaded_by == (owner.id if owner else -1)),
                AdminDocument.document_name == normalized_path,
            )
            .first()
        )

        if not admin_doc and normalized_path == "index.html":
            admin_doc = (
                db.query(AdminDocument)
                .filter(
                    (AdminDocument.storage_directory == directory_name) | (AdminDocument.uploaded_by == (owner.id if owner else -1)),
                    AdminDocument.document_name.like("%index.html"),
                )
                .order_by(AdminDocument.id.desc())
                .first()
            )

        if not admin_doc:
            admin_doc = db.query(AdminDocument).filter(AdminDocument.document_name == normalized_path).first()

        if not admin_doc and normalized_path == "index.html":
            admin_doc = (
                db.query(AdminDocument)
                .filter(AdminDocument.document_name.like("%index.html"))
                .order_by(AdminDocument.id.desc())
                .first()
            )

        if not admin_doc:
            raise HTTPException(status_code=404, detail="Document not found.")

        if not admin_doc.can_view:
            raise HTTPException(status_code=403, detail="This document is not enabled for viewing.")

        from app.routes.admin_documents import _download_admin_document_file

        try:
            file_path_on_disk, _ = _download_admin_document_file(admin_doc, db)
        except Exception:
            raise HTTPException(status_code=404, detail="Document file is no longer available.")

        if not file_path_on_disk.exists():
            cleanup_download_file(file_path_on_disk)
            raise HTTPException(status_code=404, detail="Document file is no longer available.")

        public_headers = {
            "X-Robots-Tag": "noindex, nofollow, noarchive",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
            "CDN-Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        }

        if (admin_doc.file_type or "").lower().startswith("text/html"):
            # Public HTML is intentionally sandboxed because it is served on
            # the same custom domain as the EDMS application. Do not grant
            # allow-same-origin: that would let uploaded HTML access the EDMS
            # origin and its browser storage.
            public_headers["Content-Security-Policy"] = (
                "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
            )

        return FileResponse(
            path=file_path_on_disk,
            filename=Path(admin_doc.document_name).name,
            media_type=admin_doc.file_type or "application/octet-stream",
            content_disposition_type="inline",
            headers=public_headers,
            background=BackgroundTask(cleanup_download_file, file_path_on_disk),
        )

    if not owner or not document:
        raise HTTPException(status_code=404, detail="Document not found.")

    try:
        file_path_on_disk = get_file_path(owner.directory_name, document.stored_name)
    except ValueError:
        raise HTTPException(status_code=404, detail="Document not found.")

    if not file_path_on_disk.exists():
        cleanup_download_file(file_path_on_disk)
        raise HTTPException(status_code=404, detail="Document file is no longer available.")

    public_headers = {
        "X-Robots-Tag": "noindex, nofollow, noarchive",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        "CDN-Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    }

    if (document.file_type or "").lower().startswith("text/html"):
        # Keep uploaded HTML isolated from the EDMS application's origin.
        public_headers["Content-Security-Policy"] = (
            "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
        )

    return FileResponse(
        path=file_path_on_disk,
        filename=Path(document.document_name).name,
        media_type=document.file_type or "application/octet-stream",
        content_disposition_type="inline",
        headers=public_headers,
        background=BackgroundTask(cleanup_download_file, file_path_on_disk),
    )


# ==================================================
# DOCUMENT FILE HELPER
# ==================================================

def get_document_file(document_id: int, current_user: User, db: Session):
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")

    if current_user.role == "readonlyemployee":
        raise HTTPException(
            status_code=403,
            detail="Read-only employees can only access documents uploaded by administrators.",
        )

    if current_user.role != "admin" and document.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied.")

    owner = db.query(User).filter(User.id == document.owner_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Document owner not found.")

    file_path = get_file_path(owner.directory_name, document.stored_name)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Physical file not found.")

    return document, file_path


# ==================================================
# VIEW DOCUMENT
# ==================================================

@router.get("/{document_id}/view")
def view_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document, file_path = get_document_file(document_id, current_user, db)
    return FileResponse(
        path=file_path,
        filename=Path(document.document_name).name,
        media_type=document.file_type,
        content_disposition_type="inline",
        headers={"Cache-Control": "private, max-age=3600, must-revalidate"},
        background=BackgroundTask(cleanup_download_file, file_path),
    )


# ==================================================
# DOWNLOAD DOCUMENT
# ==================================================

@router.get("/{document_id}/download")
def download_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document, file_path = get_document_file(document_id, current_user, db)
    return FileResponse(
        path=file_path,
        filename=Path(document.document_name).name,
        media_type=document.file_type,
        content_disposition_type="attachment",
        background=BackgroundTask(cleanup_download_file, file_path),
    )


# ==================================================
# DELETE DOCUMENT
# ==================================================

@router.delete("/{document_id}")
def delete_document_endpoint(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")

    if current_user.role == "admin":
        owner = db.query(User).filter(User.id == document.owner_id).first()
        if not owner:
            raise HTTPException(status_code=404, detail="Document owner not found.")
    elif current_user.role == "readonlyemployee":
        raise HTTPException(status_code=403, detail="Read-only employees cannot delete documents.")
    else:
        if document.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied.")
        owner = current_user
        if owner.status != "active":
            raise HTTPException(status_code=403, detail="Documents cannot be deleted after employee deactivation.")

    try:
        delete_document(db, document, owner)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    return {"message": "Document deleted successfully."}