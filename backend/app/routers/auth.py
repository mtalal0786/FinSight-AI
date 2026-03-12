from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr
from app.core.database import get_db
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


class RegisterRequest(BaseModel):
    email: str
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    username: str


@router.post("/register", summary="Create a new account")
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await auth_service.get_user_by_email(db, data.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    existing_username = await auth_service.get_user_by_username(db, data.username)
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")

    user = await auth_service.create_user(db, data.email, data.username, data.password)
    return {"message": f"Account created successfully! Welcome, {user.username}"}


@router.post("/login", response_model=TokenResponse, summary="Login and get JWT token")
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    user = await auth_service.authenticate_user(db, form.username, form.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    token = auth_service.create_access_token({"sub": user.email, "username": user.username})
    return {"access_token": token, "token_type": "bearer", "username": user.username}


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    payload = auth_service.decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = await auth_service.get_user_by_email(db, payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user