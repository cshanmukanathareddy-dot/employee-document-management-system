from datetime import date, datetime, timedelta
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user import User
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.services.auth_service import create_user
from app.services.storage_service import create_employee_directory, validate_directory_name
from app.services.email_service import send_password_reset_email
from app.services.password_excel_service import sync_password_documentation_file

router = APIRouter(prefix="/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


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
    storage_gb: float = Field(default=2, gt=0, le=2)
    terms_accepted: bool = False


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    employee_id: str | None = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=6)
    confirm_password: str = Field(min_length=6)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)
    confirm_password: str = Field(min_length=6)


@router.post("/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    if not data.terms_accepted:
        raise HTTPException(
            status_code=400,
            detail="You must accept the Terms and Conditions before registering.",
        )

    try:
        validate_directory_name(data.directory_name)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    if db.query(User).filter(User.email == data.email.lower()).first():
        raise HTTPException(status_code=400, detail="Email already registered.")

    if db.query(User).filter(User.employee_id == data.employee_id).first():
        raise HTTPException(status_code=400, detail="Employee ID already exists.")

    if db.query(User).filter(User.directory_name == data.directory_name).first():
        raise HTTPException(status_code=400, detail="Directory name already exists. Please choose another.")

    try:
        user = create_user(db, data, role="pending", status="pending", is_active=False)
        create_employee_directory(user.directory_name)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Unable to submit registration request.")

    return {
        "message": "Registration submitted successfully. Your account is pending administrator approval.",
        "employee_id": user.employee_id,
        "directory_name": user.directory_name,
        "status": "pending",
    }


@router.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.lower()).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if user.status == "pending":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your registration request is pending administrator approval.",
        )

    if user.status == "rejected" or user.role == "rejected":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your registration request has been rejected by the administrator.",
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


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("No user ID in token")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled.")

    if user.status != "active":
        raise HTTPException(status_code=403, detail="Account is not active.")

    return user


def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Administrator access required.")
    return current_user


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    normalized_email = data.email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == normalized_email).first()

    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email address.")

    if user.status == "pending":
        raise HTTPException(status_code=403, detail="Your registration request is still pending administrator approval.")

    if user.status == "rejected" or user.role == "rejected":
        raise HTTPException(status_code=403, detail="This account has been rejected by the administrator.")

    if not user.is_active or user.status != "active":
        raise HTTPException(status_code=403, detail="This account is currently inactive or disabled.")

    token = secrets.token_urlsafe(32)
    user.reset_password_token = token
    user.reset_password_expires_at = datetime.utcnow() + timedelta(minutes=15)
    db.commit()

    email_sent = send_password_reset_email(user.email, user.full_name, token)
    message = (
        "A password reset link has been sent to your email. You can also proceed below."
        if email_sent
        else "Identity verified successfully. Please enter your new password."
    )

    return {
        "message": message,
        "email_sent": email_sent,
        "reset_token": token,
        "email": user.email,
        "employee_id": user.employee_id,
    }


@router.get("/verify-reset-token/{token}")
def verify_reset_token(token: str, db: Session = Depends(get_db)):
    user = (
        db.query(User)
        .filter(
            User.reset_password_token == token,
            User.reset_password_expires_at > datetime.utcnow(),
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=400,
            detail="The password reset link or token is invalid or has expired.",
        )

    return {
        "valid": True,
        "email": user.email,
        "employee_id": user.employee_id,
    }


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    if data.new_password != data.confirm_password:
        raise HTTPException(status_code=400, detail="New password and confirm password do not match.")

    user = (
        db.query(User)
        .filter(
            User.reset_password_token == data.token,
            User.reset_password_expires_at > datetime.utcnow(),
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=400,
            detail="The password reset token is invalid or has expired. Please request a new one.",
        )

    user.password_hash = hash_password(data.new_password)
    user.password_reference = data.new_password
    user.reset_password_token = None
    user.reset_password_expires_at = None
    db.commit()

    try:
        sync_password_documentation_file(db)
    except Exception as sync_err:
        print("Password documentation sync notice on reset:", sync_err)

    return {
        "message": "Your password has been reset successfully. You can now log in with your new password.",
    }


@router.post("/change-password")
@router.put("/change-password")
def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    if data.new_password != data.confirm_password:
        raise HTTPException(status_code=400, detail="New password and confirm password do not match.")

    if verify_password(data.new_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="New password cannot be the same as your current password.")

    current_user.password_hash = hash_password(data.new_password)
    current_user.password_reference = data.new_password
    db.commit()

    try:
        sync_password_documentation_file(db)
    except Exception as sync_err:
        print("Password documentation sync notice on change:", sync_err)

    return {"message": "Password changed successfully."}
