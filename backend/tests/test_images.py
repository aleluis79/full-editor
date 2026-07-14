"""Tests for image upload endpoint (POST /api/images/upload)."""
import io


class TestImageUpload:
    """Test the image upload endpoint."""

    def test_upload_valid_png(self, client):
        """Upload a valid PNG image returns 201 with a URL."""
        png_header = b"\x89PNG\r\n\x1a\n"
        png_content = png_header + b"\x00" * 100
        resp = client.post(
            "/api/images/upload",
            files={"file": ("test.png", png_content, "image/png")},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "url" in data
        assert data["url"].startswith("/uploads/images/")
        assert data["url"].endswith(".png")

    def test_upload_valid_jpeg(self, client):
        """Upload a valid JPEG image returns 201."""
        content = b"\xff\xd8\xff\xe0" + b"\x00" * 100
        resp = client.post(
            "/api/images/upload",
            files={"file": ("photo.jpg", content, "image/jpeg")},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["url"].endswith(".jpg")

    def test_upload_valid_webp(self, client):
        """Upload a valid WebP image returns 201."""
        content = b"RIFF" + b"\x00" * 100 + b"WEBP"
        resp = client.post(
            "/api/images/upload",
            files={"file": ("img.webp", content, "image/webp")},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["url"].endswith(".webp")

    def test_upload_valid_gif(self, client):
        """Upload a valid GIF image returns 201."""
        content = b"GIF89a" + b"\x00" * 100
        resp = client.post(
            "/api/images/upload",
            files={"file": ("anim.gif", content, "image/gif")},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["url"].endswith(".gif")

    def test_upload_invalid_mimetype_returns_400(self, client):
        """Upload with unsupported MIME type returns 400."""
        resp = client.post(
            "/api/images/upload",
            files={"file": ("doc.pdf", b"%PDF-1.4", "application/pdf")},
        )
        assert resp.status_code == 400
        data = resp.json()
        assert "detail" in data

    def test_upload_invalid_extension_returns_400(self, client):
        """Upload with disallowed extension returns 400."""
        resp = client.post(
            "/api/images/upload",
            files={"file": ("image.bmp", b"\x00" * 100, "image/png")},
        )
        assert resp.status_code == 400
        data = resp.json()
        assert "detail" in data

    def test_upload_oversized_file_returns_413(self, client):
        """Upload a file >10MB returns 413."""
        large_content = b"\x00" * (11 * 1024 * 1024)  # 11MB
        resp = client.post(
            "/api/images/upload",
            files={"file": ("large.png", large_content, "image/png")},
        )
        assert resp.status_code == 413
        data = resp.json()
        assert "detail" in data

    def test_upload_no_file_returns_422(self, client):
        """POST without file field returns 422."""
        resp = client.post("/api/images/upload")
        assert resp.status_code == 422
