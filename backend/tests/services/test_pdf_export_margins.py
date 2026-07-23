"""Tests for margin adjustment with header/footer."""
from app.services.pdf_export import PDFExporter


class TestAdjustMargins:
    """Test _adjust_margins with various header/footer configurations."""

    def setup_method(self):
        self.exporter = PDFExporter()
        self.exporter._page_height = 842  # A4

    def test_adjust_margins_with_header_footer_enabled(self):
        """Margins increase by header/footer heights when enabled."""
        margins = {"top": 72, "bottom": 72}
        header_footer = {
            "enabled": True,
            "header": {"height": 36},
            "footer": {"height": 24},
        }
        top, bottom = self.exporter._adjust_margins(margins, header_footer)
        assert top == 108  # 72 + 36
        assert bottom == 96  # 72 + 24

    def test_adjust_margins_zero_height(self):
        """Zero height doesn't affect margins."""
        margins = {"top": 72, "bottom": 72}
        header_footer = {
            "enabled": True,
            "header": {"height": 0},
            "footer": {"height": 0},
        }
        top, bottom = self.exporter._adjust_margins(margins, header_footer)
        assert top == 72
        assert bottom == 72

    def test_adjust_margins_disabled(self):
        """Disabled header_footer doesn't affect margins."""
        margins = {"top": 72, "bottom": 72}
        header_footer = {
            "enabled": False,
            "header": {"height": 36},
            "footer": {"height": 24},
        }
        top, bottom = self.exporter._adjust_margins(margins, header_footer)
        assert top == 72
        assert bottom == 72

    def test_adjust_margins_none_config(self):
        """None header_footer doesn't affect margins."""
        margins = {"top": 72, "bottom": 72}
        top, bottom = self.exporter._adjust_margins(margins, None)
        assert top == 72
        assert bottom == 72

    def test_adjust_margins_excessive_height_clamped(self):
        """Heights exceeding safe limit are scaled proportionally."""
        margins = {"top": 72, "bottom": 72}
        header_footer = {
            "enabled": True,
            "header": {"height": 500},  # Large value
            "footer": {"height": 24},
        }
        top, bottom = self.exporter._adjust_margins(margins, header_footer)
        # max_total = 842/3 = 280.67
        # total_hf = 524, scale = 280.67/524 = 0.5356
        # header_height = 500 * 0.5356 = 267.8
        # footer_height = 24 * 0.5356 = 12.85
        # top = 72 + 267.8 = 339.8
        # bottom = 72 + 12.85 = 84.85
        assert top > 72 and top < 400  # Reasonable range
        assert bottom > 72 and bottom < 100

    def test_adjust_margins_both_excessive_clamped(self):
        """Both header and footer heights scaled when combined exceeds limit."""
        margins = {"top": 72, "bottom": 72}
        header_footer = {
            "enabled": True,
            "header": {"height": 600},  # Very large
            "footer": {"height": 500},  # Very large
        }
        top, bottom = self.exporter._adjust_margins(margins, header_footer)
        # max_total = 280.67, total_hf = 1100, scale = 0.255
        # Both should be scaled down significantly
        assert top > 72 and top < 300
        assert bottom > 72 and bottom < 250

    def test_adjust_margins_missing_top_bottom(self):
        """Missing top/bottom in margins defaults to 72."""
        margins = {}
        header_footer = {
            "enabled": True,
            "header": {"height": 36},
            "footer": {"height": 24},
        }
        top, bottom = self.exporter._adjust_margins(margins, header_footer)
        assert top == 72 + 36
        assert bottom == 72 + 24

    def test_adjust_margins_reasonable_height_not_scaled(self):
        """Reasonable heights are not scaled down."""
        margins = {"top": 72, "bottom": 72}
        header_footer = {
            "enabled": True,
            "header": {"height": 100},  # Reasonable
            "footer": {"height": 50},   # Reasonable
        }
        top, bottom = self.exporter._adjust_margins(margins, header_footer)
        # total = 150 < 280.67, so no scaling
        assert top == 72 + 100
        assert bottom == 72 + 50
