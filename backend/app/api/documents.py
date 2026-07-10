from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from typing import List
from pydantic import BaseModel
import io

from ..models.document import Document, DocumentCreate, DocumentUpdate, DocumentResponse
from ..core.storage import storage
from ..services.pdf_export import exporter

router = APIRouter(prefix="/api", tags=["documents"])


class ExportRequest(BaseModel):
    """Request for PDF export."""
    content: dict
    paper_size: str = "A4"
    margins: dict = {"top": 72, "right": 72, "bottom": 72, "left": 72}


# Document CRUD endpoints
@router.get("/documents/", response_model=List[DocumentResponse])
def list_documents():
    """List all documents."""
    documents = storage.list_documents()
    return [
        DocumentResponse(
            id=doc.id,
            title=doc.title,
            content=doc.content,
            created_at=doc.created_at.isoformat(),
            updated_at=doc.updated_at.isoformat(),
        )
        for doc in documents
    ]


@router.post("/documents/", response_model=DocumentResponse)
def create_document(data: DocumentCreate):
    """Create a new document."""
    doc = storage.create_document(data)
    return DocumentResponse(
        id=doc.id,
        title=doc.title,
        content=doc.content,
        created_at=doc.created_at.isoformat(),
        updated_at=doc.updated_at.isoformat(),
    )


@router.get("/documents/{doc_id}", response_model=DocumentResponse)
def get_document(doc_id: str):
    """Get a document by ID."""
    doc = storage.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return DocumentResponse(
        id=doc.id,
        title=doc.title,
        content=doc.content,
        created_at=doc.created_at.isoformat(),
        updated_at=doc.updated_at.isoformat(),
    )


@router.put("/documents/{doc_id}", response_model=DocumentResponse)
def update_document(doc_id: str, data: DocumentUpdate):
    """Update a document."""
    doc = storage.update_document(doc_id, data)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return DocumentResponse(
        id=doc.id,
        title=doc.title,
        content=doc.content,
        created_at=doc.created_at.isoformat(),
        updated_at=doc.updated_at.isoformat(),
    )


@router.delete("/documents/{doc_id}")
def delete_document(doc_id: str):
    """Delete a document."""
    success = storage.delete_document(doc_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"message": "Document deleted"}


# PDF Export endpoint
@router.post("/export/pdf")
def export_pdf(request: ExportRequest):
    """Export document content to PDF."""
    try:
        pdf_bytes = exporter.export(
            content=request.content,
            paper_size=request.paper_size,
            margins=request.margins,
        )
        
        # Return as streaming response
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": "attachment; filename=document.pdf"
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF export failed: {str(e)}")
