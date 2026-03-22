import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.db_models import User
from app.services.auth_service import (
    authenticate_user, create_user, create_access_token,
    decode_token, get_user_by_email, get_user_by_username,
    hash_password, verify_password,
)

router = APIRouter(prefix="/auth", tags=["Auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


# ── Dependency ────────────────────────────────────────────────────────────────

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_token(token) if token else None
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await get_user_by_email(db, payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ── Request/Response Models ───────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    username: str
    email: str
    display_name: Optional[str] = None
    avatar_color: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None
    avatar_color: Optional[str] = None
    username: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# ── In-memory reset token store (use Redis in production) ────────────────────
# token -> {email, expires}
_reset_tokens: dict[str, dict] = {}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register")
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if len(request.username) < 3:
        raise HTTPException(400, "Username must be at least 3 characters")
    if len(request.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if await get_user_by_email(db, request.email):
        raise HTTPException(400, "Email already registered")
    if await get_user_by_username(db, request.username):
        raise HTTPException(400, "Username already taken")

    user = await create_user(db, request.email, request.username, request.password)

    # Send welcome email (non-blocking, non-critical)
    try:
        from app.core.email import send_welcome_email
        import asyncio
        asyncio.create_task(send_welcome_email(user.email, user.username))
    except Exception:
        pass

    return {"message": "Account created successfully", "username": user.username}


@router.post("/login", response_model=LoginResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    # OAuth2 sends username field — we accept both email and username
    user = await authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email/username or password",
        )

    token = create_access_token({"sub": user.email})
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        username=user.username,
        email=user.email,
        display_name=getattr(user, "display_name", None) or user.username,
        avatar_color=getattr(user, "avatar_color", None) or "#10b981",
    )


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "display_name": getattr(current_user, "display_name", None) or current_user.username,
        "avatar_color": getattr(current_user, "avatar_color", None) or "#10b981",
        "created_at": current_user.created_at.isoformat(),
    }


@router.patch("/profile")
async def update_profile(
    request: UpdateProfileRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if request.username and request.username != current_user.username:
        existing = await get_user_by_username(db, request.username)
        if existing:
            raise HTTPException(400, "Username already taken")
        current_user.username = request.username

    if request.display_name is not None:
        if hasattr(current_user, "display_name"):
            current_user.display_name = request.display_name

    if request.avatar_color is not None:
        if hasattr(current_user, "avatar_color"):
            current_user.avatar_color = request.avatar_color

    await db.commit()
    await db.refresh(current_user)
    return {
        "message": "Profile updated",
        "username": current_user.username,
        "display_name": getattr(current_user, "display_name", None),
        "avatar_color": getattr(current_user, "avatar_color", None),
    }


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(400, "Current password is incorrect")
    if len(request.new_password) < 6:
        raise HTTPException(400, "New password must be at least 6 characters")
    current_user.hashed_password = hash_password(request.new_password)
    await db.commit()
    return {"message": "Password changed successfully"}


@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    user = await get_user_by_email(db, request.email)
    # Always return success — don't reveal if email exists
    if user:
        token = secrets.token_urlsafe(32)
        _reset_tokens[token] = {
            "email": request.email,
            "expires": datetime.utcnow() + timedelta(hours=1),
        }
        try:
            from app.core.email import send_reset_email
            await send_reset_email(request.email, token, user.username)
        except Exception as e:
            print(f"⚠️ Reset email failed: {e}")
            # In dev mode — print the reset link so you can test without email
            import os
            if os.getenv("DEBUG", "False").lower() == "true":
                frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
                print(f"🔗 DEV RESET LINK: {frontend_url}/reset-password?token={token}")

    return {"message": "If that email exists, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    token_data = _reset_tokens.get(request.token)
    if not token_data:
        raise HTTPException(400, "Invalid or expired reset token")
    if datetime.utcnow() > token_data["expires"]:
        del _reset_tokens[request.token]
        raise HTTPException(400, "Reset token has expired. Please request a new one.")
    if len(request.new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    user = await get_user_by_email(db, token_data["email"])
    if not user:
        raise HTTPException(400, "User not found")

    user.hashed_password = hash_password(request.new_password)
    await db.commit()
    del _reset_tokens[request.token]

    return {"message": "Password reset successfully. You can now log in."}


@router.post("/verify-token")
async def verify_token(current_user: User = Depends(get_current_user)):
    """Check if the stored token is still valid — used on app load."""
    return {
        "valid": True,
        "username": current_user.username,
        "email": current_user.email,
        "display_name": getattr(current_user, "display_name", None) or current_user.username,
        "avatar_color": getattr(current_user, "avatar_color", None) or "#10b981",
    }