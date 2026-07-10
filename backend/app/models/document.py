from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class Document(BaseModel):
    """Document model for storing editor documents."""
    
    id: Optional[str] = None
    title: str = "Untitled Document"
    content: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    def get_content_dict(self) -> dict:
        """Get content as dict."""
        return self.content
    
    def set_content_dict(self, content: dict) -> None:
        """Set content from dict."""
        self.content = content


# Pydantic schemas for API
class DocumentCreate(BaseModel):
    """Schema for creating a document."""
    title: str = "Untitled Document"
    content: dict = Field(default_factory=dict)


class DocumentUpdate(BaseModel):
    """Schema for updating a document."""
    title: Optional[str] = None
    content: Optional[dict] = None


class DocumentResponse(BaseModel):
    """Schema for document response."""
    id: str
    title: str
    content: dict
    created_at: str
    updated_at: str
