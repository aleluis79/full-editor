"""Document persistence layer backed by SQLAlchemy sessions."""
import json
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import or_

from ..models.document import DocumentModel, DocumentCreate, DocumentUpdate, DocumentResponse
from ..models.user import UserModel
from ..models.sharing import DocumentShareModel


def _doc_to_response(doc: DocumentModel) -> DocumentResponse:
    return DocumentResponse(
        id=doc.id,
        title=doc.title,
        content=json.loads(doc.content) if isinstance(doc.content, str) else doc.content,
        created_at=doc.created_at.isoformat(),
        updated_at=doc.updated_at.isoformat(),
    )


def _has_access(db: Session, doc_id: str, user: UserModel, require_write: bool = False) -> bool:
    """Check if user has access to a document.

    Returns True if user is the owner, or has appropriate share permission.
    For require_write=False, read share is sufficient.
    For require_write=True, only owner or write share is sufficient.
    """
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        return False

    # Owner always has full access
    if doc.owner_id == user.id:
        return True

    # Check share permissions
    if require_write:
        share = db.query(DocumentShareModel).filter(
            DocumentShareModel.document_id == doc_id,
            DocumentShareModel.shared_with_user_id == user.id,
            DocumentShareModel.permission == "write",
        ).first()
    else:
        share = db.query(DocumentShareModel).filter(
            DocumentShareModel.document_id == doc_id,
            DocumentShareModel.shared_with_user_id == user.id,
        ).first()

    return share is not None


def list_documents(db: Session, user: UserModel) -> list[DocumentResponse]:
    """Return documents owned by the user, ordered by last updated."""
    docs = (
        db.query(DocumentModel)
        .filter(DocumentModel.owner_id == user.id)
        .order_by(DocumentModel.updated_at.desc())
        .all()
    )
    return [_doc_to_response(d) for d in docs]


def list_shared_documents(db: Session, user: UserModel) -> list[dict]:
    """Return documents shared with the current user, including owner info.

    Returns a list of dicts with document info, permission, and shared_by info.
    """
    results = (
        db.query(DocumentShareModel, DocumentModel)
        .join(DocumentModel, DocumentShareModel.document_id == DocumentModel.id)
        .filter(DocumentShareModel.shared_with_user_id == user.id)
        .order_by(DocumentShareModel.created_at.desc())
        .all()
    )

    output = []
    from ..models.user import UserModel as User
    for share, doc in results:
        owner = db.query(User).filter(User.id == doc.owner_id).first()
        output.append({
            "id": share.id,
            "document_id": doc.id,
            "title": doc.title,
            "permission": share.permission,
            "shared_by_user_id": owner.id if owner else "",
            "shared_by_display_name": owner.display_name if owner else "Unknown",
            "created_at": share.created_at.isoformat(),
        })
    return output


def get_document(db: Session, doc_id: str, user: Optional[UserModel] = None) -> Optional[DocumentResponse]:
    """Return a single document by id, or None.

    If user is provided, checks ownership or share access.
    """
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        return None

    if user is not None and not _has_access(db, doc_id, user, require_write=False):
        return None

    return _doc_to_response(doc)


def create_document(db: Session, data: DocumentCreate, user: UserModel) -> DocumentResponse:
    """Create and return a new document owned by the given user."""
    doc = DocumentModel(
        title=data.title,
        content=json.dumps(data.content) if isinstance(data.content, dict) else data.content,
        owner_id=user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _doc_to_response(doc)


def update_document(db: Session, doc_id: str, data: DocumentUpdate, user: UserModel) -> Optional[DocumentResponse]:
    """Update an existing document and return it, or None if not found or no access."""
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        return None

    # Check access: owner or write share
    if not _has_access(db, doc_id, user, require_write=True):
        return None

    if data.title is not None:
        doc.title = data.title
    if data.content is not None:
        doc.content = json.dumps(data.content) if isinstance(data.content, dict) else data.content

    db.commit()
    db.refresh(doc)
    return _doc_to_response(doc)


def delete_document(db: Session, doc_id: str, user: UserModel) -> bool:
    """Delete a document by id. Owner only. Returns True if deleted, False if not found."""
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        return False

    # Only owner can delete
    if doc.owner_id != user.id:
        return False

    # Delete associated shares first
    db.query(DocumentShareModel).filter(
        DocumentShareModel.document_id == doc_id
    ).delete()

    db.delete(doc)
    db.commit()
    return True
