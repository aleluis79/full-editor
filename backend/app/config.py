"""Application configuration constants."""
import os
from pathlib import Path

# ── Image Upload ──────────────────────────────────────────────

UPLOAD_DIR = Path(__file__).parent.parent / "uploads" / "images"
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
ALLOWED_MIMETYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}

# ── Keycloak OIDC ─────────────────────────────────────────────

KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://localhost:8080")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "full-editor")
KEYCLOAK_CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "full-editor-client")
KEYCLOAK_JWKS_URL = f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/certs"
KEYCLOAK_ISSUER = f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}"
