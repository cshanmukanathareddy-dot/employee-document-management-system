from datetime import datetime
from sqlalchemy.orm import Session

from app.models.user import User
from app.core.security import hash_password
from app.services.password_excel_service import sync_password_documentation_file


def create_user(
    db: Session,
    data,
    role: str = "pending",
    status: str = "pending",
    is_active: bool = False,
):
    raw_password = getattr(data, "password", None)
    storage_gb = float(getattr(data, "storage_gb", 2)) if role in {"pending", "employee"} else 0.0
    storage_bytes = int(storage_gb * (1024 ** 3))

    user = User(
        employee_id=data.employee_id,
        full_name=data.full_name,
        email=data.email.lower(),
        password_hash=hash_password(raw_password) if raw_password else "",
        password_reference=raw_password,
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
        storage_limit_bytes=storage_bytes,
        storage_limit_gb=storage_gb,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    try:
        sync_password_documentation_file(db)
    except Exception as sync_err:
        print("Password documentation sync error on create_user:", sync_err)

    return user
