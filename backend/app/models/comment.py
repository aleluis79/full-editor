"""Comment SQLAlchemy model and Pydantic schemas."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


def _generate_id() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CommentModel(Base):
    """SQLAlchemy model for comments on document blocks."""

    __tablename__ = "comments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_generate_id)
    document_id: Mapped[str] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    block_id: Mapped[str] = mapped_column(String(36), nullable=False)
    author_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    parent_id = mapped_column(
        String(36), ForeignKey("comments.id", ondelete="CASCADE"), nullable=True
    )
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )


# ── Pydantic schemas for the API ──────────────────────────────────

from pydantic import BaseModel  # noqa: E402


class CommentCreate(BaseModel):
    """Schema for creating a top-level comment on a block."""
    block_id: str
    content: str
    parent_id: Optional[str] = None


class CommentUpdate(BaseModel):
    """Schema for updating a comment's content or resolved status."""
    content: Optional[str] = None
    resolved: Optional[bool] = None


class CommentResponse(BaseModel):
    """Schema for comment response with nested replies."""
    id: str
    document_id: str
    block_id: str
    author_id: str
    author_display_name: str = ""
    author_email: str = ""
    content: str
    parent_id: Optional[str] = None
    resolved: bool = False
    created_at: str
    updated_at: str
    replies: list["CommentResponse"] = []
