from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.admin_document import AdminDocument
from app.models.user import User
from app.routes.auth import get_current_user, require_admin
from app.services.storage_service import (
    get_file_path,
    save_upload_files,
    extract_zip_file,
    delete_file,
    delete_files,
    cleanup_download_file,
    create_employee_directory,
)

router = APIRouter(prefix="/admin-documents", tags=["Admin Documents"])


def require_employee_reader(current_user: User):
    if current_user.role not in {"employee", "readonlyemployee"}:
        raise HTTPException(status_code=403, detail="Employee access required.")
    if current_user.status != "active" or not current_user.is_active:
        raise HTTPException(status_code=403, detail="Account is not active.")
    return current_user


def _storage_directory_for_admin_document(document, db):
    """Resolve the physical storage directory for an admin document."""
    if getattr(document, "storage_directory", None):
        return document.storage_directory

    uploader = db.query(User).filter(User.id == document.uploaded_by).first()
    return uploader.directory_name if uploader else None


def _download_admin_document_file(document, db):
    """Download an admin document using its recorded directory, with a
    legacy-safe fallback to the original uploader directory.
    """
    directories = []
    recorded = getattr(document, "storage_directory", None)
    if recorded:
        directories.append(recorded)

    uploader = db.query(User).filter(User.id == document.uploaded_by).first()
    if uploader and uploader.directory_name not in directories:
        directories.append(uploader.directory_name)

    last_error = None
    for directory in directories:
        try:
            file_path = get_file_path(directory, document.stored_name)
            if file_path.exists():
                return file_path, directory
            cleanup_download_file(file_path)
        except Exception as error:
            last_error = error

    if last_error:
        raise last_error
    raise FileNotFoundError("Admin document storage location not found.")


# ==================================================
# ADMIN - GET ALL ADMIN DOCUMENTS
# ==================================================

