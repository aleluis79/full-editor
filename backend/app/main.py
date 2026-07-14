from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api.documents import router as documents_router
from .api.images import router as images_router


app = FastAPI(
    title="Full Editor API",
    description="Professional document editor backend",
    version="0.1.0",
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(documents_router)
app.include_router(images_router, prefix="/api")

# Mount uploads directory as static files
from pathlib import Path  # noqa: E402
uploads_path = Path(__file__).parent.parent / "uploads"
uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")


@app.get("/")
def root():
    """Root endpoint."""
    return {
        "message": "Full Editor API",
        "docs": "/docs",
        "version": "0.1.0",
    }


@app.get("/health")
def health():
    """Health check endpoint."""
    return {"status": "healthy"}
