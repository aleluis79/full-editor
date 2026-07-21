"""Image upload router.

POST /api/images/upload — accepts multipart image upload, validates
type/extension/size, saves with UUID filename, returns URL path.
"""
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from ..config import ALLOWED_EXTENSIONS, ALLOWED_MIMETYPES, MAX_UPLOAD_SIZE, UPLOAD_DIR
from ..core.auth import get_current_user
from ..models.user import UserModel


router = APIRouter()


@router.post("/images/upload", status_code=status.HTTP_201_CREATED)
async def upload_image(
    file: UploadFile = File(...),
    user: UserModel = Depends(get_current_user),
):
    """Upload an image file.

    Validates:
    - MIME type is in ALLOWED_MIMETYPES
    - File extension is in ALLOWED_EXTENSIONS
    - File size does not exceed MAX_UPLOAD_SIZE

    Returns:
        {"url": "/uploads/images/<uuid>.<ext>"}
    """
    # Validate MIME type
    if file.content_type not in ALLOWED_MIMETYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type: {file.content_type}. "
                   f"Allowed types: {', '.join(sorted(ALLOWED_MIMETYPES))}",
        )

    # Validate file extension
    original_filename = file.filename or ""
    ext = Path(original_filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file extension: '{ext}'. "
                   f"Allowed extensions: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # Read file content
    content = await file.read()

    # Validate file size
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024 * 1024)}MB.",
        )

    # Ensure upload directory exists
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # Save with UUID filename
    unique_name = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / unique_name
    dest.write_bytes(content)

    return {"url": f"/uploads/images/{unique_name}"}
