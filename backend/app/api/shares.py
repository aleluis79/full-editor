"""Share CRUD endpoints — create, list, revoke document shares."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..models.document import DocumentModel
from ..models.user import UserModel
from ..models.sharing import DocumentShareModel, ShareCreate, ShareResponse
from ..core.database import get_db
from ..core.auth import get_current_user

router = APIRouter(prefix="/api", tags=["shares"])


def _share_to_response(share: DocumentShareModel, db: Session | None = None) -> ShareResponse:
    email = ""
    display_name = ""
    if db:
        target = db.query(UserModel).filter(UserModel.id == share.shared_with_user_id).first()
        if target:
            email = target.email
            display_name = target.display_name
    return ShareResponse(
        id=share.id,
        document_id=share.document_id,
        shared_with_user_id=share.shared_with_user_id,
        shared_with_email=email,
        shared_with_display_name=display_name,
        permission=share.permission,
        created_at=share.created_at.isoformat(),
    )


@router.get("/shares/", response_model=List[ShareResponse])
def list_shares(
    document_id: str,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    """List all shares for a document the current user owns."""
    doc = db.query(DocumentModel).filter(DocumentModel.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only the document owner can list shares")

    shares = (
        db.query(DocumentShareModel)
        .filter(DocumentShareModel.document_id == document_id)
        .all()
    )
    return [_share_to_response(s, db) for s in shares]


@router.post("/shares/", response_model=ShareResponse, status_code=201)
def create_share(
    data: ShareCreate,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    """Share a document with another user (owner only)."""
    doc = db.query(DocumentModel).filter(DocumentModel.id == data.document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only the document owner can share")

    # Check if share already exists
    existing = (
        db.query(DocumentShareModel)
        .filter(
            DocumentShareModel.document_id == data.document_id,
            DocumentShareModel.shared_with_user_id == data.shared_with_user_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Share already exists for this user")

    # Verify target user exists
    target_user = (
        db.query(UserModel)
        .filter(UserModel.id == data.shared_with_user_id)
        .first()
    )
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")

    share = DocumentShareModel(
        document_id=data.document_id,
        shared_with_user_id=data.shared_with_user_id,
        permission=data.permission,
    )
    db.add(share)
    db.commit()
    db.refresh(share)
    return _share_to_response(share)


@router.delete("/shares/{share_id}")
def revoke_share(
    share_id: str,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    """Revoke a document share (owner only)."""
    share = (
        db.query(DocumentShareModel)
        .filter(DocumentShareModel.id == share_id)
        .first()
    )
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    doc = db.query(DocumentModel).filter(DocumentModel.id == share.document_id).first()
    if not doc or doc.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only the document owner can revoke shares")

    db.delete(share)
    db.commit()
    return {"message": "Share revoked"}
