"""Tests for the comment storage layer."""
import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.user import UserModel, _generate_id, _utcnow
from app.models.document import DocumentModel
from app.models.sharing import DocumentShareModel
from app.models.comment import CommentModel, CommentCreate, CommentUpdate


@pytest.fixture
def db_session():
    """In-memory SQLite for storage tests."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def owner(db_session) -> UserModel:
    user = UserModel(
        id=_generate_id(),
        keycloak_id="owner-kc",
        email="owner@test.com",
        display_name="Owner",
        created_at=_utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def author(db_session) -> UserModel:
    user = UserModel(
        id=_generate_id(),
        keycloak_id="author-kc",
        email="author@test.com",
        display_name="Author",
        created_at=_utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def other_user(db_session) -> UserModel:
    user = UserModel(
        id=_generate_id(),
        keycloak_id="other-kc",
        email="other@test.com",
        display_name="Other User",
        created_at=_utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def document(db_session, author: UserModel) -> DocumentModel:
    """Document owned by author. Storage _has_access checks need
    the user to be the owner or have a share record."""
    doc = DocumentModel(
        id=_generate_id(),
        title="Test Doc",
        content="{}",
        owner_id=author.id,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db_session.add(doc)
    db_session.commit()
    return doc


@pytest.fixture
def shared_document(db_session, owner: UserModel, author: UserModel) -> DocumentModel:
    """Document owned by owner, with read share granted to author."""
    doc = DocumentModel(
        id=_generate_id(),
        title="Shared Doc",
        content="{}",
        owner_id=owner.id,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db_session.add(doc)
    db_session.flush()

    share = DocumentShareModel(
        id=_generate_id(),
        document_id=doc.id,
        shared_with_user_id=author.id,
        permission="read",
        created_at=_utcnow(),
    )
    db_session.add(share)
    db_session.commit()
    return doc


class TestCommentStorage:
    """Integration tests for comment_storage module."""

    def test_create_and_list_comments(self, db_session, document, author):
        from app.core.comment_storage import create_comment, list_comments

        data = CommentCreate(block_id="block-1", content="Great comment!")
        result = create_comment(db_session, document.id, data, author)
        assert result.content == "Great comment!"
        assert result.block_id == "block-1"
        assert result.author_id == author.id
        assert result.author_display_name == "Author"
        assert result.parent_id is None
        assert result.resolved is False
        assert result.replies == []

        comments = list_comments(db_session, document.id, author)
        assert len(comments) == 1
        assert comments[0].id == result.id

    def test_list_comments_empty(self, db_session, document, author):
        from app.core.comment_storage import list_comments

        comments = list_comments(db_session, document.id, author)
        assert comments == []

    def test_create_reply(self, db_session, document, author):
        from app.core.comment_storage import create_comment, create_reply, list_comments

        parent = create_comment(
            db_session, document.id, CommentCreate(block_id="block-1", content="Parent"), author
        )
        reply = create_reply(
            db_session, document.id, parent.id,
            CommentCreate(block_id="block-1", content="Reply!"), author
        )
        assert reply.parent_id == parent.id
        assert reply.content == "Reply!"

        comments = list_comments(db_session, document.id, author)
        assert len(comments) == 1
        assert len(comments[0].replies) == 1
        assert comments[0].replies[0].content == "Reply!"

    def test_update_comment(self, db_session, document, author):
        from app.core.comment_storage import create_comment, update_comment

        comment = create_comment(
            db_session, document.id, CommentCreate(block_id="block-1", content="Original"), author
        )
        updated = update_comment(
            db_session, comment.id, CommentUpdate(content="Updated!"), author
        )
        assert updated.content == "Updated!"

    def test_update_comment_not_author(self, db_session, document, author, other_user):
        from app.core.comment_storage import create_comment, update_comment

        comment = create_comment(
            db_session, document.id, CommentCreate(block_id="block-1", content="Original"), author
        )
        with pytest.raises(PermissionError):
            update_comment(db_session, comment.id, CommentUpdate(content="Hacked!"), other_user)

    def test_delete_comment(self, db_session, document, author):
        from app.core.comment_storage import create_comment, delete_comment, list_comments

        comment = create_comment(
            db_session, document.id, CommentCreate(block_id="block-1", content="To delete"), author
        )
        result = delete_comment(db_session, comment.id, author)
        assert result["message"] == "Comment deleted"

        comments = list_comments(db_session, document.id, author)
        assert len(comments) == 0

    def test_delete_comment_owner_can_delete(self, db_session, shared_document, owner, author):
        from app.core.comment_storage import create_comment, delete_comment

        comment = create_comment(
            db_session, shared_document.id,
            CommentCreate(block_id="block-1", content="By author"), author
        )
        result = delete_comment(db_session, comment.id, owner)
        assert result["message"] == "Comment deleted"

    def test_delete_comment_not_author_not_owner(self, db_session, shared_document, author, other_user):
        from app.core.comment_storage import create_comment, delete_comment

        comment = create_comment(
            db_session, shared_document.id,
            CommentCreate(block_id="block-1", content="Mine"), author
        )
        with pytest.raises(PermissionError):
            delete_comment(db_session, comment.id, other_user)

    def test_toggle_resolved(self, db_session, document, author):
        from app.core.comment_storage import create_comment, toggle_resolved

        comment = create_comment(
            db_session, document.id, CommentCreate(block_id="block-1", content="Needs fix"), author
        )
        resolved = toggle_resolved(db_session, comment.id, author)
        assert resolved.resolved is True

        unresolved = toggle_resolved(db_session, comment.id, author)
        assert unresolved.resolved is False

    def test_toggle_resolved_owner_can_resolve(self, db_session, shared_document, owner, author):
        from app.core.comment_storage import create_comment, toggle_resolved

        comment = create_comment(
            db_session, shared_document.id,
            CommentCreate(block_id="block-1", content="Fix this"), author
        )
        resolved = toggle_resolved(db_session, comment.id, owner)
        assert resolved.resolved is True

    def test_toggle_resolved_not_author_not_owner(self, db_session, shared_document, author, other_user):
        from app.core.comment_storage import create_comment, toggle_resolved

        comment = create_comment(
            db_session, shared_document.id,
            CommentCreate(block_id="block-1", content="Fix this"), author
        )
        with pytest.raises(PermissionError):
            toggle_resolved(db_session, comment.id, other_user)

    def test_list_comments_only_for_document(self, db_session, document, author, owner):
        from app.core.comment_storage import create_comment, list_comments

        doc2 = DocumentModel(
            id=_generate_id(),
            title="Other Doc",
            content="{}",
            owner_id=author.id,
            created_at=_utcnow(),
            updated_at=_utcnow(),
        )
        db_session.add(doc2)
        db_session.commit()

        create_comment(
            db_session, document.id, CommentCreate(block_id="block-1", content="Doc1 comment"), author
        )
        create_comment(
            db_session, doc2.id, CommentCreate(block_id="block-1", content="Doc2 comment"), author
        )

        comments = list_comments(db_session, document.id, author)
        assert len(comments) == 1
        assert comments[0].content == "Doc1 comment"

    def test_update_comment_not_found(self, db_session, author):
        from app.core.comment_storage import update_comment

        with pytest.raises(ValueError, match="Comment not found"):
            update_comment(db_session, "nonexistent", CommentUpdate(content="x"), author)

    def test_delete_comment_not_found(self, db_session, author):
        from app.core.comment_storage import delete_comment

        with pytest.raises(ValueError, match="Comment not found"):
            delete_comment(db_session, "nonexistent", author)

    def test_create_comment_no_access(self, db_session, document, other_user):
        from app.core.comment_storage import create_comment

        with pytest.raises(PermissionError):
            create_comment(
                db_session, document.id,
                CommentCreate(block_id="b1", content="no access"), other_user
            )

    def test_list_comments_no_access(self, db_session, document, other_user):
        from app.core.comment_storage import list_comments

        with pytest.raises(PermissionError):
            list_comments(db_session, document.id, other_user)
