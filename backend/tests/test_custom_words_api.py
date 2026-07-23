"""Tests for the custom_words API endpoints."""
import pytest


class TestCustomWordsAPI:
    """Full API round-trip for custom dictionary words."""

    def test_list_empty(self, client):
        """GET /api/v1/custom-words returns empty list initially."""
        resp = client.get("/api/v1/custom-words")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_create_word(self, client):
        """POST /api/v1/custom-words creates a word and returns 201."""
        resp = client.post(
            "/api/v1/custom-words",
            json={"word": "opencode", "lang": "en"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["word"] == "opencode"
        assert data["lang"] == "en"
        assert "id" in data
        assert "user_id" in data
        assert "created_at" in data

    def test_list_after_create(self, client):
        """GET /api/v1/custom-words returns created words."""
        client.post("/api/v1/custom-words", json={"word": "opencode", "lang": "en"})
        client.post("/api/v1/custom-words", json={"word": "typescript", "lang": "en"})

        resp = client.get("/api/v1/custom-words")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        words = {item["word"] for item in data}
        assert "opencode" in words
        assert "typescript" in words

    def test_delete_word(self, client):
        """DELETE /api/v1/custom-words/{id} deletes a word (204)."""
        create_resp = client.post(
            "/api/v1/custom-words", json={"word": "delete_me", "lang": "en"}
        )
        assert create_resp.status_code == 201
        word_id = create_resp.json()["id"]

        resp = client.delete(f"/api/v1/custom-words/{word_id}")
        assert resp.status_code == 204

        # Verify it's gone
        list_resp = client.get("/api/v1/custom-words")
        assert list_resp.json() == []

    def test_delete_nonexistent_returns_404(self, client):
        """DELETE on a non-existent word returns 404."""
        resp = client.delete("/api/v1/custom-words/nonexistent-id")
        assert resp.status_code == 404

    def test_auth_scoping(self, client, override_db):
        """Custom words are scoped per user — user_id is set from JWT."""
        # Create a word and verify user_id is present and non-empty
        resp = client.post("/api/v1/custom-words", json={"word": "myword", "lang": "en"})
        assert resp.status_code == 201
        user_id = resp.json()["user_id"]
        assert user_id  # user_id should be set from the authenticated user

        # List returns only words with that user_id
        list_resp = client.get("/api/v1/custom-words")
        data = list_resp.json()
        assert len(data) == 1
        assert data[0]["user_id"] == user_id

    def test_create_spanish_word(self, client):
        """POST with lang='es' stores correctly."""
        resp = client.post(
            "/api/v1/custom-words", json={"word": "software", "lang": "es"}
        )
        assert resp.status_code == 201
        assert resp.json()["lang"] == "es"


class TestCustomWordsAuth:
    """Tests for auth-protected custom_words endpoints."""

    def test_unauthenticated_returns_401(self, override_db):
        """GET /api/v1/custom-words returns 401 without auth."""
        from fastapi.testclient import TestClient
        from app.main import app

        # Use the DB override but NO auth override — get_current_user
        # will raise 401 since there's no JWT.
        with TestClient(app) as c:
            resp = c.get("/api/v1/custom-words")
            assert resp.status_code == 401

    def test_unauthenticated_post_returns_401(self, override_db):
        """POST /api/v1/custom-words returns 401 without auth."""
        from fastapi.testclient import TestClient
        from app.main import app

        with TestClient(app) as c:
            resp = c.post(
                "/api/v1/custom-words",
                json={"word": "test", "lang": "en"},
            )
            assert resp.status_code == 401
