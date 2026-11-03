import smtplib
from email.message import EmailMessage
from app.core.config import settings


def send_password_reset_email(to_email: str, employee_name: str, reset_token: str) -> bool:
    """Send a password reset email if SMTP is configured.
    
    If SMTP credentials are not set in .env, returns False gracefully
    so the system operates locally or via in-app verification.
    """
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        return False

    base_url = (settings.FRONTEND_URL or "http://localhost:5173").rstrip("/")
    reset_url = f"{base_url}/forgot-password?token={reset_token}"

    msg = EmailMessage()
    msg["Subject"] = "EDMS - Password Reset Request"
    msg["From"] = settings.EMAILS_FROM
    msg["To"] = to_email

    msg.set_content(f"""Hello {employee_name},

We received a request to reset your password for your Employee Document Management System (EDMS) account.

Click the link below to set a new password:
{reset_url}

This link is valid for 15 minutes. If you did not request a password reset, please ignore this email or contact your administrator.

Best regards,
Employee Document Management System
""")

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as error:
        print(f"Warning: Failed to send password reset email to {to_email}: {error}")
        return False
