from datetime import datetime
from sqlalchemy import String, DateTime, Text, ForeignKey, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


# ✅ USER MODEL
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )

    username: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False
    )

    hashed_password: Mapped[str] = mapped_column(
        String(255), nullable=False
    )

    # ✅ NEW FIELDS
    display_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )

    avatar_color: Mapped[str] = mapped_column(
        String(20), default="#10b981"
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    # ✅ RELATIONSHIPS
    queries: Mapped[list["QueryHistory"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    documents: Mapped[list["DocumentRecord"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


# ✅ QUERY HISTORY MODEL
class QueryHistory(Base):
    __tablename__ = "query_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )

    # ✅ NEW FIELD (conversation grouping)
    conversation_id: Mapped[str | None] = mapped_column(
        String(255), index=True, nullable=True
    )

    query: Mapped[str] = mapped_column(Text, nullable=False)

    answer: Mapped[str] = mapped_column(
        Text, default=""
    )

    tools_used: Mapped[str] = mapped_column(
        String(500), default=""
    )

    reasoning: Mapped[str] = mapped_column(
        Text, default=""
    )

    llm_calls: Mapped[int] = mapped_column(
        Integer, default=0
    )

    # ✅ NEW FIELD (active documents tracking)
    doc_ids: Mapped[str] = mapped_column(
        Text, default=""
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    # ✅ RELATIONSHIP
    user: Mapped["User"] = relationship(
        back_populates="queries"
    )


# ✅ DOCUMENT MODEL
class DocumentRecord(Base):
    __tablename__ = "document_records"  # ✅ FIXED (was "documents")

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )

    doc_id: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False
    )

    filename: Mapped[str] = mapped_column(
        String(500), nullable=False
    )

    pages: Mapped[int] = mapped_column(
        Integer, default=0
    )

    chunks: Mapped[int] = mapped_column(
        Integer, default=0
    )

    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    # ✅ RELATIONSHIP
    user: Mapped["User"] = relationship(
        back_populates="documents"
    )