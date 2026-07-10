"""Document persistence layer backed by SQLAlchemy sessions."""
import json
from typing import Optional

from sqlalchemy.orm import Session

from ..models.document import DocumentModel, DocumentCreate, DocumentUpdate, DocumentResponse


def _doc_to_response(doc: DocumentModel) -> DocumentResponse:
    return DocumentResponse(
        id=doc.id,
        title=doc.title,
        content=json.loads(doc.content) if isinstance(doc.content, str) else doc.content,
        created_at=doc.created_at.isoformat(),
        updated_at=doc.updated_at.isoformat(),
    )


def list_documents(db: Session) -> list[DocumentResponse]:
    """Return all documents ordered by last updated."""
    docs = db.query(DocumentModel).order_by(DocumentModel.updated_at.desc()).all()
    return [_doc_to_response(d) for d in docs]


def get_document(db: Session, doc_id: str) -> Optional[DocumentResponse]:
    """Return a single document by id, or None."""
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        return None
    return _doc_to_response(doc)


def create_document(db: Session, data: DocumentCreate) -> DocumentResponse:
    """Create and return a new document."""
    doc = DocumentModel(
        title=data.title,
        content=json.dumps(data.content) if isinstance(data.content, dict) else data.content,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _doc_to_response(doc)


def update_document(db: Session, doc_id: str, data: DocumentUpdate) -> Optional[DocumentResponse]:
    """Update an existing document and return it, or None if not found."""
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        return None

    if data.title is not None:
        doc.title = data.title
    if data.content is not None:
        doc.content = json.dumps(data.content) if isinstance(data.content, dict) else data.content

    db.commit()
    db.refresh(doc)
    return _doc_to_response(doc)


def delete_document(db: Session, doc_id: str) -> bool:
    """Delete a document by id. Returns True if deleted, False if not found."""
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        return False
    db.delete(doc)
    db.commit()
    return True
