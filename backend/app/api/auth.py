from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..core.auth import get_current_user
from ..core.database import get_db
from ..models.user import UserModel, UserResponse

router = APIRouter(prefix="/api", tags=["auth"])


def _user_to_response(user: UserModel) -> UserResponse:
    return UserResponse(
        id=user.id,
        keycloak_id=user.keycloak_id,
        email=user.email,
        display_name=user.display_name,
        created_at=user.created_at.isoformat(),
    )


@router.get("/auth/me", response_model=UserResponse)
def get_current_user_info(user: UserModel = Depends(get_current_user)):
    """Return the currently authenticated user's info."""
    return _user_to_response(user)


@router.get("/users/search", response_model=List[UserResponse])
def search_users(
    q: str = Query(..., min_length=1, description="Search query (email or display_name)"),
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    """Search users by email or display_name (excludes current user)."""
    users = (
        db.query(UserModel)
        .filter(
            UserModel.id != user.id,
            (UserModel.email.ilike(f"%{q}%")) | (UserModel.display_name.ilike(f"%{q}%")),
        )
        .limit(10)
        .all()
    )
    return [_user_to_response(u) for u in users]
