# Design: Paste and Insert Images

## Technical Approach

Shared `uploadAndInsertImage(file: File)` utility that validates → uploads → inserts. Both paste (onPaste event on textarea) and toolbar (hidden `<input type="file">`) call the same function. Backend serves a single `POST /api/images/upload` endpoint, saves with UUID filenames, mounts `uploads/` as static.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|----------|---------|--------|-----------|
| Paste detection event | onPaste vs extending keydown handler | Add `onPaste` on textarea | `event.clipboardData` is only available on the native `paste` event, not on `keydown` with Ctrl+V |
| Upload+insert reuse | Shared utility vs duplicated logic | Shared `uploadAndInsertImage` | Both paste and toolbar need identical validation, upload, error handling — kept in one place |
| Filename scheme | UUID vs original name | UUID filenames | Prevents path traversal, name collisions, info leaks via sequential IDs |
| Image src in document | URL path vs absolute path | URL path (`/uploads/images/uuid.ext`) | Works in browser natively; PDF export maps URL path to filesystem path server-side |
| File validation | Client-only vs server-only vs both | Both layers | Client for instant UX feedback; server as security gate (must validate MIME by content, not extension) |

## Data Flow

```
Paste event (onPaste)
   │  clipboardData.files / items
   ▼
uploadAndInsertImage(file)
   │  validate (type, size)
   │  POST /api/images/upload (multipart/form-data)
   ▼
Backend: images.py
   │  validate content-type, extension, ≤10MB
   │  save as uploads/images/<uuid>.<ext>
   │  return { "url": "/uploads/images/<uuid>.<ext>" }
   ▼
uploadAndInsertImage (continued)
   │  call store.insertImage(cursor.nodeId, url)
   ▼
ImageBlock renders via <img src={url}>

Toolbar button flow (same path):
   click → hidden input.click()
   onChange → uploadAndInsertImage(file)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/api/client.ts` | Modify | Add `uploadImage(file: File): Promise<string>` — POST multipart, return URL |
| `frontend/src/components/Editor.tsx` | Modify | Add `onPaste` handler on textarea; detect image from `clipboardData`, call shared util; fall through to text paste |
| `frontend/src/components/Toolbar.tsx` | Modify | Add image button (near table button), hidden `<input type="file">`, onChange → shared util |
| `frontend/src/stores/document-store.ts` | Modify | Add `uploadAndInsertImage(file: File): Promise<string>` action that wraps client call + `insertImage` |
| `backend/app/api/images.py` | Create | `POST /api/images/upload` endpoint |
| `backend/app/main.py` | Modify | Register images router, mount `uploads/` as static files |
| `backend/app/config.py` | Create | `UPLOAD_DIR`, `MAX_UPLOAD_SIZE`, `ALLOWED_EXTENSIONS` constants |
| `backend/app/services/pdf_export.py` | Modify | Map `/uploads/` URL paths to filesystem paths in `_process_image` |

## Interfaces / Contracts

```typescript
// api/client.ts
async function uploadImage(file: File): Promise<string>
// POST /api/images/upload as multipart/form-data
// Returns: URL string like "/uploads/images/uuid.ext"
// Throws: ValidationError | UploadError

// document-store action
async function uploadAndInsertImage(file: File): Promise<string>
// Validates → uploads → calls this.insertImage(cursor.nodeId, url)
// Returns: the created image block ID
```

```python
# backend/app/api/images.py
@router.post("/images/upload")
async def upload_image(file: UploadFile = File(...)) -> dict
# Request: multipart/form-data with file field
# Response 201: { "url": "/uploads/images/<uuid>.<ext>" }
# Response 400: { "detail": "Invalid file type" }
# Response 413: { "detail": "File too large" }
```

```python
# backend/app/config.py
UPLOAD_DIR = Path(__file__).parent.parent / "uploads" / "images"
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
ALLOWED_MIMETYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `uploadImage` validation | Mock file objects with valid/invalid types and sizes; assert throws |
| Unit | Backend endpoint validation | `httpx.TestClient` — POST valid/invalid files, assert 201/400/413 |
| Unit | `_process_image` URL→path mapping | Ensure `/uploads/` URLs resolve to filesystem path |
| Integration | Paste → upload → insert | Vitest: create paste event with `clipboardData.files`, assert `insertImage` called with returned URL |
| Integration | Toolbar → file picker → upload | Simulate `input.files` change, assert same flow |
| E2E | Full paste flow | Open browser, copy image, Ctrl+V, verify ImageBlock renders |

## Migration / Rollout

No migration required. Existing documents have no image blocks — new documents will use the new flow. PDF export already handles image blocks gracefully (fallback text on load failure).

## Open Questions

- [ ] PDF export: `_process_image` passes `src` directly to ReportLab `Image()`. URL paths won't resolve server-side — needs path mapping from URL to `UPLOAD_DIR`. Update `_process_image` to resolve `src` relative to a configured base path.
