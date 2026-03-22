import os
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
from app.core.config import settings

from app.core.config import settings

conf = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
)


async def send_reset_email(email: str, reset_token: str, username: str):
    """Send password reset email."""
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"

    html_body = f"""
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="font-size: 24px; font-weight: 600; margin-bottom: 8px;">Reset your password</h2>
      <p style="color: #6b7280; margin-bottom: 24px;">Hi {username}, click the button below to reset your FinSight AI password. This link expires in 1 hour.</p>
      <a href="{reset_link}"
         style="display: inline-block; background: #10b981; color: white; padding: 12px 24px;
                border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
        Reset password
      </a>
      <p style="color: #9ca3af; font-size: 13px; margin-top: 24px;">
        If you didn't request this, ignore this email. The link expires in 1 hour.
      </p>
      <p style="color: #d1d5db; font-size: 12px; margin-top: 8px;">
        Or copy this link: {reset_link}
      </p>
    </div>
    """

    message = MessageSchema(
        subject="Reset your FinSight AI password",
        recipients=[email],
        body=html_body,
        subtype=MessageType.html,
    )

    fm = FastMail(conf)
    await fm.send_message(message)


async def send_welcome_email(email: str, username: str):
    """Send welcome email after registration."""
    html_body = f"""
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="font-size: 24px; font-weight: 600; margin-bottom: 8px;">Welcome to FinSight AI</h2>
      <p style="color: #6b7280;">Hi {username}, your account is ready. Start by uploading a financial PDF or asking about any stock.</p>
      <p style="color: #9ca3af; font-size: 13px; margin-top: 24px;">FinSight AI — AI-powered financial intelligence</p>
    </div>
    """
    message = MessageSchema(
        subject="Welcome to FinSight AI",
        recipients=[email],
        body=html_body,
        subtype=MessageType.html,
    )
    fm = FastMail(conf)
    try:
        await fm.send_message(message)
    except Exception:
        pass  # Welcome email is non-critical