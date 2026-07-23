"""Tests for ExportRequest schema with header_footer support."""
import pytest
from pydantic import ValidationError
from app.api.documents import ExportRequest


class TestExportRequestSchema:
    """Test ExportRequest accepts and validates header_footer config."""

    def test_export_request_without_header_footer(self):
        """ExportRequest works without header_footer (backward compatibility)."""
        request = ExportRequest(
            content={"children": []},
            paper_size="A4",
        )
        assert request.header_footer is None

    def test_export_request_with_valid_header_footer(self):
        """ExportRequest accepts valid header_footer config."""
        request = ExportRequest(
            content={"children": []},
            header_footer={
                "enabled": True,
                "firstPageDifferent": False,
                "header": {
                    "runs": [{"content": "Title", "marks": [], "attrs": None}],
                    "height": 36,
                },
                "footer": {
                    "runs": [{"content": "Page {pageNumber}", "marks": [], "attrs": None}],
                    "height": 24,
                },
                "scope": "all",
            },
        )
        assert request.header_footer is not None
        assert request.header_footer.enabled is True
        assert request.header_footer.firstPageDifferent is False
        assert request.header_footer.scope == "all"
        assert len(request.header_footer.header.runs) == 1
        assert request.header_footer.header.runs[0].content == "Title"
        assert request.header_footer.header.height == 36

    def test_export_request_rejects_invalid_scope(self):
        """ExportRequest rejects invalid scope values."""
        with pytest.raises(ValidationError) as exc_info:
            ExportRequest(
                content={"children": []},
                header_footer={
                    "enabled": True,
                    "header": {"runs": [], "height": 36},
                    "footer": {"runs": [], "height": 24},
                    "scope": "invalid",  # Invalid scope
                },
            )
        assert "scope" in str(exc_info.value).lower()

    def test_export_request_accepts_all_valid_scopes(self):
        """ExportRequest accepts all valid scope values."""
        for scope in ["all", "exceptFirst", "firstOnly"]:
            request = ExportRequest(
                content={"children": []},
                header_footer={
                    "enabled": True,
                    "header": {"runs": [], "height": 36},
                    "footer": {"runs": [], "height": 24},
                    "scope": scope,
                },
            )
            assert request.header_footer.scope == scope

    def test_export_request_rejects_negative_height(self):
        """ExportRequest rejects negative height values."""
        with pytest.raises(ValidationError):
            ExportRequest(
                content={"children": []},
                header_footer={
                    "enabled": True,
                    "header": {"runs": [], "height": -10},  # Negative height
                    "footer": {"runs": [], "height": 24},
                },
            )

    def test_export_request_default_scope_is_all(self):
        """ExportRequest defaults scope to 'all' when not provided."""
        request = ExportRequest(
            content={"children": []},
            header_footer={
                "enabled": True,
                "header": {"runs": [], "height": 36},
                "footer": {"runs": [], "height": 24},
                # scope not provided
            },
        )
        assert request.header_footer.scope == "all"

    def test_export_request_default_first_page_different_is_false(self):
        """ExportRequest defaults firstPageDifferent to False when not provided."""
        request = ExportRequest(
            content={"children": []},
            header_footer={
                "enabled": True,
                "header": {"runs": [], "height": 36},
                "footer": {"runs": [], "height": 24},
                # firstPageDifferent not provided
            },
        )
        assert request.header_footer.firstPageDifferent is False
