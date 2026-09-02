from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.document import Document
from app.models.storage_request import StorageRequest
from app.models.user import User
from app.routes.auth import get_current_user


router = APIRouter(
    prefix="/storage",
    tags=["Storage"],
)

BYTES_PER_GB = 1024 ** 3


class StorageRequestCreate(BaseModel):
    additional_gb: float = Field(
        gt=0,
        le=1024,
    )


def get_storage_usage(
    user_id: int,
    db: Session,
):
    used = (
        db.query(
            func.coalesce(
                func.sum(Document.file_size),
                0,
            )
        )
        .filter(
            Document.owner_id == user_id
        )
        .scalar()
    )

    return int(used or 0)


@router.get("/me")
def get_my_storage(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "employee":
        return {
            "role": current_user.role,
            "storage_limit_bytes": 0,
            "storage_used_bytes": 0,
            "storage_remaining_bytes": 0,
            "storage_limit_gb": 0,
            "storage_used_gb": 0,
            "storage_remaining_gb": 0,
            "pending_request": None,
        }

    allocated = int(
        current_user.storage_limit_bytes or 0
    )
    used = get_storage_usage(
        current_user.id,
        db,
    )
    remaining = max(
        allocated - used,
        0,
    )

    pending = (
        db.query(StorageRequest)
        .filter(
            StorageRequest.employee_id == current_user.id,
            StorageRequest.status == "pending",
        )
        .order_by(
            StorageRequest.created_at.desc()
        )
        .first()
    )

    return {
        "role": current_user.role,
        "storage_limit_bytes": allocated,
        "storage_used_bytes": used,
        "storage_remaining_bytes": remaining,
        "storage_limit_gb": round(
            allocated / BYTES_PER_GB,
            2,
        ),
        "storage_used_gb": round(
            used / BYTES_PER_GB,
            4,
        ),
        "storage_remaining_gb": round(
            remaining / BYTES_PER_GB,
            4,
        ),
        "pending_request": (
            {
                "id": pending.id,
                "additional_gb": pending.requested_gb,
                "created_at": pending.created_at,
            }
            if pending
            else None
        ),
    }


@router.post("/request")
def request_more_storage(
    data: StorageRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "employee":
        raise HTTPException(
            status_code=403,
            detail=(
                "Only employees can request additional storage."
            ),
        )

    if current_user.status != "active" or not current_user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Account is not active.",
        )

    existing = (
        db.query(StorageRequest)
        .filter(
            StorageRequest.employee_id == current_user.id,
            StorageRequest.status == "pending",
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail=(
                "You already have a pending storage request."
            ),
        )

    request = StorageRequest(
        employee_id=current_user.id,
        requested_gb=data.additional_gb,
        status="pending",
    )

    db.add(request)
    db.commit()
    db.refresh(request)

    return {
        "message": (
            "Storage request submitted successfully. "
            "An administrator will review it."
        ),
        "request_id": request.id,
        "additional_gb": request.requested_gb,
        "status": request.status,
    }
