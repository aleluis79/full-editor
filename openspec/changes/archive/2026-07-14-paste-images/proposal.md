# Proposal: Paste and Insert Images

## Intent

Users need to add images to documents by pasting from clipboard or selecting from disk. Currently the editor only handles text paste and has no image toolbar button. This enables rich document authoring with image support.

## Scope

### In Scope
- Clipboard image paste (Ctrl+V) → upload → insert as Image block
- Toolbar button with file picker for image insertion
- Backend image upload endpoint (POST /api/images/upload)
- Backend static file serving for uploaded images

### Out of Scope
- Drag-and-drop image insertion
- Image cropping or editing within editor
- CDN or cloud storage integration
- Image browser or gallery

## Capabilities

### New Capabilities
- `image-paste`: Paste images from clipboard into the editor — detect image in clipboard data, upload to backend, create Image block
- `image-insert-dialog`: Toolbar button to insert images from disk — file picker → upload → Image block insertion

### Modified Capabilities
None.

## Approach

**Frontend**: Extend `Editor.tsx` paste handler to detect `clipboardData.files` with image MIME types. Add toolbar button in `Toolbar.tsx` that opens a hidden `<input type="file">`. Both share an `uploadAndInsertImage` flow: POST multipart to backend, receive URL, call existing `insertImage` store action.

**Backend**: New `POST /api/images/upload` endpoint in `images.py` router. Validate file type (PNG/JPEG/GIF/WebP) and size (max 10MB). Save to `uploads/images/` with UUID filename. Mount `uploads/` as static files at `/uploads`. Return `{ "url": "/uploads/images/<uuid>.<ext>" }`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/components/Editor.tsx` | Modified | Clipboard image detection in paste handler |
| `frontend/src/components/Toolbar.tsx` | Modified | Add image insert button → file picker |
| `frontend/src/stores/document-store.ts` | Modified | Add upload+insert flow (or wrapper around `insertImage`) |
| `backend/app/api/images.py` | New | Image upload endpoint |
| `backend/app/main.py` | Modified | Register images router + static mount for uploads |
| `backend/app/config.py` | Modified | Add `UPLOAD_DIR`, `MAX_UPLOAD_SIZE` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Large images slow document rendering | Med | Client-side size check; server-side resize if needed later |
| Malicious file upload | Low | Validate MIME server-side; UUID filenames; reject non-image content |

## Rollback Plan

- Frontend: revert paste handler and toolbar changes
- Backend: remove images router, static mount, and `uploads/` config

## Dependencies

- `python-multipart` (already in project deps)

## Success Criteria

- [ ] Copy image → Ctrl+V in editor → image renders as resizable ImageBlock
- [ ] Toolbar insert button → select file → image appears in document
- [ ] Uploaded images persist across page reload and document re-open
- [ ] PDF export includes pasted/inserted images
