"""Tests for auth endpoint and get_current_user dependency.

Uses the auth_client fixture which overrides get_current_user to return
a test UserModel, so no real Keycloak JWT is needed.
"""


class TestAuthMe:
    """GET /api/auth/me — return current user info."""

    def test_auth_me_returns_user(self, auth_client):
        """GIVEN an authenticated user WHEN GET /api/auth/me THEN return user info."""
        resp = auth_client.get("/api/auth/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "auth-test@example.com"
        assert data["display_name"] == "Auth Test User"
        assert "id" in data
        assert "keycloak_id" in data

    def test_auth_me_no_bearer_token(self, auth_client):
        """GIVEN missing Authorization header WHEN GET /api/auth/me THEN 401."""
        # Override dependency override map to force real auth
        from app.core.auth import get_current_user
        from app.main import app

        # Remove the override temporarily
        old_override = app.dependency_overrides.pop(get_current_user, None)
        try:
            resp = auth_client.get("/api/auth/me")
            assert resp.status_code == 401
        finally:
            if old_override:
                app.dependency_overrides[get_current_user] = old_override
