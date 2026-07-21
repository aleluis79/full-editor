"""DocumentShare SQLAlchemy model and Pydantic schemas."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


def _generate_id() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DocumentShareModel(Base):
    """SQLAlchemy model for document sharing between users."""

    __tablename__ = "document_shares"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_generate_id)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), nullable=False)
    shared_with_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    permission: Mapped[str] = mapped_column(String(16), nullable=False)  # "read" | "write"
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


# ── Pydantic schemas for the API ──────────────────────────────────

from pydantic import BaseModel, Field  # noqa: E402


class ShareCreate(BaseModel):
    """Schema for creating a share."""
    document_id: str
    shared_with_user_id: str
    permission: str = Field(pattern=r"^(read|write)$")


class ShareResponse(BaseModel):
    """Schema for share response."""
    id: str
    document_id: str
    shared_with_user_id: str
    shared_with_email: str = ""
    shared_with_display_name: str = ""
    permission: str
    created_at: str


class SharedWithMeDocument(BaseModel):
    """Schema for a shared document in the shared-with-me list."""
    id: str
    document_id: str
    title: str
    permission: str
    shared_by_user_id: str
    shared_by_display_name: str
    created_at: str
