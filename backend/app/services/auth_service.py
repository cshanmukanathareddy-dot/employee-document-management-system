from datetime import datetime

from sqlalchemy.orm import Session

from app.models.user import User
from app.core.security import hash_password


def create_user(
    db: Session,
    data,
    role: str = "pending",
    status: str = "pending",
    is_active: bool = False,
):
    user = User(
        employee_id=data.employee_id,
        full_name=data.full_name,
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        mobile_number=data.mobile_number,
        department=data.department,
        designation=data.designation,
        joining_date=data.joining_date,
        aadhaar_number=data.aadhaar_number,
        pan_number=data.pan_number,
        address=data.address,
        emergency_contact=data.emergency_contact,
        directory_name=data.directory_name,
        role=role,
        status=status,
        is_active=is_active,
        terms_accepted=True,
        terms_accepted_at=datetime.utcnow(),
        storage_limit_bytes=(
            int(float(getattr(data, "storage_gb", 2)) * 1024 * 1024 * 1024)
            if role == "pending"
            else (
                int(float(getattr(data, "storage_gb", 2)) * 1024 * 1024 * 1024)
                if role == "employee"
                else 0
            )
        ),
        storage_limit_gb=(
            float(getattr(data, "storage_gb", 2))
            if role in {"pending", "employee"}
            else 0
        ),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user