@router.get("")
def get_admin_documents(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    documents = db.query(AdminDocument).order_by(AdminDocument.uploaded_at.desc()).all()
    result = []

    for document in documents:
        employee = None
        if document.employee_id:
            employee = db.query(User).filter(User.id == document.employee_id).first()

        doc_dir = document.storage_directory or admin.directory_name

        result.append({
            "id": document.id,
            "document_name": document.document_name,
            "category": document.category,
            "file_type": document.file_type,
            "file_size": document.file_size,
            "access_type": document.access_type,
            "department": document.department,
            "employee_id": employee.id if employee else None,
            "employee_name": employee.full_name if employee else None,
            "employee_code": employee.employee_id if employee else None,
            "can_view": document.can_view,
            "can_download": document.can_download,
            "uploaded_at": document.uploaded_at,
            "updated_at": document.updated_at,
            "is_archive": document.is_archive,
            "extracted": document.extracted,
            "parent_document_id": document.parent_document_id,
            "share_token": document.share_token,
            "storage_directory": doc_dir,
            "directory_name": doc_dir,
            "public_path": f"/{doc_dir}/{document.document_name}" if doc_dir else None,
        })

    return result


# ==================================================
# ADMIN - UPLOAD DOCUMENT
# ==================================================

@router.post("")
def upload_admin_document(
    file: UploadFile = File(...),
    document_name: str = Form(...),
    category: str = Form("General"),
    access_type: str = Form("all"),
    department: str | None = Form(None),
    employee_id: int | None = Form(None),
    can_view: bool = Form(True),
    can_download: bool = Form(True),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    document_name = document_name.strip()
    if not document_name:
        raise HTTPException(status_code=400, detail="Document name is required.")

    allowed_access_types = {"all", "department", "employee"}
    if access_type not in allowed_access_types:
        raise HTTPException(status_code=400, detail="Access type must be all, department or employee.")

    if not can_view and not can_download:
        raise HTTPException(status_code=400, detail="At least one permission must be enabled.")

    if access_type == "all":
        department = None
        employee_id = None
    elif access_type == "department":
        department = (department or "").strip()
        if not department:
            raise HTTPException(status_code=400, detail="Department is required for department access.")
        employee_id = None

        employee_exists = db.query(User).filter(
            User.role.in_(["employee", "readonlyemployee"]),
            User.status == "active",
            User.department == department,
        ).first()

        if not employee_exists:
            raise HTTPException(status_code=400, detail="No employees found in the selected department.")
    else:
        if not employee_id:
            raise HTTPException(status_code=400, detail="Employee is required for employee access.")

        employee = db.query(User).filter(
            User.id == employee_id,
            User.role.in_(["employee", "readonlyemployee"]),
            User.status == "active",
        ).first()

        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found.")
        department = None

    try:
        saved_files = save_upload_files(admin.directory_name, file)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    documents = []
    try:
        for item in saved_files:
            document = AdminDocument(
                document_name=item["document_name"],
                stored_name=item["stored_name"],
                category=category.strip() if category else "General",
                file_type=item["file_type"],
                file_size=item["file_size"],
                access_type=access_type,
                department=department,
                employee_id=employee_id,
                can_view=can_view,
                can_download=can_download,
                uploaded_by=admin.id,
                is_archive=bool(item.get("is_archive", False)),
                extracted=bool(item.get("extracted", False)),
                parent_document_id=item.get("parent_document_id"),
                storage_directory=admin.directory_name,
            )
            db.add(document)
            documents.append(document)

        db.commit()
        for document in documents:
            db.refresh(document)
    except Exception:
        db.rollback()
        delete_files(admin.directory_name, [item["stored_name"] for item in saved_files])
        raise HTTPException(status_code=500, detail="Failed to save document.")

    is_archive = bool(documents and documents[0].is_archive)

    return {
        "message": (
            "ZIP uploaded successfully. Use Extract when you want to create its folder and extract the contents."
            if is_archive
            else "Admin document uploaded successfully."
        ),
        "document_id": documents[0].id if documents else None,
        "document_name": documents[0].document_name if documents else None,
        "document_count": len(documents),
        "storage_directory": admin.directory_name,
        "directory_name": admin.directory_name,
        "public_path": f"/{admin.directory_name}/{documents[0].document_name}" if documents else None,
        "documents": [{"id": doc.id, "document_name": doc.document_name} for doc in documents],
    }


# ==================================================
# ADMIN - EXTRACT ZIP DOCUMENT
# ==================================================

@router.post("/{document_id}/extract")
def extract_admin_document(
    document_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    document = db.query(AdminDocument).filter(AdminDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Admin document not found.")

    if not document.is_archive:
        raise HTTPException(status_code=400, detail="Only ZIP documents can be extracted.")

    if document.extracted:
        existing_children = (
            db.query(AdminDocument)
            .filter(AdminDocument.parent_document_id == document.id)
            .order_by(AdminDocument.id.asc())
            .all()
        )
        return {
            "message": f"ZIP is already extracted. {len(existing_children)} file(s) are in the folder.",
            "folder": existing_children[0].stored_name.split("/", 1)[0] if existing_children else None,
            "document_count": len(existing_children),
            "documents": [{"id": child.id, "document_name": child.document_name} for child in existing_children],
        }

    try:
        saved_files = extract_zip_file(
            admin.directory_name,
            document.stored_name,
            document.document_name,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        print("Admin ZIP extraction error:", repr(error))
        raise HTTPException(status_code=500, detail="Unable to extract the ZIP file.")

    children = []
    try:
        for item in saved_files:
            child = AdminDocument(
                document_name=item["document_name"],
                stored_name=item["stored_name"],
                category=document.category,
                file_type=item["file_type"],
                file_size=item["file_size"],
                access_type=document.access_type,
                department=document.department,
                employee_id=document.employee_id,
                can_view=document.can_view,
                can_download=document.can_download,
                uploaded_by=document.uploaded_by,
                is_archive=False,
                extracted=False,
                parent_document_id=document.id,
                storage_directory=admin.directory_name,
            )
            db.add(child)
            children.append(child)

        document.extracted = True
        db.add(document)
        db.commit()

        for child in children:
            db.refresh(child)
    except Exception:
        db.rollback()
        delete_files(admin.directory_name, [item["stored_name"] for item in saved_files])
        raise HTTPException(status_code=500, detail="Unable to create extracted document records.")

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
def public_view_admin_document(share_token: str, db: Session = Depends(get_db)):
    document = db.query(AdminDocument).filter(AdminDocument.share_token == share_token).first()
    if not document:
        raise HTTPException(status_code=404, detail="Shared document not found or the link is invalid.")

    if not document.can_view:
        raise HTTPException(status_code=403, detail="This document is not enabled for viewing.")

    if not document.uploaded_by:
        raise HTTPException(status_code=404, detail="Document owner not found.")

    admin = db.query(User).filter(User.id == document.uploaded_by).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Document owner not found.")

    try:
        file_path, storage_directory = _download_admin_document_file(document, db)
    except Exception as error:
        print("Admin shared document storage lookup failed:", repr(error), "document_id=", document.id)
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
# PUBLIC CLEAN VIEW URL
# ==================================================

@router.get("/public-path/{directory_name}/{file_path:path}")
def public_view_admin_document_by_path(
    directory_name: str,
    file_path: str,
    db: Session = Depends(get_db),
):
    from app.routes.documents import public_view_document_by_path as view_by_path
    return view_by_path(directory_name=directory_name, file_path=file_path, db=db)


# ==================================================
# EMPLOYEE - GET ACCESSIBLE ADMIN DOCUMENTS
# ==================================================

@router.get("/employee/available")
def get_employee_admin_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_employee_reader(current_user)

    documents = (
        db.query(AdminDocument)
        .filter(
            (AdminDocument.access_type == "all")
            | ((AdminDocument.access_type == "department") & (AdminDocument.department == current_user.department))
            | ((AdminDocument.access_type == "employee") & (AdminDocument.employee_id == current_user.id))
        )
        .order_by(AdminDocument.uploaded_at.desc())
        .all()
    )

    result = []
    for document in documents:
        if not document.can_view:
            continue

        extracted_for_current_user = False
        if document.is_archive:
            extracted_for_current_user = (
                db.query(AdminDocument.id)
                .filter(
                    AdminDocument.parent_document_id == document.id,
                    AdminDocument.employee_id == current_user.id,
                    AdminDocument.storage_directory == current_user.directory_name,
                )
                .first()
                is not None
            )

        result.append({
            "id": document.id,
            "document_name": document.document_name,
            "category": document.category,
            "file_type": document.file_type,
            "file_size": document.file_size,
            "access_type": document.access_type,
            "can_view": document.can_view,
            "can_download": document.can_download,
            "uploaded_at": document.uploaded_at,
            "updated_at": document.updated_at,
            "is_archive": document.is_archive,
            "extracted": document.extracted,
            "extracted_for_current_user": extracted_for_current_user,
            "parent_document_id": document.parent_document_id,
            "share_token": document.share_token,
            "storage_directory": document.storage_directory,
            "directory_name": document.storage_directory,
            "public_path": f"/{document.storage_directory}/{document.document_name}" if document.storage_directory else None,
        })

    return result


# ==================================================
# EMPLOYEE - EXTRACT ADMIN-SHARED ZIP
# ==================================================

@router.post("/employee/{document_id}/extract")
def extract_employee_admin_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_employee_reader(current_user)

    if current_user.role != "employee":
        raise HTTPException(status_code=403, detail="Read-only employees cannot extract documents.")

    document = db.query(AdminDocument).filter(AdminDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")

    if not document.is_archive:
        raise HTTPException(status_code=400, detail="Only ZIP documents can be extracted.")

    if not document.can_view:
        raise HTTPException(status_code=403, detail="You do not have permission to view this document.")

    has_access = (
        document.access_type == "all"
        or (document.access_type == "department" and document.department == current_user.department)
        or (document.access_type == "employee" and document.employee_id == current_user.id)
    )
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied.")

    existing_children = (
        db.query(AdminDocument)
        .filter(
            AdminDocument.parent_document_id == document.id,
            AdminDocument.employee_id == current_user.id,
            AdminDocument.storage_directory == current_user.directory_name,
        )
        .order_by(AdminDocument.id.asc())
        .all()
    )

    if existing_children:
        return {
            "message": f"ZIP is already extracted in your directory. {len(existing_children)} file(s) are in the folder.",
            "folder": existing_children[0].stored_name.split("/", 1)[0] if existing_children else None,
            "document_count": len(existing_children),
            "documents": [{"id": child.id, "document_name": child.document_name} for child in existing_children],
        }

    uploader = db.query(User).filter(User.id == document.uploaded_by).first()
    if not uploader:
        raise HTTPException(status_code=404, detail="Document owner not found.")

    try:
        create_employee_directory(current_user.directory_name)
        source_directory = document.storage_directory or uploader.directory_name

        saved_files = extract_zip_file(
            source_directory,
            document.stored_name,
            document.document_name,
            target_directory_name=current_user.directory_name,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        print("Employee admin ZIP extraction error:", repr(error), "document_id=", document_id, "user_id=", current_user.id)
        raise HTTPException(status_code=500, detail="Unable to extract the ZIP file. Check backend logs for details.")

    children = []
    try:
        for item in saved_files:
            child = AdminDocument(
                document_name=item["document_name"],
                stored_name=item["stored_name"],
                category=document.category,
                file_type=item["file_type"],
                file_size=item["file_size"],
                access_type="employee",
                department=current_user.department,
                employee_id=current_user.id,
                can_view=document.can_view,
                can_download=document.can_download,
                uploaded_by=document.uploaded_by,
                is_archive=False,
                extracted=False,
                parent_document_id=document.id,
                storage_directory=current_user.directory_name,
            )
            db.add(child)
            children.append(child)

        db.commit()
        for child in children:
            db.refresh(child)
    except Exception as error:
        db.rollback()
        delete_files(current_user.directory_name, [item["stored_name"] for item in saved_files])
        print("Employee admin ZIP database error:", repr(error))
        raise HTTPException(status_code=500, detail="Unable to create extracted document records.")

    return {
        "message": f"ZIP extracted successfully into your directory. {len(children)} file(s) added to the folder.",
        "folder": children[0].stored_name.split("/", 1)[0] if children else None,
        "document_count": len(children),
        "documents": [{"id": child.id, "document_name": child.document_name} for child in children],
    }


# ==================================================
# EMPLOYEE - VIEW ADMIN DOCUMENT
# ==================================================

@router.get("/employee/{document_id}/view")
def employee_view_admin_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_employee_reader(current_user)

    document = db.query(AdminDocument).filter(AdminDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")

    if not document.can_view:
        raise HTTPException(status_code=403, detail="You do not have permission to view this document.")

    has_access = (
        document.access_type == "all"
        or (document.access_type == "department" and document.department == current_user.department)
        or (document.access_type == "employee" and document.employee_id == current_user.id)
    )
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied.")

    admin = db.query(User).filter(User.id == document.uploaded_by).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Document owner not found.")

    try:
        file_path, storage_directory = _download_admin_document_file(document, db)
    except Exception as error:
        print("Admin document storage lookup failed:", repr(error), "document_id=", document.id)
        raise HTTPException(status_code=404, detail="Physical file not found.")

    return FileResponse(
        path=file_path,
        filename=Path(document.document_name).name,
        media_type=document.file_type,
        content_disposition_type="inline",
        headers={"Cache-Control": "private, max-age=3600, must-revalidate"},
        background=BackgroundTask(cleanup_download_file, file_path),
    )


# ==================================================
# EMPLOYEE - DOWNLOAD ADMIN DOCUMENT
# ==================================================

@router.get("/employee/{document_id}/download")
def employee_download_admin_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_employee_reader(current_user)

    document = db.query(AdminDocument).filter(AdminDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")

    if not document.can_download:
        raise HTTPException(status_code=403, detail="You do not have permission to download this document.")

    has_access = (
        document.access_type == "all"
        or (document.access_type == "department" and document.department == current_user.department)
        or (document.access_type == "employee" and document.employee_id == current_user.id)
    )
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied.")

    admin = db.query(User).filter(User.id == document.uploaded_by).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Document owner not found.")

    try:
        file_path, storage_directory = _download_admin_document_file(document, db)
    except Exception as error:
        print("Admin document storage lookup failed:", repr(error), "document_id=", document.id)
        raise HTTPException(status_code=404, detail="Physical file not found.")

    return FileResponse(
        path=file_path,
        filename=Path(document.document_name).name,
        media_type=document.file_type,
        content_disposition_type="attachment",
        background=BackgroundTask(cleanup_download_file, file_path),
    )


# ==================================================
# ADMIN - DELETE DOCUMENT
# ==================================================

@router.delete("/{document_id}")
def delete_admin_document(
    document_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    document = db.query(AdminDocument).filter(AdminDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Admin document not found.")

    try:
        if document.is_archive:
            children = db.query(AdminDocument).filter(AdminDocument.parent_document_id == document.id).all()
            for child in children:
                try:
                    delete_file(child.storage_directory or admin.directory_name, child.stored_name)
                except Exception:
                    pass

        delete_file(admin.directory_name, document.stored_name)
    except Exception:
        pass

    db.delete(document)
    db.commit()
    return {"message": "Admin document deleted successfully."}


# ==================================================
# ADMIN - VIEW DOCUMENT
# ==================================================

@router.get("/{document_id}/view")
def view_admin_document(
    document_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    document = db.query(AdminDocument).filter(AdminDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Admin document not found.")

    try:
        file_path, storage_directory = _download_admin_document_file(document, db)
    except Exception as error:
        print("Admin document storage lookup failed:", repr(error), "document_id=", document.id)
        raise HTTPException(status_code=404, detail="Physical file not found.")

    return FileResponse(
        path=file_path,
        filename=Path(document.document_name).name,
        media_type=document.file_type,
        content_disposition_type="inline",
        headers={"Cache-Control": "private, max-age=3600, must-revalidate"},
        background=BackgroundTask(cleanup_download_file, file_path),
    )


# ==================================================
# ADMIN - DOWNLOAD DOCUMENT
# ==================================================

@router.get("/{document_id}/download")
def download_admin_document(
    document_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    document = db.query(AdminDocument).filter(AdminDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Admin document not found.")

    try:
        file_path, storage_directory = _download_admin_document_file(document, db)
    except Exception as error:
        print("Admin document storage lookup failed:", repr(error), "document_id=", document.id)
        raise HTTPException(status_code=404, detail="Physical file not found.")

    return FileResponse(
        path=file_path,
        filename=Path(document.document_name).name,
        media_type=document.file_type,
        content_disposition_type="attachment",
        background=BackgroundTask(cleanup_download_file, file_path),
    )
