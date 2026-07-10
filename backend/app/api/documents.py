from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from typing import List
from pydantic import BaseModel
from sqlalchemy.orm import Session
import io

from ..models.document import DocumentCreate, DocumentUpdate, DocumentResponse
from ..core.database import get_db
from ..core import storage as store
from ..services.pdf_export import exporter

router = APIRouter(prefix="/api", tags=["documents"])


class ExportRequest(BaseModel):
    """Request for PDF export."""
    content: dict
    paper_size: str = "A4"
    margins: dict = {"top": 72, "right": 72, "bottom": 72, "left": 72}
    page_breaks: list[str] = []  # block IDs where page breaks should occur


# ── Document CRUD ─────────────────────────────────────────────────


@router.get("/documents/", response_model=List[DocumentResponse])
def list_documents(db: Session = Depends(get_db)):
    """List all documents."""
    return store.list_documents(db)


@router.post("/documents/", response_model=DocumentResponse, status_code=201)
def create_document(data: DocumentCreate, db: Session = Depends(get_db)):
    """Create a new document."""
    return store.create_document(db, data)


@router.get("/documents/{doc_id}", response_model=DocumentResponse)
def get_document(doc_id: str, db: Session = Depends(get_db)):
    """Get a document by ID."""
    doc = store.get_document(db, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.put("/documents/{doc_id}", response_model=DocumentResponse)
def update_document(doc_id: str, data: DocumentUpdate, db: Session = Depends(get_db)):
    """Update a document."""
    doc = store.update_document(db, doc_id, data)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/documents/{doc_id}")
def delete_document(doc_id: str, db: Session = Depends(get_db)):
    """Delete a document."""
    success = store.delete_document(db, doc_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document deleted"}


# ── PDF Export ─────────────────────────────────────────────────────


@router.post("/export/pdf")
def export_pdf(request: ExportRequest):
    """Export document content to PDF."""
    try:
        pdf_bytes = exporter.export(
            content=request.content,
            paper_size=request.paper_size,
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
