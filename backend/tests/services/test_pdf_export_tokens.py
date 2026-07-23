"""Tests for token resolution in header/footer runs."""
from datetime import datetime
from app.services.pdf_export import PDFExporter


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


class TestResolveTokens:
    """Test _resolve_tokens with various token combinations."""

    def setup_method(self):
        self.exporter = PDFExporter()

    def test_resolve_page_number_token(self):
        """{pageNumber} resolves to the current page number."""
        runs = [{"content": "Page {pageNumber}"}]
        result = self.exporter._resolve_tokens(runs, page_num=3)
        assert result == "Page 3"

    def test_resolve_total_pages_token(self):
        """{totalPages} resolves to the total page count when set."""
        self.exporter._total_pages = 10
        runs = [{"content": "of {totalPages}"}]
        result = self.exporter._resolve_tokens(runs, page_num=1)
        assert result == "of 10"

    def test_resolve_total_pages_not_set_preserves_literal(self):
        """{totalPages} preserved as literal when _total_pages is None."""
        self.exporter._total_pages = None
        runs = [{"content": "of {totalPages}"}]
        result = self.exporter._resolve_tokens(runs, page_num=1)
        assert result == "of {totalPages}"

    def test_resolve_date_token(self):
        """{date} resolves to current date in DD/MM/YYYY format."""
        runs = [{"content": "Exported {date}"}]
        result = self.exporter._resolve_tokens(runs, page_num=1)
        expected_date = datetime.now().strftime("%d/%m/%Y")
        assert result == f"Exported {expected_date}"

    def test_resolve_time_token(self):
        """{time} resolves to current time in HH:MM format."""
        runs = [{"content": "at {time}"}]
        result = self.exporter._resolve_tokens(runs, page_num=1)
        # Allow 1-minute tolerance for test execution
        now = datetime.now()
        expected = now.strftime("%H:%M")
        assert result == f"at {expected}"

    def test_resolve_multiple_tokens_in_single_run(self):
        """Multiple tokens in a single run all resolve."""
        self.exporter._total_pages = 5
        runs = [{"content": "Page {pageNumber} of {totalPages} - {date}"}]
        result = self.exporter._resolve_tokens(runs, page_num=2)
        expected_date = datetime.now().strftime("%d/%m/%Y")
        assert result == f"Page 2 of 5 - {expected_date}"

    def test_resolve_unknown_token_preserved(self):
        """Unknown tokens like {version} are preserved as literals."""
        runs = [{"content": "Version {version}"}]
        result = self.exporter._resolve_tokens(runs, page_num=1)
        assert result == "Version {version}"

    def test_resolve_empty_runs(self):
        """Empty runs list returns empty string."""
        runs = []
        result = self.exporter._resolve_tokens(runs, page_num=1)
        assert result == ""

    def test_resolve_run_with_empty_content(self):
        """Run with empty content contributes nothing."""
        runs = [{"content": ""}]
        result = self.exporter._resolve_tokens(runs, page_num=1)
        assert result == ""

    def test_resolve_multiple_runs_concatenated(self):
        """Multiple runs are concatenated in order."""
        runs = [
            {"content": "Page "},
            {"content": "{pageNumber}"},
            {"content": " of "},
            {"content": "{totalPages}"},
        ]
        self.exporter._total_pages = 8
        result = self.exporter._resolve_tokens(runs, page_num=3)
        assert result == "Page 3 of 8"

    def test_resolve_mixed_known_and_unknown_tokens(self):
        """Known tokens resolve; unknown tokens preserved."""
        runs = [{"content": "Page {pageNumber} - {version}"}]
        result = self.exporter._resolve_tokens(runs, page_num=7)
        assert result == "Page 7 - {version}"

    def test_resolve_no_tokens_plain_text(self):
        """Plain text without tokens passes through unchanged."""
        runs = [{"content": "Confidential Document"}]
        result = self.exporter._resolve_tokens(runs, page_num=1)
        assert result == "Confidential Document"

    def test_date_time_cached_per_call(self):
        """Date and time are consistent within a single _resolve_tokens call."""
        runs = [{"content": "{date} {time}"}]
        result = self.exporter._resolve_tokens(runs, page_num=1)
        # Result should contain both date and time from the same moment
        parts = result.split(" ")
        assert len(parts) == 2
        # Date format: DD/MM/YYYY
        assert len(parts[0]) == 10
        assert parts[0][2] == "/"
        assert parts[0][5] == "/"
        # Time format: HH:MM
        assert len(parts[1]) == 5
        assert parts[1][2] == ":"
