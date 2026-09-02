from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user import User
from app.routes.auth import get_current_user


router = APIRouter(
    prefix="/employees",
    tags=["Employees"]
)


class UpdateProfileRequest(BaseModel):

    mobile_number: str
    department: str
    designation: str
    address: str
    emergency_contact: str


@router.get("/me")
def get_my_profile(
    current_user: User = Depends(get_current_user)
):

    return {
        "id": current_user.id,
        "employee_id": current_user.employee_id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "mobile_number": current_user.mobile_number,
        "department": current_user.department,
        "designation": current_user.designation,
        "joining_date": current_user.joining_date,
        "aadhaar_number": current_user.aadhaar_number,
        "pan_number": current_user.pan_number,
        "address": current_user.address,
        "emergency_contact": current_user.emergency_contact,
        "directory_name": current_user.directory_name,
        "role": current_user.role,
        "status": current_user.status,
        "created_at": current_user.created_at
    }


@router.put("/me")
def update_my_profile(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    if current_user.status != "active":

        raise HTTPException(
            status_code=403,
            detail=(
                "Profile modifications are disabled "
                "for inactive or terminated employees."
            )
        )

    current_user.mobile_number = data.mobile_number
    current_user.department = data.department
    current_user.designation = data.designation
    current_user.address = data.address
    current_user.emergency_contact = (
        data.emergency_contact
    )

    db.commit()
    db.refresh(current_user)

    return {
        "message": "Profile updated successfully."
    }