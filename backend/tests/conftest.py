"""Pytest fixtures for API testing using SQLite in-memory."""
import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db
from app.core.auth import get_current_user
from app.models.user import UserModel, _generate_id, _utcnow
# Import models so they register with Base.metadata
from app.models.document import DocumentModel  # noqa: F401
from app.models.sharing import DocumentShareModel  # noqa: F401


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh in-memory SQLite database for each test.

    Uses StaticPool so all connections share the same in-memory database.
    Without this, each new connection gets a fresh empty database.
    """
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def override_db(db_session):
    """Override the get_db dependency to use the test SQLite session."""

    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    yield db_session
    app.dependency_overrides.clear()


@pytest.fixture
def client(override_db):
    """FastAPI TestClient with SQLite DB override and auth override.

    Creates a default test user and overrides get_current_user to return it.
    All existing tests keep working without sending real JWTs.
    """
    # Create a default test user
    db = override_db
    user = UserModel(
        id=_generate_id(),
        keycloak_id="test-keycloak-id",
        email="test@example.com",
        display_name="Test User",
        created_at=_utcnow(),
    )
    db.add(user)
    db.commit()

    # Override get_current_user to return the test user
    def _override_get_current_user():
        return user

    app.dependency_overrides[get_current_user] = _override_get_current_user

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


@pytest.fixture
def auth_client(override_db):
    """TestClient with DB override and configurable auth override.

    Creates a test user. Use with test_user or second_user fixture for
    specific user identity in sharing/permission tests.
    """
    db = override_db
    user = UserModel(
        id=_generate_id(),
        keycloak_id="auth-test-keycloak-id",
        email="auth-test@example.com",
        display_name="Auth Test User",
        created_at=_utcnow(),
    )
    db.add(user)
    db.commit()

    def _override_get_current_user():
        return user

    app.dependency_overrides[get_current_user] = _override_get_current_user

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


@pytest.fixture
def test_user(override_db) -> UserModel:
    """Create a test UserModel for sharing tests."""
    db = override_db
    user = UserModel(
        id=_generate_id(),
        keycloak_id="test-keycloak-id",
        email="test@example.com",
        display_name="Test User",
        created_at=_utcnow(),
    )
    db.add(user)
    db.commit()
    return user


@pytest.fixture
def second_user(override_db) -> UserModel:
    """Create a second test user for sharing tests."""
    db = override_db
    user = UserModel(
        id=_generate_id(),
        keycloak_id="second-keycloak-id",
        email="second@example.com",
        display_name="Second User",
        created_at=_utcnow(),
    )
    db.add(user)
    db.commit()
    return user
