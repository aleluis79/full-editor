"""CustomWord SQLAlchemy model and Pydantic schemas.

Stores per-user dictionary words that the spell checker should NOT flag
as misspelled. Scoped by user_id from Keycloak JWT and language code.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


def _generate_id() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CustomWordModel(Base):
    """SQLAlchemy model for per-user custom dictionary words."""

    __tablename__ = "custom_words"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_generate_id)
    user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    word: Mapped[str] = mapped_column(String(255), nullable=False)
    lang: Mapped[str] = mapped_column(String(10), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


# ── Pydantic schemas for the API ──────────────────────────────────

from pydantic import BaseModel  # noqa: E402


class CustomWordCreate(BaseModel):
    """Schema for creating a custom dictionary word."""
    word: str
    lang: str


class CustomWordResponse(BaseModel):
    """Schema for custom word response."""
    id: str
    user_id: str
    word: str
    lang: str
    created_at: str
