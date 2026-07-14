# Tasks: Paste and Insert Images

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

| Field | Value |
|-------|-------|
| Estimated changed lines | ~210 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

## Phase 1: Backend Foundation

- [x] 1.1 Create `backend/app/config.py` — `UPLOAD_DIR`, `MAX_UPLOAD_SIZE`, `ALLOWED_EXTENSIONS`, `ALLOWED_MIMETYPES`
- [x] 1.2 Create `backend/app/api/images.py` — `POST /api/images/upload` with MIME validation, UUID filename, 10MB limit
- [x] 1.3 Modify `backend/app/main.py` — register `images.router` + mount `uploads/` as static files

## Phase 2: Frontend API Client & Store

- [x] 2.1 Add `uploadImage(file: File): Promise<string>` to `frontend/src/api/client.ts` — POST multipart, return URL
- [x] 2.2 Add `uploadAndInsertImage(file: File): Promise<string>` to `frontend/src/stores/document-store.ts` — validate, upload, call `insertImage`

## Phase 3: Frontend Paste Handler & Toolbar

- [x] 3.1 Add `onPaste` handler to `frontend/src/components/Editor.tsx` — detect image in `clipboardData`, call `uploadAndInsertImage`, fall through to text paste
- [x] 3.2 Add image insert button + hidden `<input type="file">` to `frontend/src/components/Toolbar.tsx` — trigger file picker, call shared util

## Phase 4: PDF Export Fix

- [x] 4.1 Update `backend/app/services/pdf_export.py` — resolve `/uploads/` URL paths to `UPLOAD_DIR` filesystem paths

## Phase 5: Tests

- [x] 5.1 Write backend unit tests — `httpx.TestClient` for valid/invalid file uploads (201/400/413)
- [x] 5.2 Write frontend unit tests — `uploadImage` validation for type/size errors
- [x] 5.3 Write unit test for `_process_image` URL→path resolution
- [x] 5.4 Write integration test — paste event with `clipboardData.files`, assert `insertImage` called with returned URL
- [x] 5.5 Write integration test — simulate toolbar `input.files` change, assert same upload flow
