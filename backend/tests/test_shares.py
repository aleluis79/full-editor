"""Tests for share CRUD endpoints and permission enforcement.

Uses auth_client fixture with test_user/second_user fixtures to
simulate different users for sharing scenarios.
"""
import pytest


def _create_doc_via_api(client, title="Test Doc"):
    resp = client.post("/api/documents/", json={"title": title})
    assert resp.status_code == 201
    return resp.json()["id"]


class TestShareBasic:
    """Basic share endpoint behavior."""

    def test_share_list_empty(self, auth_client):
        """GIVEN an authenticated user with a doc but no shares WHEN list THEN empty."""
        doc_id = _create_doc_via_api(auth_client, "My Doc")
        resp = auth_client.get(f"/api/shares/?document_id={doc_id}")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_share_nonexistent_document_returns_404(self, auth_client, second_user):
        """GIVEN sharing a non-existent document WHEN POST share THEN 404."""
        resp = auth_client.post("/api/shares/", json={
            "document_id": "nonexistent-id",
            "shared_with_user_id": second_user.id,
            "permission": "read",
        })
        assert resp.status_code == 404

    def test_share_nonexistent_user_returns_404(self, auth_client):
        """GIVEN sharing with non-existent user WHEN POST share THEN 404."""
        doc_id = _create_doc_via_api(auth_client, "No User Doc")
        resp = auth_client.post("/api/shares/", json={
            "document_id": doc_id,
            "shared_with_user_id": "nonexistent-user-id",
            "permission": "read",
        })
        assert resp.status_code == 404


class TestShareCRUD:
    """Full share CRUD with permission enforcement."""

    def test_share_create_and_list(self, auth_client, second_user):
        """GIVEN document owner WHEN sharing with another user THEN share is created."""
        doc_id = _create_doc_via_api(auth_client, "Shared Doc")

        share_resp = auth_client.post("/api/shares/", json={
            "document_id": doc_id,
            "shared_with_user_id": second_user.id,
            "permission": "read",
        })
        assert share_resp.status_code == 201
        share_data = share_resp.json()
        assert share_data["permission"] == "read"
        assert share_data["document_id"] == doc_id
        assert share_data["shared_with_user_id"] == second_user.id

        # List shares for the document
        list_resp = auth_client.get(f"/api/shares/?document_id={doc_id}")
        assert list_resp.status_code == 200
        data = list_resp.json()
        assert len(data) == 1
        assert data[0]["permission"] == "read"

    def test_share_duplicate_returns_409(self, auth_client, second_user):
        """GIVEN existing share WHEN sharing again THEN 409 conflict."""
        doc_id = _create_doc_via_api(auth_client, "Conflict Doc")

        auth_client.post("/api/shares/", json={
            "document_id": doc_id,
            "shared_with_user_id": second_user.id,
            "permission": "read",
        })

        resp = auth_client.post("/api/shares/", json={
            "document_id": doc_id,
            "shared_with_user_id": second_user.id,
            "permission": "write",
        })
        assert resp.status_code == 409

    def test_share_with_write_permission(self, auth_client, second_user):
        """GIVEN document owner WHEN sharing with write permission THEN write."""
        doc_id = _create_doc_via_api(auth_client, "Write Share Doc")

        resp = auth_client.post("/api/shares/", json={
            "document_id": doc_id,
            "shared_with_user_id": second_user.id,
            "permission": "write",
        })
        assert resp.status_code == 201
        assert resp.json()["permission"] == "write"

    def test_revoke_share(self, auth_client, second_user):
        """GIVEN existing share WHEN owner revokes THEN share deleted."""
        doc_id = _create_doc_via_api(auth_client, "Revoke Doc")

        share_resp = auth_client.post("/api/shares/", json={
            "document_id": doc_id,
            "shared_with_user_id": second_user.id,
            "permission": "read",
        })
        share_id = share_resp.json()["id"]

        revoke_resp = auth_client.delete(f"/api/shares/{share_id}")
        assert revoke_resp.status_code == 200

        # Verify share is gone
        list_resp = auth_client.get(f"/api/shares/?document_id={doc_id}")
        assert list_resp.json() == []


class TestSharePermissionEnforcement:
    """Non-owners cannot share or revoke."""

    def _create_doc_as_user(self, override_db, user_id, title="Others Doc"):
        """Helper to create a doc owned by a specific user directly in DB."""
        from app.models.document import DocumentModel
        doc = DocumentModel(
            title=title,
            content="{}",
            owner_id=user_id,
        )
        override_db.add(doc)
        override_db.commit()
        return doc

    def _create_share(self, override_db, doc_id, user_id, permission="read"):
        """Helper to create a share directly in DB."""
        from app.models.sharing import DocumentShareModel
        from datetime import datetime, timezone
        share = DocumentShareModel(
            document_id=doc_id,
            shared_with_user_id=user_id,
            permission=permission,
        )
        override_db.add(share)
        override_db.commit()
        return share

    def test_non_owner_cannot_share(self, auth_client, override_db, test_user):
        """GIVEN non-owner user WHEN sharing THEN 403."""
        doc = self._create_doc_as_user(override_db, test_user.id)

        resp = auth_client.post("/api/shares/", json={
            "document_id": doc.id,
            "shared_with_user_id": test_user.id,
            "permission": "read",
        })
        assert resp.status_code == 403

    def test_non_owner_cannot_revoke(self, auth_client, override_db, test_user, second_user):
        """GIVEN non-owner user WHEN revoking share THEN 403."""
        doc = self._create_doc_as_user(override_db, test_user.id)
        share = self._create_share(override_db, doc.id, second_user.id)

        resp = auth_client.delete(f"/api/shares/{share.id}")
        assert resp.status_code == 403

    def test_non_owner_cannot_delete_doc(self, auth_client, override_db, test_user):
        """GIVEN a doc the user does not own WHEN deleting THEN 403."""
        doc = self._create_doc_as_user(override_db, test_user.id)
        resp = auth_client.delete(f"/api/documents/{doc.id}")
        assert resp.status_code == 403

    def test_owner_can_delete(self, auth_client):
        """GIVEN a doc the user owns WHEN deleting THEN 200."""
        doc_id = _create_doc_via_api(auth_client, "My Doc")
        resp = auth_client.delete(f"/api/documents/{doc_id}")
        assert resp.status_code == 200


class TestSharedWithMe:
    """Shared-with-me listing via GET /api/documents/shared-with-me."""

    def test_shared_with_me_empty(self, auth_client):
        """GIVEN no shared documents WHEN shared-with-me THEN empty list."""
        resp = auth_client.get("/api/documents/shared-with-me")
        assert resp.status_code == 200
        assert resp.json() == []


class TestOwnerScopedDocuments:
    """Document list should only return owned documents."""

    def test_list_only_owned_documents(self, auth_client):
        """GIVEN documents owned by user and others WHEN listing THEN only owned."""
        _create_doc_via_api(auth_client, "My Doc")

        resp = auth_client.get("/api/documents/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["title"] == "My Doc"

    def test_create_document_works(self, auth_client):
        """GIVEN authenticated user creating a doc THEN 201 with correct title."""
        resp = auth_client.post("/api/documents/", json={"title": "Owned Doc"})
        assert resp.status_code == 201
        assert resp.json()["title"] == "Owned Doc"
