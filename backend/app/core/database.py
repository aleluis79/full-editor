from sqlmodel import SQLModel, create_engine
from dotenv import load_dotenv
import os

load_dotenv()

# SQLite database (simple for development)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./editor.db")

engine = create_engine(DATABASE_URL, echo=False)


def init_db():
    """Initialize database tables."""
    SQLModel.metadata.create_all(engine)


def get_session():
    """Get database session."""
    from sqlmodel import Session
    with Session(engine) as session:
        yield session
