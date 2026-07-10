"""Simple in-memory storage for documents."""
from typing import Dict, Optional
from datetime import datetime
import json
import uuid

from ..models.document import Document, DocumentCreate, DocumentUpdate


class DocumentStorage:
    """Simple in-memory document storage."""
    
    def __init__(self):
        self.documents: Dict[str, Document] = {}
    
    def list_documents(self):
        """List all documents."""
        return list(self.documents.values())
    
    def get_document(self, doc_id: str) -> Optional[Document]:
        """Get a document by ID."""
        return self.documents.get(doc_id)
    
    def create_document(self, data: DocumentCreate) -> Document:
        """Create a new document."""
        doc_id = str(uuid.uuid4())
        now = datetime.utcnow()
        doc = Document(
            id=doc_id,
            title=data.title,
            content=data.content or {},
            created_at=now,
            updated_at=now,
        )
        self.documents[doc_id] = doc
        return doc
    
    def update_document(self, doc_id: str, data: DocumentUpdate) -> Optional[Document]:
        """Update a document."""
        doc = self.documents.get(doc_id)
        if not doc:
            return None
        
        if data.title is not None:
            doc.title = data.title
        if data.content is not None:
            doc.content = data.content
        
        doc.updated_at = datetime.utcnow()
        return doc
    
    def delete_document(self, doc_id: str) -> bool:
        """Delete a document."""
        if doc_id in self.documents:
            del self.documents[doc_id]
            return True
        return False


# Global storage instance
storage = DocumentStorage()
