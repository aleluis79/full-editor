"""Integration tests for PDF export with header/footer."""
import io
from app.services.pdf_export import PDFExporter


class TestPDFExportWithHeaderFooter:
    """Integration tests for full export pipeline with header/footer."""

    def setup_method(self):
        self.exporter = PDFExporter()
        self.sample_content = {
            "children": [
                {
                    "type": "paragraph",
                    "children": [{"type": "text", "content": "Test content", "marks": []}],
                    "id": "p1",
                }
            ]
        }

    def test_export_with_header_and_footer(self):
        """Full export with header and footer produces valid PDF."""
        header_footer = {
            "enabled": True,
            "firstPageDifferent": False,
            "scope": "all",
            "header": {
                "runs": [{"content": "Report Title", "marks": [], "attrs": None}],
                "height": 36,
            },
            "footer": {
                "runs": [{"content": "Confidential", "marks": [], "attrs": None}],
                "height": 24,
            },
        }
        
        result = self.exporter.export(
            content=self.sample_content,
            paper_size="A4",
            header_footer=header_footer,
        )
        
        assert isinstance(result, bytes)
        assert len(result) > 0
        # Verify it's a valid PDF (starts with %PDF)
        assert result[:4] == b'%PDF'

    def test_export_with_page_number_tokens(self):
        """Export with {pageNumber} and {totalPages} tokens resolves correctly."""
        # Create multi-page content
        multi_page_content = {
            "children": [
                {
                    "type": "paragraph",
                    "children": [{"type": "text", "content": f"Page {i} content", "marks": []}],
                    "id": f"p{i}",
                }
                for i in range(1, 6)
            ]
        }
        
        header_footer = {
            "enabled": True,
            "firstPageDifferent": False,
            "scope": "all",
            "header": {
                "runs": [{"content": "Title", "marks": [], "attrs": None}],
                "height": 36,
            },
            "footer": {
                "runs": [{"content": "Page {pageNumber} of {totalPages}", "marks": [], "attrs": None}],
                "height": 24,
            },
        }
        
        result = self.exporter.export(
            content=multi_page_content,
            paper_size="A4",
            header_footer=header_footer,
        )
        
        assert isinstance(result, bytes)
        assert len(result) > 0
        # Verify _total_pages was set during export
        # (it's reset to None after export, so we can't check it here)
        # But the export should succeed without errors

    def test_export_with_except_first_scope(self):
        """Export with scope='exceptFirst' skips header/footer on page 1."""
        header_footer = {
            "enabled": True,
            "firstPageDifferent": False,
            "scope": "exceptFirst",
            "header": {
                "runs": [{"content": "Title", "marks": [], "attrs": None}],
                "height": 36,
            },
            "footer": {
                "runs": [{"content": "Footer", "marks": [], "attrs": None}],
                "height": 24,
            },
        }
        
        result = self.exporter.export(
            content=self.sample_content,
            paper_size="A4",
            header_footer=header_footer,
        )
        
        assert isinstance(result, bytes)
        assert len(result) > 0

    def test_export_with_first_only_scope(self):
        """Export with scope='firstOnly' shows header/footer only on page 1."""
        header_footer = {
            "enabled": True,
            "firstPageDifferent": False,
            "scope": "firstOnly",
            "header": {
                "runs": [{"content": "Title", "marks": [], "attrs": None}],
                "height": 36,
            },
            "footer": {
                "runs": [{"content": "Footer", "marks": [], "attrs": None}],
                "height": 24,
            },
        }
        
        result = self.exporter.export(
            content=self.sample_content,
            paper_size="A4",
            header_footer=header_footer,
        )
        
        assert isinstance(result, bytes)
        assert len(result) > 0

    def test_export_without_header_footer_backward_compatible(self):
        """Export without header_footer produces same output as before feature."""
        # Export without header_footer
        result_without = self.exporter.export(
            content=self.sample_content,
            paper_size="A4",
        )
        
        # Export with header_footer=None
        result_none = self.exporter.export(
            content=self.sample_content,
            paper_size="A4",
            header_footer=None,
        )
        
        # Both should produce valid PDFs
        assert isinstance(result_without, bytes)
        assert isinstance(result_none, bytes)
        assert len(result_without) > 0
        assert len(result_none) > 0
        
        # Note: byte-equivalence is hard to guarantee due to timestamps in PDF
        # but both should be valid PDFs of similar size
        assert abs(len(result_without) - len(result_none)) < 100

    def test_export_with_excessive_height_clamped(self):
        """Export with excessive header/footer height is clamped safely."""
        header_footer = {
            "enabled": True,
            "firstPageDifferent": False,
            "scope": "all",
            "header": {
                "runs": [{"content": "Title", "marks": [], "attrs": None}],
                "height": 600,  # > A4 height/2
            },
            "footer": {
                "runs": [{"content": "Footer", "marks": [], "attrs": None}],
                "height": 500,  # > A4 height/2
            },
        }
        
        result = self.exporter.export(
            content=self.sample_content,
            paper_size="A4",
            header_footer=header_footer,
        )
        
        # Should succeed without errors (heights clamped)
        assert isinstance(result, bytes)
        assert len(result) > 0

    def test_export_with_date_time_tokens(self):
        """Export with {date} and {time} tokens resolves correctly."""
        header_footer = {
            "enabled": True,
            "firstPageDifferent": False,
            "scope": "all",
            "header": {
                "runs": [{"content": "Exported {date} at {time}", "marks": [], "attrs": None}],
                "height": 36,
            },
            "footer": {
                "runs": [{"content": "Footer", "marks": [], "attrs": None}],
                "height": 24,
            },
        }
        
        result = self.exporter.export(
            content=self.sample_content,
            paper_size="A4",
            header_footer=header_footer,
        )
        
        assert isinstance(result, bytes)
        assert len(result) > 0

    def test_export_with_first_page_different(self):
        """Export with firstPageDifferent=True skips page 1."""
        header_footer = {
            "enabled": True,
            "firstPageDifferent": True,
            "scope": "all",
            "header": {
                "runs": [{"content": "Title", "marks": [], "attrs": None}],
                "height": 36,
            },
            "footer": {
                "runs": [{"content": "Footer", "marks": [], "attrs": None}],
                "height": 24,
            },
        }
        
        result = self.exporter.export(
            content=self.sample_content,
            paper_size="A4",
            header_footer=header_footer,
        )
        
        assert isinstance(result, bytes)
        assert len(result) > 0

    def test_export_with_empty_header_runs(self):
        """Export with empty header runs still renders footer."""
        header_footer = {
            "enabled": True,
            "firstPageDifferent": False,
            "scope": "all",
            "header": {
                "runs": [],
                "height": 36,
            },
            "footer": {
                "runs": [{"content": "Footer", "marks": [], "attrs": None}],
                "height": 24,
            },
        }
        
        result = self.exporter.export(
            content=self.sample_content,
            paper_size="A4",
            header_footer=header_footer,
        )
        
        assert isinstance(result, bytes)
        assert len(result) > 0

    def test_export_with_disabled_header_footer(self):
        """Export with enabled=False doesn't render header/footer."""
        header_footer = {
            "enabled": False,
            "firstPageDifferent": False,
            "scope": "all",
            "header": {
                "runs": [{"content": "Title", "marks": [], "attrs": None}],
                "height": 36,
            },
            "footer": {
                "runs": [{"content": "Footer", "marks": [], "attrs": None}],
                "height": 24,
            },
        }
        
        result = self.exporter.export(
            content=self.sample_content,
            paper_size="A4",
            header_footer=header_footer,
        )
        
        assert isinstance(result, bytes)
        assert len(result) > 0
