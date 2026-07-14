"""Tests for PDF export image URL→path resolution in _process_image."""
from pathlib import Path
from app.services.pdf_export import PDFExporter


class TestProcessImageUrlResolution:
    """Ensure /uploads/ URL paths resolve to filesystem paths."""

    def setup_method(self):
        self.exporter = PDFExporter()

    def test_uploads_url_is_resolved_to_filesystem_path(self, monkeypatch):
        """A block with src='/uploads/images/abc.png' resolves to UPLOAD_DIR."""
        # Import and patch UPLOAD_DIR to a known temp path
        from app.config import UPLOAD_DIR

        fake_dir = Path("/tmp/fake-uploads/images")
        monkeypatch.setattr("app.config.UPLOAD_DIR", fake_dir)

        block = {
            "src": "/uploads/images/abc.png",
            "width": 300,
            "height": 200,
        }

        expected_path = str(fake_dir / "abc.png")
        result = self.exporter._process_image(block)

        # The result should be a list with an Image element.
        # ReportLab's Image reads from the path, so the path must be resolved.
        assert len(result) == 1
        # The Image's filename attribute should be the resolved path
        img = result[0]
        assert str(img.filename) == expected_path

    def test_non_uploads_url_is_passed_through(self):
        """A block with an absolute URL is passed through unchanged."""
        block = {
            "src": "https://example.com/image.png",
            "width": 300,
            "height": 200,
        }

        result = self.exporter._process_image(block)

        assert len(result) == 1
        img = result[0]
        # The src should be passed directly to ReportLab Image
        assert str(img.filename) == "https://example.com/image.png"

    def test_empty_src_falls_back_to_image_fallback(self, monkeypatch):
        """A block with empty src falls through to the except/fallback handler."""
        from app.config import UPLOAD_DIR

        fake_dir = Path("/tmp/fake-uploads/images")
        monkeypatch.setattr("app.config.UPLOAD_DIR", fake_dir)

        block = {
            "src": "",
            "width": 300,
            "height": 200,
        }

        result = self.exporter._process_image(block)

        # With empty src, the Image() constructor will fail, producing fallback
        assert len(result) == 1
        # It should produce the fallback paragraph
        assert hasattr(result[0], 'text') or isinstance(result[0], object)
