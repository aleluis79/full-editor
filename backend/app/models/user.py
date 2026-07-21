"""User SQLAlchemy model and Pydantic schemas."""
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


class UserModel(Base):
    """SQLAlchemy model for authenticated users, auto-provisioned from Keycloak JWT."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_generate_id)
    keycloak_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


# ── Pydantic schemas for the API ──────────────────────────────────

from pydantic import BaseModel  # noqa: E402


class UserResponse(BaseModel):
    """Schema for user response."""
    id: str
    keycloak_id: str
    email: str
    display_name: str
    created_at: str
