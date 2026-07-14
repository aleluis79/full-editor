"""Tests for PDF export — specifically _extract_text link support."""
from app.services.pdf_export import PDFExporter


class TestPDFExtractText:
    """Direct unit tests on _extract_text for link wrapping."""

    def setup_method(self):
        self.exporter = PDFExporter()

    def test_plain_text_no_link(self):
        """Plain text with no marks is returned as-is."""
        node = {
            "type": "paragraph",
            "children": [
                {"type": "text", "content": "Hello", "marks": []}
            ]
        }
        result = self.exporter._extract_text(node)
        assert result == "Hello"

    def test_linked_run_wraps_in_anchor(self):
        """A text run with 'link' mark and href is wrapped in <a href>."""
        node = {
            "type": "paragraph",
            "children": [
                {
                    "type": "text",
                    "content": "Click here",
                    "marks": ["link"],
                    "href": "https://example.com",
                }
            ]
        }
        result = self.exporter._extract_text(node)
        assert '<a href="https://example.com">' in result
        assert "Click here" in result
        assert result == '<a href="https://example.com">Click here</a>'

    def test_linked_run_no_href_falls_back_to_plain(self):
        """A text run with 'link' mark but no href is not wrapped."""
        node = {
            "type": "paragraph",
            "children": [
                {
                    "type": "text",
                    "content": "No link",
                    "marks": ["link"],
                }
            ]
        }
        result = self.exporter._extract_text(node)
        assert result == "No link"

    def test_linked_run_with_bold_and_href(self):
        """Combined bold + link marks — both markup tags are applied."""
        node = {
            "type": "paragraph",
            "children": [
                {
                    "type": "text",
                    "content": "Bold Link",
                    "marks": ["bold", "link"],
                    "href": "https://bold.example.com",
                }
            ]
        }
        result = self.exporter._extract_text(node)
        assert '<a href="https://bold.example.com">' in result
        assert "<b>" in result
        assert "Bold Link" in result

    def test_linked_run_in_paragraph_with_mixed_content(self):
        """A paragraph with linked and unlinked runs is handled correctly."""
        node = {
            "type": "paragraph",
            "children": [
                {"type": "text", "content": "Visit ", "marks": []},
                {
                    "type": "text",
                    "content": "our site",
                    "marks": ["link"],
                    "href": "https://oursite.com",
                },
                {"type": "text", "content": " today!", "marks": []},
            ]
        }
        result = self.exporter._extract_text(node)
        assert "Visit " in result
        assert '<a href="https://oursite.com">' in result
        assert "our site" in result
        assert " today!" in result
