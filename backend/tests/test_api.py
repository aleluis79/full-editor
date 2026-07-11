"""Tests for the document CRUD API and PDF export endpoint."""

import json


class TestHealth:
    def test_health_check(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "healthy"}

    def test_root(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["message"] == "Full Editor API"
        assert "version" in data


class TestDocumentCRUD:
    """Full CRUD cycle for documents."""

    def test_create_document(self, client):
        resp = client.post("/api/documents/", json={"title": "Test Doc"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Test Doc"
        assert data["content"] == {}
        assert "id" in data
        assert "created_at" in data

    def test_create_document_with_content(self, client):
        content = {"blocks": [{"type": "paragraph", "children": []}]}
        resp = client.post("/api/documents/", json={
            "title": "With Content",
            "content": content,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "With Content"
        assert data["content"] == content

    def test_list_documents_empty(self, client):
        resp = client.get("/api/documents/")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_documents(self, client):
        # Create two documents
        client.post("/api/documents/", json={"title": "Doc A"})
        client.post("/api/documents/", json={"title": "Doc B"})

        resp = client.get("/api/documents/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        titles = [d["title"] for d in data]
        assert "Doc A" in titles
        assert "Doc B" in titles

    def test_get_document(self, client):
        create_resp = client.post("/api/documents/", json={"title": "Get Me"})
        doc_id = create_resp.json()["id"]

        resp = client.get(f"/api/documents/{doc_id}")
        assert resp.status_code == 200
        assert resp.json()["title"] == "Get Me"

    def test_get_document_not_found(self, client):
        resp = client.get("/api/documents/nonexistent")
        assert resp.status_code == 404

    def test_update_document_title(self, client):
        create_resp = client.post("/api/documents/", json={"title": "Old"})
        doc_id = create_resp.json()["id"]

        resp = client.put(f"/api/documents/{doc_id}", json={"title": "New"})
        assert resp.status_code == 200
        assert resp.json()["title"] == "New"

    def test_update_document_content(self, client):
        create_resp = client.post("/api/documents/", json={"title": "Doc"})
        doc_id = create_resp.json()["id"]

        content = {"blocks": [{"type": "paragraph", "text": "Hello"}]}
        resp = client.put(f"/api/documents/{doc_id}", json={"content": content})
        assert resp.status_code == 200
        assert resp.json()["content"] == content

    def test_update_document_not_found(self, client):
        resp = client.put("/api/documents/nonexistent", json={"title": "Nope"})
        assert resp.status_code == 404

    def test_delete_document(self, client):
        create_resp = client.post("/api/documents/", json={"title": "Delete Me"})
        doc_id = create_resp.json()["id"]

        resp = client.delete(f"/api/documents/{doc_id}")
        assert resp.status_code == 200
        assert resp.json() == {"message": "Document deleted"}

        # Verify it's gone
        get_resp = client.get(f"/api/documents/{doc_id}")
        assert get_resp.status_code == 404

    def test_delete_document_not_found(self, client):
        resp = client.delete("/api/documents/nonexistent")
        assert resp.status_code == 404

    def test_full_crud_cycle(self, client):
        """Create → Read → Update → Read → Delete → Verify missing."""
        # Create
        content = {"blocks": [{"type": "paragraph", "text": "Initial"}]}
        create_resp = client.post("/api/documents/", json={
            "title": "Full Cycle",
            "content": content,
        })
        assert create_resp.status_code == 201
        doc_id = create_resp.json()["id"]

        # Read
        get_resp = client.get(f"/api/documents/{doc_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["title"] == "Full Cycle"

        # Update
        update_resp = client.put(f"/api/documents/{doc_id}", json={"title": "Updated"})
        assert update_resp.status_code == 200
        assert update_resp.json()["title"] == "Updated"

        # Delete
        del_resp = client.delete(f"/api/documents/{doc_id}")
        assert del_resp.status_code == 200

        # Verify gone
        missing_resp = client.get(f"/api/documents/{doc_id}")
        assert missing_resp.status_code == 404


class TestPDFExport:
    """PDF export endpoint tests."""

    PDF_PREAMBLE = b"%PDF"  # All PDFs start with this

    def test_export_pdf_basic(self, client):
        content = {
            "children": [
                {
                    "type": "paragraph",
                    "id": "p1",
                    "children": [{"type": "text", "content": "Hello PDF", "marks": []}],
                }
            ]
        }
        resp = client.post("/api/export/pdf", json={"content": content})
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/pdf"
        assert resp.content.startswith(self.PDF_PREAMBLE)

    def test_export_pdf_with_formatting(self, client):
        content = {
            "children": [
                {
                    "type": "paragraph",
                    "id": "p1",
                    "children": [
                        {"type": "text", "content": "Bold text", "marks": ["bold"]},
                        {"type": "text", "content": " and ", "marks": []},
                        {"type": "text", "content": "italic", "marks": ["italic"]},
                    ],
                }
            ]
        }
        resp = client.post("/api/export/pdf", json={"content": content})
        assert resp.status_code == 200
        assert resp.content.startswith(self.PDF_PREAMBLE)

    def test_export_pdf_heading(self, client):
        content = {
            "children": [
                {
                    "type": "heading",
                    "id": "h1",
                    "level": 1,
                    "children": [{"type": "text", "content": "Title", "marks": []}],
                }
            ]
        }
        resp = client.post("/api/export/pdf", json={"content": content})
        assert resp.status_code == 200
        assert resp.content.startswith(self.PDF_PREAMBLE)

    def test_export_pdf_empty_content(self, client):
        resp = client.post("/api/export/pdf", json={"content": {"children": []}})
        assert resp.status_code == 200
        assert resp.content.startswith(self.PDF_PREAMBLE)
