"""Document SQLAlchemy model and Pydantic schemas."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


def _generate_id() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DocumentModel(Base):
    """SQLAlchemy model for persisted documents."""

    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_generate_id)
    title: Mapped[str] = mapped_column(String(255), default="Untitled Document")
    content: Mapped[str] = mapped_column(Text, default="{}")
    owner_id = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


# ── Pydantic schemas for the API ──────────────────────────────────

from pydantic import BaseModel, Field


class DocumentCreate(BaseModel):
    """Schema for creating a document."""
    title: str = "Untitled Document"
    content: dict = Field(default_factory=dict)


class DocumentUpdate(BaseModel):
    """Schema for updating a document."""
    title: Optional[str] = None
    content: Optional[dict] = None


class DocumentResponse(BaseModel):
    """Schema for document response."""
    id: str
    title: str
    content: dict
    created_at: str
    updated_at: str
