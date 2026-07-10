# Backend Architecture

## Stack

- **Framework**: FastAPI
- **ORM**: SQLModel (FastAPI + SQLAlchemy + Pydantic)
- **Database**: PostgreSQL (JSONB for document storage) or MongoDB
- **PDF Export**: reportlab / fpdf2

## API: REST

```
GET    /api/documents/:id       → get document
POST   /api/documents           → create document
PUT    /api/documents/:id       → update document
DELETE /api/documents/:id       → delete document
POST   /api/documents/:id/export/pdf  → export PDF
```

## Persistence: JSON Complete

Document tree serialized as JSON. Stored as JSONB in PostgreSQL.

```json
{
  "id": "doc-123",
  "title": "My Document",
  "content": { ... },
  "metadata": { ... },
  "createdAt": "2026-07-08T...",
  "updatedAt": "2026-07-08T..."
}
```

## PDF Export

1. Receive serialized document
2. Run layout in Python (simplified, or receive pre-calculated positions from frontend)
3. Generate PDF with reportlab/fpdf2
4. Return PDF file

## Models (SQLModel)

```python
from sqlmodel import SQLModel, Field
from datetime import datetime

class Document(SQLModel, table=True):
    id: str = Field(primary_key=True)
    title: str
    content: dict  # JSONB - full document tree
    metadata: dict = {}
    created_at: datetime
    updated_at: datetime
```
