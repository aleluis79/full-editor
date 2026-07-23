"""Tests for header/footer rendering scope logic."""
from unittest.mock import Mock, MagicMock
from app.services.pdf_export import PDFExporter


class TestRenderHeaderFooterScope:
    """Test _render_header_footer scope branching logic."""

    def setup_method(self):
        self.exporter = PDFExporter()
        # Mock canvas and doc
        self.canvas = Mock()
        self.canvas.getPageNumber = Mock()
        self.doc = Mock()
        self.doc.leftMargin = 72
        self.doc.topMargin = 72
        self.doc.bottomMargin = 72
        self.exporter._page_height = 842  # A4

    def test_scope_all_renders_on_all_pages(self):
        """Scope 'all' renders header/footer on every page."""
        self.exporter._header_footer_config = {
            "enabled": True,
            "scope": "all",
            "firstPageDifferent": False,
            "header": {"runs": [{"content": "Title"}], "height": 36},
            "footer": {"runs": [{"content": "Footer"}], "height": 24},
        }
        
        # Mock _draw_header_footer to track calls
        self.exporter._draw_header_footer = Mock()
        
        # Page 1
        self.canvas.getPageNumber.return_value = 1
        self.exporter._render_header_footer(self.canvas, self.doc)
        assert self.exporter._draw_header_footer.call_count == 2  # header + footer
        
        # Page 2
        self.exporter._draw_header_footer.reset_mock()
        self.canvas.getPageNumber.return_value = 2
        self.exporter._render_header_footer(self.canvas, self.doc)
        assert self.exporter._draw_header_footer.call_count == 2
        
        # Page 5
        self.exporter._draw_header_footer.reset_mock()
        self.canvas.getPageNumber.return_value = 5
        self.exporter._render_header_footer(self.canvas, self.doc)
        assert self.exporter._draw_header_footer.call_count == 2

    def test_scope_except_first_skips_page_1(self):
        """Scope 'exceptFirst' skips page 1, renders on pages 2+."""
        self.exporter._header_footer_config = {
            "enabled": True,
            "scope": "exceptFirst",
            "firstPageDifferent": False,
            "header": {"runs": [{"content": "Title"}], "height": 36},
            "footer": {"runs": [{"content": "Footer"}], "height": 24},
        }
        
        self.exporter._draw_header_footer = Mock()
        
        # Page 1: should NOT render
        self.canvas.getPageNumber.return_value = 1
        self.exporter._render_header_footer(self.canvas, self.doc)
        assert self.exporter._draw_header_footer.call_count == 0
        
        # Page 2: should render
        self.canvas.getPageNumber.return_value = 2
        self.exporter._render_header_footer(self.canvas, self.doc)
        assert self.exporter._draw_header_footer.call_count == 2
        
        # Page 3: should render
        self.exporter._draw_header_footer.reset_mock()
        self.canvas.getPageNumber.return_value = 3
        self.exporter._render_header_footer(self.canvas, self.doc)
        assert self.exporter._draw_header_footer.call_count == 2

    def test_scope_first_only_renders_page_1_only(self):
        """Scope 'firstOnly' renders only on page 1."""
        self.exporter._header_footer_config = {
            "enabled": True,
            "scope": "firstOnly",
            "firstPageDifferent": False,
            "header": {"runs": [{"content": "Title"}], "height": 36},
            "footer": {"runs": [{"content": "Footer"}], "height": 24},
        }
        
        self.exporter._draw_header_footer = Mock()
        
        # Page 1: should render
        self.canvas.getPageNumber.return_value = 1
        self.exporter._render_header_footer(self.canvas, self.doc)
        assert self.exporter._draw_header_footer.call_count == 2
        
        # Page 2: should NOT render
        self.exporter._draw_header_footer.reset_mock()
        self.canvas.getPageNumber.return_value = 2
        self.exporter._render_header_footer(self.canvas, self.doc)
        assert self.exporter._draw_header_footer.call_count == 0
        
        # Page 5: should NOT render
        self.canvas.getPageNumber.return_value = 5
        self.exporter._render_header_footer(self.canvas, self.doc)
        assert self.exporter._draw_header_footer.call_count == 0

    def test_first_page_different_overrides_scope_all(self):
        """firstPageDifferent=True skips page 1 even with scope='all'."""
        self.exporter._header_footer_config = {
            "enabled": True,
            "scope": "all",
            "firstPageDifferent": True,
            "header": {"runs": [{"content": "Title"}], "height": 36},
            "footer": {"runs": [{"content": "Footer"}], "height": 24},
        }
        
        self.exporter._draw_header_footer = Mock()
        
        # Page 1: should NOT render (firstPageDifferent wins)
        self.canvas.getPageNumber.return_value = 1
        self.exporter._render_header_footer(self.canvas, self.doc)
        assert self.exporter._draw_header_footer.call_count == 0
        
        # Page 2: should render
        self.canvas.getPageNumber.return_value = 2
        self.exporter._render_header_footer(self.canvas, self.doc)
        assert self.exporter._draw_header_footer.call_count == 2

    def test_first_page_different_overrides_scope_except_first(self):
        """firstPageDifferent=True with scope='exceptFirst' still skips page 1."""
        self.exporter._header_footer_config = {
            "enabled": True,
            "scope": "exceptFirst",
            "firstPageDifferent": True,
            "header": {"runs": [{"content": "Title"}], "height": 36},
            "footer": {"runs": [], "height": 0},
        }
        
        self.exporter._draw_header_footer = Mock()
        
        # Page 1: should NOT render
        self.canvas.getPageNumber.return_value = 1
        self.exporter._render_header_footer(self.canvas, self.doc)
        assert self.exporter._draw_header_footer.call_count == 0
        
        # Page 2: should render
        self.canvas.getPageNumber.return_value = 2
        self.exporter._render_header_footer(self.canvas, self.doc)
        assert self.exporter._draw_header_footer.call_count == 1  # header only

    def test_first_page_different_overrides_scope_first_only(self):
        """firstPageDifferent=True with scope='firstOnly' skips page 1."""
        self.exporter._header_footer_config = {
            "enabled": True,
            "scope": "firstOnly",
            "firstPageDifferent": True,
            "header": {"runs": [{"content": "Title"}], "height": 36},
            "footer": {"runs": [], "height": 0},
        }
        
        self.exporter._draw_header_footer = Mock()
        
        # Page 1: should NOT render (firstPageDifferent wins over firstOnly)
        self.canvas.getPageNumber.return_value = 1
        self.exporter._render_header_footer(self.canvas, self.doc)
        assert self.exporter._draw_header_footer.call_count == 0
        
        # Page 2: should NOT render (firstOnly scope)
        self.canvas.getPageNumber.return_value = 2
        self.exporter._render_header_footer(self.canvas, self.doc)
        assert self.exporter._draw_header_footer.call_count == 0

    def test_no_config_does_nothing(self):
        """No header_footer config means no rendering."""
        self.exporter._header_footer_config = None
        self.exporter._draw_header_footer = Mock()
        
        self.canvas.getPageNumber.return_value = 1
        self.exporter._render_header_footer(self.canvas, self.doc)
        assert self.exporter._draw_header_footer.call_count == 0

    def test_empty_header_runs_skips_header(self):
        """Empty header runs skip header drawing but footer still renders."""
        self.exporter._header_footer_config = {
            "enabled": True,
            "scope": "all",
            "firstPageDifferent": False,
            "header": {"runs": [], "height": 36},
            "footer": {"runs": [{"content": "Footer"}], "height": 24},
        }
        
        self.exporter._draw_header_footer = Mock()
        
        self.canvas.getPageNumber.return_value = 1
        self.exporter._render_header_footer(self.canvas, self.doc)
        # Only footer should be drawn (1 call, not 2)
        assert self.exporter._draw_header_footer.call_count == 1

    def test_empty_footer_runs_skips_footer(self):
        """Empty footer runs skip footer drawing but header still renders."""
        self.exporter._header_footer_config = {
            "enabled": True,
            "scope": "all",
            "firstPageDifferent": False,
            "header": {"runs": [{"content": "Title"}], "height": 36},
            "footer": {"runs": [], "height": 24},
        }
        
        self.exporter._draw_header_footer = Mock()
        
        self.canvas.getPageNumber.return_value = 1
        self.exporter._render_header_footer(self.canvas, self.doc)
        # Only header should be drawn (1 call, not 2)
        assert self.exporter._draw_header_footer.call_count == 1
