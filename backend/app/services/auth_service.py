import bcrypt
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.models.db_models import User

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    """Hash password using bcrypt directly — no passlib."""
    password_bytes = password[:72].encode("utf-8")  # bcrypt max 72 bytes
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify password against hash."""
    try:
        return bcrypt.checkpw(
            plain[:72].encode("utf-8"),
            hashed.encode("utf-8")
        )
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_username(db: AsyncSession, username: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def create_user(
    db: AsyncSession, email: str, username: str, password: str
) -> User:
    user = User(
        email=email,
        username=username,
        hashed_password=hash_password(password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(
    db: AsyncSession, identifier: str, password: str
) -> Optional[User]:

    user = await get_user_by_email(db, identifier)

    if not user:
        user = await get_user_by_username(db, identifier)

    if not user or not verify_password(password, user.hashed_password):
        return None

    return user