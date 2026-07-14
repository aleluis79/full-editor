"""Application configuration constants."""
from pathlib import Path

# ── Image Upload ──────────────────────────────────────────────

UPLOAD_DIR = Path(__file__).parent.parent / "uploads" / "images"
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
ALLOWED_MIMETYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}
