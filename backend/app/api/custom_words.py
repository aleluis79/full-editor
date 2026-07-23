"""Custom words API router — CRUD for per-user spell checker dictionary."""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List

from sqlalchemy.orm import Session

from ..models.custom_word import CustomWordCreate, CustomWordResponse, CustomWordModel, _generate_id, _utcnow
from ..models.user import UserModel
from ..core.database import get_db
from ..core.auth import get_current_user

router = APIRouter(prefix="/api", tags=["custom-words"])


@router.get(
    "/v1/custom-words",
    response_model=List[CustomWordResponse],
)
def list_custom_words(
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    """List all custom dictionary words for the current user."""
    words = (
        db.query(CustomWordModel)
        .filter(CustomWordModel.user_id == user.id)
        .order_by(CustomWordModel.created_at)
        .all()
    )
    return [
        CustomWordResponse(
            id=w.id,
            user_id=w.user_id,
            word=w.word,
            lang=w.lang,
            created_at=w.created_at.isoformat(),
        )
        for w in words
    ]


@router.post(
    "/v1/custom-words",
    response_model=CustomWordResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_custom_word(
    data: CustomWordCreate,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    """Add a word to the current user's custom dictionary."""
    word = CustomWordModel(
        id=_generate_id(),
        user_id=user.id,
        word=data.word,
        lang=data.lang,
        created_at=_utcnow(),
    )
    db.add(word)
    db.commit()
    db.refresh(word)
    return CustomWordResponse(
        id=word.id,
        user_id=word.user_id,
        word=word.word,
        lang=word.lang,
        created_at=word.created_at.isoformat(),
    )


@router.delete(
    "/v1/custom-words/{word_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_custom_word(
    word_id: str,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    """Remove a word from the current user's custom dictionary."""
    word = (
        db.query(CustomWordModel)
        .filter(CustomWordModel.id == word_id)
        .first()
    )
    if not word:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Custom word not found",
        )
    if word.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Custom word not found",
        )
    db.delete(word)
    db.commit()
