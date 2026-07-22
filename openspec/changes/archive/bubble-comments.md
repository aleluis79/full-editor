# Archive: Bubble Comments

**Archived**: 2026-07-22
**Source**: `openspec/changes/bubble-comments/`

---

## 1. Summary

**What was built**: A per-block threaded comment system for collaborative document editing. Users can attach comments to specific document blocks, view them grouped in a sidebar, reply in threads, resolve discussions, and toggle sidebar visibility via a toolbar button.

**Why**: Users collaborating on documents had no way to leave feedback on specific blocks, forcing async communication outside the editor (email, Slack) with vague references like "the third paragraph on page 2".

## 2. Deliverables

### Backend
| File | Action |
|------|--------|
| `backend/app/models/comment.py` | Created — SQLAlchemy `CommentModel` + Pydantic schemas (`CommentCreate`, `CommentUpdate`, `CommentResponse`) |
| `backend/app/models/__init__.py` | Modified — added comment import |
| `backend/alembic/versions/0bf72c64935e_add_comments_table.py` | Created — migration with CASCADE deletes + indexes |
| `backend/alembic/env.py` | Modified — import CommentModel |
| `backend/app/core/comment_storage.py` | Created — CRUD storage with Python nesting and permission checks |
| `backend/app/api/comments.py` | Created — 6 REST endpoints under `/api/documents/{doc_id}/comments` |
| `backend/app/main.py` | Modified — registered comments router |

### Frontend
| File | Action |
|------|--------|
| `frontend/src/api/client.ts` | Modified — 6 comment API functions + TS interfaces |
| `frontend/src/stores/comment-store.ts` | Created — Zustand store for comments state |
| `frontend/src/components/CommentSidebar.tsx` | Created — fixed right panel (320px) |
| `frontend/src/components/CommentThread.tsx` | Created — thread display + reply/edit forms |
| `frontend/src/components/CommentIndicator.tsx` | Created — gutter dot per block |
| `frontend/src/components/icons/Comment.tsx` | Created — speech bubble icon |
| `frontend/src/components/icons/index.ts` | Modified — icon registration |
| `frontend/src/components/Editor.tsx` | Modified — sidebar mount + fetch on load |
| `frontend/src/components/DocumentView.tsx` | Modified — comment gutter with indicators |
| `frontend/src/components/Toolbar.tsx` | Modified — toggle button with active state |
| `frontend/src/index.css` | Modified — full comment styles (sidebar, thread, indicator, gutter, transitions) |

### Engram Artifacts
| Artifact | Observation ID |
|----------|---------------|
| `sdd/bubble-comments/proposal` | #119 |
| `sdd/bubble-comments/spec` | #120 |
| `sdd/bubble-comments/design` | #122 |
| `sdd/bubble-comments/tasks` | #124 |
| `sdd/bubble-comments/apply-progress` | #125 |
| `sdd/bubble-comments/archive-report` | (this observation) |

## 3. Test Results

| Suite | Count |
|-------|-------|
| Backend tests (comment model, storage, API) | 37/37 passing |
| Frontend tests (comment store) | 6/6 passing |

Backend: 27 new tests across `test_comment_model.py` (10), `test_comment_storage.py` (16), `test_comments_api.py` (11).
Frontend: 5 new tests in `comment-store.test.ts` plus 1 integration store test.

## 4. Known Issues

None.

## 5. Deviations from Design

- **CommentThread**: Uses inline state for edit/reply forms instead of store-based approach (simpler UX, less store complexity)
- **CommentIndicator positioning**: Positioned absolutely in the page div (with `position: relative`) instead of inside `page-content` to avoid overflow clipping
- **Current user detection**: Uses `window.__ZUSTAND_AUTH_STORE__` fallback instead of a proper auth store import — flagged as needing refinement in a future change

## 6. Future Work

- Real-time sync / WebSocket presence for concurrent commenting
- @mention notifications and emails
- Reactions (like/emoji)
- Rich text in comment bodies
- Comment search or filtering

## 7. Main Spec Updated

Created `openspec/specs/document-comments/spec.md` — new domain spec for the `document-comments` capability (7 requirements, 10 scenarios, REST endpoint table, data model schema).

## 8. SDD Cycle Complete

The bubble-comments change has been fully planned, implemented, verified, and archived. Ready for the next change.
