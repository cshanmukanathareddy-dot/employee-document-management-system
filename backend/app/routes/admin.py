from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)
from pydantic import BaseModel, Field

from datetime import datetime
from io import BytesIO

from fastapi.responses import StreamingResponse

from openpyxl import Workbook
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.document import Document
from app.models.user import User
from app.models.storage_request import StorageRequest
from app.routes.auth import require_admin


router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
)


class RegistrationDecision(BaseModel):
    decision: str


@router.get("/registration-requests")
def get_registration_requests(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    requests = (
        db.query(User)
        .filter(
            User.role == "pending",
            User.status == "pending",
        )
        .order_by(User.created_at.desc())
        .all()
    )

    return [
        {
            "id": user.id,
            "employee_id": user.employee_id,
            "full_name": user.full_name,
            "email": user.email,
            "mobile_number": user.mobile_number,
            "department": user.department,
            "designation": user.designation,
            "joining_date": user.joining_date,
            "aadhaar_number": user.aadhaar_number,
            "pan_number": user.pan_number,
            "address": user.address,
            "emergency_contact": user.emergency_contact,
            "directory_name": user.directory_name,
            "storage_gb": round(user.storage_limit_bytes / (1024 ** 3), 2),
            "status": user.status,
            "created_at": user.created_at,
        }
        for user in requests
    ]


@router.put("/registration-requests/{user_id}")
def decide_registration(
    user_id: int,
    data: RegistrationDecision,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    decision = data.decision.strip().lower()

    if decision not in {
        "employee",
        "readonlyemployee",
        "reject",
    }:
        raise HTTPException(
            status_code=400,
            detail=(
                "Decision must be employee, "
                "readonlyemployee or reject."
            ),
        )

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Registration request not found.",
        )

    if user.role != "pending" or user.status != "pending":
        raise HTTPException(
            status_code=400,
            detail="This registration request has already been processed.",
        )

    if decision == "reject":
        user.role = "rejected"
        user.status = "rejected"
        user.is_active = False
        db.commit()

        return {
            "message": "Registration request rejected.",
            "role": "rejected",
            "status": "rejected",
        }

    user.role = decision
    user.status = "active"
    user.is_active = True

    if decision == "readonlyemployee":
        user.storage_limit_bytes = 0
        user.storage_limit_gb = 0
    else:
        user.storage_limit_gb = round(
            user.storage_limit_bytes / (1024 ** 3),
            2,
        )

    db.commit()

    role_label = (
        "Read Only Employee"
        if decision == "readonlyemployee"
        else "Employee"
    )

    return {
        "message": f"Registration approved as {role_label}.",
        "role": decision,
        "status": "active",
    }


@router.get("/employees")
def get_all_employees(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    employees = (
        db.query(User)
        .filter(
            User.role.in_([
                "employee",
                "readonlyemployee",
            ])
        )
        .order_by(User.created_at.desc())
        .all()
    )

    return [
        {
            "id": employee.id,
            "employee_id": employee.employee_id,
            "full_name": employee.full_name,
            "email": employee.email,
            "mobile_number": employee.mobile_number,
            "department": employee.department,
            "designation": employee.designation,
            "joining_date": employee.joining_date,
            "directory_name": employee.directory_name,
            "role": employee.role,
            "status": employee.status,
            "storage_limit_bytes": employee.storage_limit_bytes,
            "storage_gb": round(employee.storage_limit_bytes / (1024 ** 3), 2),
            "created_at": employee.created_at,
        }
        for employee in employees
    ]


# ==================================================
# EXPORT EMPLOYEE INFORMATION TO EXCEL
# ==================================================

@router.get("/employees/export")
def export_employees_excel(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    employees = (
        db.query(User)
        .filter(
            User.role.in_([
                "employee",
                "readonlyemployee",
            ])
        )
        .order_by(User.created_at.asc())
        .all()
    )

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Employees"

    headers = [
        "ID",
        "Employee ID",
        "Full Name",
        "Email",
        "Mobile Number",
        "Department",
        "Designation",
        "Joining Date",
        "Aadhaar Number",
        "PAN Number",
        "Address",
        "Emergency Contact",
        "Directory Name",
        "Role",
        "Status",
        "Active",
        "Storage Allocated (GB)",
        "Storage Used (GB)",
        "Storage Remaining (GB)",
        "Created At",
    ]

    sheet.append(headers)

    for employee in employees:
        used_bytes = (
            db.query(Document.file_size)
            .filter(
                Document.owner_id == employee.id
            )
            .all()
        )

        used = sum(
            int(row[0] or 0)
            for row in used_bytes
        )

        allocated = employee.storage_limit_bytes or 0
        remaining = max(allocated - used, 0)

        sheet.append([
            employee.id,
            employee.employee_id,
            employee.full_name,
            employee.email,
            employee.mobile_number,
            employee.department,
            employee.designation,
            employee.joining_date,
            employee.aadhaar_number,
            employee.pan_number,
            employee.address,
            employee.emergency_contact,
            employee.directory_name,
            employee.role,
            employee.status,
            "Yes" if employee.is_active else "No",
            round(allocated / (1024 ** 3), 2),
            round(used / (1024 ** 3), 4),
            round(remaining / (1024 ** 3), 4),
            employee.created_at,
        ])

    for cell in sheet[1]:
        cell.font = cell.font.copy(bold=True)

    widths = {
        "A": 8,
        "B": 16,
        "C": 24,
        "D": 30,
        "E": 18,
        "F": 18,
        "G": 22,
        "H": 15,
        "I": 20,
        "J": 18,
        "K": 36,
        "L": 20,
        "M": 20,
        "N": 20,
        "O": 15,
        "P": 10,
        "Q": 22,
        "R": 20,
        "S": 23,
        "T": 22,
    }

    for column, width in widths.items():
        sheet.column_dimensions[column].width = width

    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions

    output = BytesIO()
    workbook.save(output)
    output.seek(0)

    filename = (
        f"employees_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    )

    return StreamingResponse(
        output,
        media_type=(
            "application/vnd.openxmlformats-officedocument."
            "spreadsheetml.sheet"
        ),
        headers={
            "Content-Disposition":
                f'attachment; filename="{filename}"'
        },
    )


# ==================================================
# STORAGE REQUESTS
# ==================================================

@router.get("/storage-requests")
def get_storage_requests(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    requests = (
        db.query(StorageRequest)
        .join(
            User,
            StorageRequest.employee_id == User.id,
        )
        .filter(
            StorageRequest.status == "pending",
            User.role == "employee",
        )
        .order_by(StorageRequest.created_at.desc())
        .all()
    )

    return [
        {
            "id": request.id,
            "employee_id": employee.id,
            "employee_code": employee.employee_id,
            "employee_name": employee.full_name,
            "email": employee.email,
            "department": employee.department,
            "requested_gb": request.requested_gb,
            "current_storage_gb": round(
                employee.storage_limit_bytes / (1024 ** 3),
                2,
            ),
            "created_at": request.created_at,
        }
        for request in requests
        for employee in [
            db.query(User)
            .filter(User.id == request.employee_id)
            .first()
        ]
        if employee
    ]


class StorageDecision(BaseModel):
    decision: str
    note: str | None = Field(
        default=None,
        max_length=500,
    )


@router.put("/storage-requests/{request_id}")
def decide_storage_request(
    request_id: int,
    data: StorageDecision,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    decision = data.decision.strip().lower()

    if decision not in {"approve", "decline"}:
        raise HTTPException(
            status_code=400,
            detail="Decision must be approve or decline.",
        )

    request = (
        db.query(StorageRequest)
        .filter(StorageRequest.id == request_id)
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=404,
            detail="Storage request not found.",
        )

    if request.status != "pending":
        raise HTTPException(
            status_code=400,
            detail="This storage request has already been processed.",
        )

    employee = (
        db.query(User)
        .filter(User.id == request.employee_id)
        .first()
    )

    if not employee or employee.role != "employee":
        raise HTTPException(
            status_code=400,
            detail="Storage requests are only available for employees.",
        )

    if employee.status != "active" or not employee.is_active:
        raise HTTPException(
            status_code=400,
            detail="Employee account is not active.",
        )

    request.admin_note = (
        data.note.strip()
        if data.note
        else None
    )
    request.decided_at = datetime.utcnow()

    if decision == "approve":
        additional_bytes = int(
            request.requested_gb * (1024 ** 3)
        )
        employee.storage_limit_bytes += additional_bytes
        request.status = "approved"
        message = (
            f"Storage request approved. "
            f"{request.requested_gb:g} GB added."
        )
    else:
        request.status = "declined"
        message = "Storage request declined."

    db.commit()

    return {
        "message": message,
        "status": request.status,
        "storage_limit_bytes": employee.storage_limit_bytes,
        "storage_gb": round(
            employee.storage_limit_bytes / (1024 ** 3),
            2,
        ),
    }


@router.get("/employees/{employee_id}")
def get_employee(
    employee_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    employee = (
        db.query(User)
        .filter(User.id == employee_id)
        .first()
    )

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee not found.",
        )

    return {
        "id": employee.id,
        "employee_id": employee.employee_id,
        "full_name": employee.full_name,
        "email": employee.email,
        "mobile_number": employee.mobile_number,
        "department": employee.department,
        "designation": employee.designation,
        "joining_date": employee.joining_date,
        "aadhaar_number": employee.aadhaar_number,
        "pan_number": employee.pan_number,
        "address": employee.address,
        "emergency_contact": employee.emergency_contact,
        "directory_name": employee.directory_name,
        "role": employee.role,
        "status": employee.status,
        "storage_limit_bytes": employee.storage_limit_bytes,
        "storage_gb": round(
            employee.storage_limit_bytes / (1024 ** 3),
            2,
        ),
        "created_at": employee.created_at,
    }


@router.put("/employees/{employee_id}/status")
def change_employee_status(
    employee_id: int,
    status: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    allowed_statuses = {
        "active",
        "inactive",
        "terminated",
    }

    if status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=(
                "Status must be active, inactive or terminated."
            ),
        )

    employee = (
        db.query(User)
        .filter(User.id == employee_id)
        .first()
    )

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee not found.",
        )

    if employee.role not in {
        "employee",
        "readonlyemployee",
    }:
        raise HTTPException(
            status_code=400,
            detail="Only employee accounts can be managed here.",
        )

    employee.status = status
    employee.is_active = status == "active"
    db.commit()

    return {
        "message": "Employee status updated.",
        "status": status,
    }


@router.get("/employees/{employee_id}/documents")
def get_employee_documents(
    employee_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    employee = (
        db.query(User)
        .filter(User.id == employee_id)
        .first()
    )

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee not found.",
        )

    documents = (
        db.query(Document)
        .filter(Document.owner_id == employee.id)
        .order_by(Document.uploaded_at.desc())
        .all()
    )

    return [
        {
            "id": document.id,
            "document_name": document.document_name,
            "category": document.category,
            "file_type": document.file_type,
            "file_size": document.file_size,
            "version": document.version,
            "uploaded_at": document.uploaded_at,
            "updated_at": document.updated_at,
            "is_archive": document.is_archive,
            "extracted": document.extracted,
            "parent_document_id": document.parent_document_id,
            "share_token": document.share_token,
        }
        for document in documents
    ]


