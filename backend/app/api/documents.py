from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from typing import List
from pydantic import BaseModel
from sqlalchemy.orm import Session
import io

from ..models.document import DocumentCreate, DocumentUpdate, DocumentResponse
from ..models.user import UserModel
from ..core.database import get_db
from ..core.auth import get_current_user
from ..core import storage as store
from ..services.pdf_export import exporter

router = APIRouter(prefix="/api", tags=["documents"])


class ExportRequest(BaseModel):
    """Request for PDF export."""
    content: dict
    paper_size: str = "A4"
    orientation: str = "portrait"
    margins: dict = {"top": 72, "right": 72, "bottom": 72, "left": 72}
    page_breaks: list[str] = []  # block IDs where page breaks should occur


# ── Document CRUD ─────────────────────────────────────────────────


@router.get("/documents/", response_model=List[DocumentResponse])
def list_documents(
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    """List documents owned by the current user."""
    return store.list_documents(db, user)


@router.get("/documents/shared-with-me")
def list_shared_documents(
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    """List documents shared with the current user."""
    return store.list_shared_documents(db, user)


@router.post("/documents/", response_model=DocumentResponse, status_code=201)
def create_document(
    data: DocumentCreate,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    """Create a new document owned by the current user."""
    return store.create_document(db, data, user)


@router.get("/documents/{doc_id}", response_model=DocumentResponse)
def get_document(
    doc_id: str,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    """Get a document by ID (owner or shared-with access)."""
    doc = store.get_document(db, doc_id, user)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.put("/documents/{doc_id}", response_model=DocumentResponse)
def update_document(
    doc_id: str,
    data: DocumentUpdate,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    """Update a document (owner or write-share access)."""
    doc = store.update_document(db, doc_id, data, user)
    if not doc:
        # Check if doc exists at all to differentiate 404 from 403
        existing = store.get_document(db, doc_id)
        if existing is None:
            raise HTTPException(status_code=404, detail="Document not found")
        raise HTTPException(status_code=403, detail="Insufficient permissions to update this document")
    return doc


@router.delete("/documents/{doc_id}")
def delete_document(
    doc_id: str,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    """Delete a document (owner only)."""
    success = store.delete_document(db, doc_id, user)
    if not success:
        # Check if doc exists
        existing = store.get_document(db, doc_id)
        if existing is None:
            raise HTTPException(status_code=404, detail="Document not found")
        raise HTTPException(status_code=403, detail="Only the document owner can delete")
    return {"message": "Document deleted"}


# ── PDF Export ─────────────────────────────────────────────────────


@router.post("/export/pdf")
def export_pdf(
    request: ExportRequest,
    user: UserModel = Depends(get_current_user),
):
    """Export document content to PDF."""
    try:
        pdf_bytes = exporter.export(
            content=request.content,
            paper_size=request.paper_size,
            orientation=request.orientation,
            margins=request.margins,
            page_breaks=request.page_breaks,
        )

        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": "attachment; filename=document.pdf"
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF export failed: {str(e)}")
