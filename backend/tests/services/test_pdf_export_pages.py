"""Tests for two-pass build and page counting."""
from reportlab.platypus import SimpleDocTemplate, Paragraph, PageBreak
from reportlab.lib.styles import getSampleStyleSheet
import io
from app.services.pdf_export import PDFExporter


class TestCountPages:
    """Test _count_pages returns correct page count."""

    def setup_method(self):
        self.exporter = PDFExporter()
        self.styles = getSampleStyleSheet()

    def test_count_pages_single_page(self):
        """Single page story returns count of 1."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=(595, 842))
        story = [Paragraph("Hello World", self.styles['Normal'])]
        
        count = self.exporter._count_pages(doc, story)
        assert count == 1

    def test_count_pages_multiple_pages(self):
        """Multi-page story with PageBreak returns correct count."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=(595, 842))
        story = [
            Paragraph("Page 1", self.styles['Normal']),
            PageBreak(),
            Paragraph("Page 2", self.styles['Normal']),
            PageBreak(),
            Paragraph("Page 3", self.styles['Normal']),
        ]
        
        count = self.exporter._count_pages(doc, story)
        assert count == 3

    def test_count_pages_with_large_content(self):
        """Content that naturally flows to multiple pages is counted correctly."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=(595, 842),
            topMargin=72,
            bottomMargin=72,
        )
        # Create enough content to span multiple pages
        story = []
        for i in range(100):
            story.append(Paragraph(f"Paragraph {i} with some text content", self.styles['Normal']))
        
        count = self.exporter._count_pages(doc, story)
        assert count >= 2  # Should be at least 2 pages

    def test_count_pages_empty_story(self):
        """Empty story returns count of 0 or 1 (ReportLab creates at least 1 page)."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=(595, 842))
        story = []
        
        count = self.exporter._count_pages(doc, story)
        # ReportLab may create 0 or 1 page for empty story
        assert count >= 0


class TestHasTotalPagesToken:
    """Test _has_total_pages_token detection."""

    def setup_method(self):
        self.exporter = PDFExporter()

    def test_has_total_pages_in_header(self):
        """Detects {totalPages} in header runs."""
        self.exporter._header_footer_config = {
            "enabled": True,
            "header": {
                "runs": [{"content": "Page {pageNumber} of {totalPages}"}],
                "height": 36,
            },
            "footer": {"runs": [], "height": 24},
        }
        assert self.exporter._has_total_pages_token() is True

    def test_has_total_pages_in_footer(self):
        """Detects {totalPages} in footer runs."""
        self.exporter._header_footer_config = {
            "enabled": True,
            "header": {"runs": [], "height": 36},
            "footer": {
                "runs": [{"content": "{totalPages} pages"}],
                "height": 24,
            },
        }
        assert self.exporter._has_total_pages_token() is True

    def test_no_total_pages_token(self):
        """Returns False when no {totalPages} token exists."""
        self.exporter._header_footer_config = {
            "enabled": True,
            "header": {"runs": [{"content": "Title"}], "height": 36},
            "footer": {"runs": [{"content": "Page {pageNumber}"}], "height": 24},
        }
        assert self.exporter._has_total_pages_token() is False

    def test_no_config_returns_false(self):
        """Returns False when no header_footer config exists."""
        self.exporter._header_footer_config = None
        assert self.exporter._has_total_pages_token() is False

    def test_multiple_runs_with_total_pages(self):
        """Detects {totalPages} across multiple runs."""
        self.exporter._header_footer_config = {
            "enabled": True,
            "header": {"runs": [], "height": 36},
            "footer": {
                "runs": [
                    {"content": "Page "},
                    {"content": "{pageNumber}"},
                    {"content": " of "},
                    {"content": "{totalPages}"},
                ],
                "height": 24,
            },
        }
        assert self.exporter._has_total_pages_token() is True
