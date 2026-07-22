"""Comment persistence layer backed by SQLAlchemy sessions."""
from typing import Optional

from sqlalchemy.orm import Session

from ..models.comment import (
    CommentModel,
    CommentCreate,
    CommentUpdate,
    CommentResponse,
)
from ..models.user import UserModel
from ..models.document import DocumentModel
from .storage import _has_access


def _comment_to_response(comment: CommentModel) -> CommentResponse:
    """Convert a CommentModel to a CommentResponse with author info."""
    return CommentResponse(
        id=comment.id,
        document_id=comment.document_id,
        block_id=comment.block_id,
        author_id=comment.author_id,
        author_display_name="",
        author_email="",
        content=comment.content,
        parent_id=comment.parent_id,
        resolved=comment.resolved,
        created_at=comment.created_at.isoformat(),
        updated_at=comment.updated_at.isoformat(),
    )


def _enrich_author(db: Session, response: CommentResponse) -> CommentResponse:
    """Fill in author_display_name and author_email from the users table."""
    author = db.query(UserModel).filter(UserModel.id == response.author_id).first()
    if author:
        response.author_display_name = author.display_name
        response.author_email = author.email
    return response


def _get_document_owner_id(db: Session, doc_id: str) -> Optional[str]:
    """Return the owner_id of a document, or None if not found."""
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    return doc.owner_id if doc else None


def _nest_replies(comments: list[CommentResponse]) -> list[CommentResponse]:
    """Build a flat two-level tree: top-level comments with ALL descendants
    (replies, replies-to-replies, etc.) flattened into their ``replies`` list
    so the frontend only needs to render two levels.

    Two-pass approach: first index by id, then walk descendants up to the
    top-level parent.
    """
    by_id: dict[str, CommentResponse] = {}
    top_level: list[CommentResponse] = []

    for c in comments:
        c.replies = []
        by_id[c.id] = c

    for c in comments:
        if c.parent_id and c.parent_id in by_id:
            # Walk up to find the top-level ancestor
            ancestor = c
            while ancestor.parent_id and ancestor.parent_id in by_id:
                ancestor = by_id[ancestor.parent_id]
            ancestor.replies.append(c)
        else:
            top_level.append(c)

    # Sort replies by created_at
    for tl in top_level:
        tl.replies.sort(key=lambda r: r.created_at)

    return top_level


def list_comments(db: Session, doc_id: str, user: UserModel) -> list[CommentResponse]:
    """Return all comments for a document with nested replies.

    Requires read access to the document.
    """
    if not _has_access(db, doc_id, user, require_write=False):
        raise PermissionError("You do not have access to this document")

    rows = (
        db.query(CommentModel)
        .filter(CommentModel.document_id == doc_id)
        .order_by(CommentModel.created_at.asc())
        .all()
    )
    responses = [_enrich_author(db, _comment_to_response(r)) for r in rows]
    return _nest_replies(responses)


def create_comment(
    db: Session, doc_id: str, data: CommentCreate, user: UserModel
) -> CommentResponse:
    """Create a new top-level comment on a block.

    Requires read access to the document.
    """
    if not _has_access(db, doc_id, user, require_write=False):
        raise PermissionError("You do not have access to this document")

    comment = CommentModel(
        document_id=doc_id,
        block_id=data.block_id,
        author_id=user.id,
        content=data.content,
        parent_id=None,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    response = _comment_to_response(comment)
    return _enrich_author(db, response)


def create_reply(
    db: Session, doc_id: str, parent_id: str, data: CommentCreate, user: UserModel
) -> CommentResponse:
    """Create a reply to an existing comment.

    Requires read access to the document.
    """
    if not _has_access(db, doc_id, user, require_write=False):
        raise PermissionError("You do not have access to this document")

    # Verify parent exists
    parent = db.query(CommentModel).filter(CommentModel.id == parent_id).first()
    if not parent:
        raise ValueError("Parent comment not found")

    comment = CommentModel(
        document_id=doc_id,
        block_id=data.block_id,
        author_id=user.id,
        content=data.content,
        parent_id=parent_id,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    response = _comment_to_response(comment)
    return _enrich_author(db, response)


def update_comment(
    db: Session, comment_id: str, data: CommentUpdate, user: UserModel
) -> CommentResponse:
    """Update a comment's content or resolved status. Only the author can update."""
    comment = db.query(CommentModel).filter(CommentModel.id == comment_id).first()
    if not comment:
        raise ValueError("Comment not found")

    if comment.author_id != user.id:
        raise PermissionError("Only the comment author can update")

    if data.content is not None:
        comment.content = data.content
    if data.resolved is not None:
        comment.resolved = data.resolved

    db.commit()
    db.refresh(comment)
    response = _comment_to_response(comment)
    return _enrich_author(db, response)


def delete_comment(db: Session, comment_id: str, user: UserModel) -> dict:
    """Delete a comment. Author or document owner can delete."""
    comment = db.query(CommentModel).filter(CommentModel.id == comment_id).first()
    if not comment:
        raise ValueError("Comment not found")

    # Check: comment author OR document owner
    if comment.author_id != user.id:
        owner_id = _get_document_owner_id(db, comment.document_id)
        if owner_id != user.id:
            raise PermissionError("Only the comment author or document owner can delete")

    # Delete replies first (the ORM doesn't auto-cascade without relationship)
    db.query(CommentModel).filter(CommentModel.parent_id == comment_id).delete()
    db.delete(comment)
    db.commit()
    return {"message": "Comment deleted"}


def toggle_resolved(db: Session, comment_id: str, user: UserModel) -> CommentResponse:
    """Toggle the resolved status of a comment. Only the comment author can toggle."""
    comment = db.query(CommentModel).filter(CommentModel.id == comment_id).first()
    if not comment:
        raise ValueError("Comment not found")

    if comment.author_id != user.id:
        raise PermissionError("Only the comment author can resolve")

    comment.resolved = not comment.resolved
    db.commit()
    db.refresh(comment)
    response = _comment_to_response(comment)
    return _enrich_author(db, response)
