"""Tests for the Comment SQLAlchemy model and Pydantic schemas."""
from app.models.comment import CommentModel, CommentCreate, CommentUpdate, CommentResponse


class TestCommentSchemas:
    """Verify Pydantic schema creation and defaults."""

    def test_comment_create_requires_block_id_and_content(self):
        data = CommentCreate(block_id="block-1", content="Great work!")
        assert data.block_id == "block-1"
        assert data.content == "Great work!"
        assert data.parent_id is None

    def test_comment_create_with_parent(self):
        data = CommentCreate(block_id="block-1", content="Reply!", parent_id="parent-1")
        assert data.block_id == "block-1"
        assert data.content == "Reply!"
        assert data.parent_id == "parent-1"

    def test_comment_update_partial(self):
        data = CommentUpdate(content="Updated content")
        assert data.content == "Updated content"
        assert data.resolved is None

    def test_comment_update_resolved_only(self):
        data = CommentUpdate(resolved=True)
        assert data.content is None
        assert data.resolved is True

    def test_comment_update_all_fields(self):
        data = CommentUpdate(content="New text", resolved=True)
        assert data.content == "New text"
        assert data.resolved is True

    def test_comment_response_has_replies(self):
        response = CommentResponse(
            id="c1",
            document_id="doc-1",
            block_id="block-1",
            author_id="user-1",
            author_display_name="Alice",
            author_email="alice@test.com",
            content="Hello",
            created_at="2026-01-01T00:00:00Z",
            updated_at="2026-01-01T00:00:00Z",
        )
        assert response.id == "c1"
        assert response.author_display_name == "Alice"
        assert response.replies == []

    def test_comment_response_with_nested_replies(self):
        reply = CommentResponse(
            id="c2",
            document_id="doc-1",
            block_id="block-1",
            author_id="user-2",
            author_display_name="Bob",
            author_email="bob@test.com",
            content="Reply!",
            parent_id="c1",
            created_at="2026-01-02T00:00:00Z",
            updated_at="2026-01-02T00:00:00Z",
        )
        parent = CommentResponse(
            id="c1",
            document_id="doc-1",
            block_id="block-1",
            author_id="user-1",
            author_display_name="Alice",
            author_email="alice@test.com",
            content="Hello",
            created_at="2026-01-01T00:00:00Z",
            updated_at="2026-01-01T00:00:00Z",
            replies=[reply],
        )
        assert len(parent.replies) == 1
        assert parent.replies[0].content == "Reply!"
        assert parent.replies[0].parent_id == "c1"


class TestCommentModel:
    """Verify CommentModel SQLAlchemy attributes."""

    def test_model_tablename(self):
        assert CommentModel.__tablename__ == "comments"

    def test_model_has_required_columns(self):
        columns = [c.name for c in CommentModel.__table__.columns]
        for col in ("id", "document_id", "block_id", "author_id", "content",
                    "parent_id", "resolved", "created_at", "updated_at"):
            assert col in columns, f"Missing column: {col}"

    def test_model_resolved_defaults_false(self):
        col = CommentModel.__table__.columns["resolved"]
        assert col.default is not None
        assert col.default.arg is False
