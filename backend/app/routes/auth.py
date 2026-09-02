from datetime import date, datetime

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user import User
from app.core.security import (
    create_access_token,
    decode_access_token,
    verify_password,
)
from app.services.auth_service import create_user
from app.services.storage_service import (
    create_employee_directory,
    validate_directory_name,
)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login"
)


class RegisterRequest(BaseModel):
    employee_id: str
    full_name: str
    email: EmailStr
    password: str = Field(min_length=6)
    mobile_number: str
    department: str
    designation: str
    joining_date: date
    aadhaar_number: str
    pan_number: str
    address: str
    emergency_contact: str
    directory_name: str

    storage_gb: float = Field(
        default=2,
        gt=0,
        le=2,
    )

    terms_accepted: bool = False


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/register")
def register(
    data: RegisterRequest,
    db: Session = Depends(get_db),
):
    if not data.terms_accepted:
        raise HTTPException(
            status_code=400,
            detail="You must accept the Terms and Conditions before registering.",
        )

    try:
        validate_directory_name(data.directory_name)
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    existing_email = (
        db.query(User)
        .filter(User.email == data.email.lower())
        .first()
    )

    if existing_email:
        raise HTTPException(
            status_code=400,
            detail="Email already registered.",
        )

    existing_employee = (
        db.query(User)
        .filter(User.employee_id == data.employee_id)
        .first()
    )

    if existing_employee:
        raise HTTPException(
            status_code=400,
            detail="Employee ID already exists.",
        )

    existing_directory = (
        db.query(User)
        .filter(User.directory_name == data.directory_name)
        .first()
    )

    if existing_directory:
        raise HTTPException(
            status_code=400,
            detail=(
                "Directory name already exists. "
                "Please choose another."
            ),
        )

    try:
        user = create_user(
            db,
            data,
            role="pending",
            status="pending",
            is_active=False,
        )

        create_employee_directory(user.directory_name)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to submit registration request.",
        )

    return {
        "message": (
            "Registration submitted successfully. "
            "Your account is pending administrator approval."
        ),
        "employee_id": user.employee_id,
        "directory_name": user.directory_name,
        "status": "pending",
    }


@router.post("/login")
def login(
    data: LoginRequest,
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.email == data.email.lower())
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if user.status == "pending":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Your registration request is pending "
                "administrator approval."
            ),
        )

    if user.status == "rejected" or user.role == "rejected":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Your registration request has been rejected "
                "by the administrator."
            ),
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled.",
        )

    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not active.",
        )

    token = create_access_token(user.id, user.role)

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "employee_id": user.employee_id,
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "department": user.department,
        "designation": user.designation,
        "directory_name": user.directory_name,
        "status": user.status,
    }


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")

        if not user_id:
            raise Exception()

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )

    user = (
        db.query(User)
        .filter(User.id == int(user_id))
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Account is disabled.",
        )

    if user.status != "active":
        raise HTTPException(
            status_code=403,
            detail="Account is not active.",
        )

    return user


def require_admin(
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Administrator access required.",
        )

    return current_user
