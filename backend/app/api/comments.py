"""Comment API router — CRUD + resolve for document comments."""
from fastapi import APIRouter, Depends, HTTPException
from typing import List

from sqlalchemy.orm import Session

from ..models.comment import CommentCreate, CommentUpdate, CommentResponse
from ..models.user import UserModel
from ..core.database import get_db
from ..core.auth import get_current_user
from ..core import comment_storage as store
from .documents import router as documents_router

router = APIRouter(prefix="/api", tags=["comments"])

# We can't use the existing documents router's prefix,
# so we define endpoints with the full path directly.


@router.get(
    "/documents/{doc_id}/comments",
    response_model=List[CommentResponse],
)
def list_comments(
    doc_id: str,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    """List all comments for a document with nested replies."""
    try:
        return store.list_comments(db, doc_id, user)
    except PermissionError:
        raise HTTPException(status_code=403, detail="You do not have access to this document")


@router.post(
    "/documents/{doc_id}/comments",
    response_model=CommentResponse,
    status_code=201,
)
def create_comment(
    doc_id: str,
    data: CommentCreate,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    """Create a new top-level comment on a block."""
    try:
        return store.create_comment(db, doc_id, data, user)
    except PermissionError:
        raise HTTPException(status_code=403, detail="You do not have access to this document")


@router.post(
    "/documents/{doc_id}/comments/{comment_id}/replies",
    response_model=CommentResponse,
    status_code=201,
)
def create_reply(
    doc_id: str,
    comment_id: str,
    data: CommentCreate,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    """Create a reply to an existing comment."""
    try:
        return store.create_reply(db, doc_id, comment_id, data, user)
    except PermissionError:
        raise HTTPException(status_code=403, detail="You do not have access to this document")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put(
    "/documents/{doc_id}/comments/{comment_id}",
    response_model=CommentResponse,
)
def update_comment(
    doc_id: str,
    comment_id: str,
    data: CommentUpdate,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    """Update a comment's content or resolved status (author only)."""
    try:
        return store.update_comment(db, comment_id, data, user)
    except PermissionError:
        raise HTTPException(status_code=403, detail="Only the comment author can update")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete(
    "/documents/{doc_id}/comments/{comment_id}",
)
def delete_comment(
    doc_id: str,
    comment_id: str,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    """Delete a comment (author or document owner)."""
    try:
        return store.delete_comment(db, comment_id, user)
    except PermissionError:
        raise HTTPException(
            status_code=403, detail="Only the comment author or document owner can delete"
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch(
    "/documents/{doc_id}/comments/{comment_id}/resolve",
    response_model=CommentResponse,
)
def resolve_comment(
    doc_id: str,
    comment_id: str,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    """Toggle the resolved status of a comment (author or document owner)."""
    try:
        return store.toggle_resolved(db, comment_id, user)
    except PermissionError:
        raise HTTPException(
            status_code=403, detail="Only the comment author or document owner can resolve"
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
