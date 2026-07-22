# Tasks: Bubble Comments

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~950 |
| 800-line budget risk | High |
| Chained PRs recommended | Yes |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
800-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend + client + store — model, migration, storage, API, client functions, Zustand store | PR 1 | Base: main. Verifiable via pytest + vitest without UI components. |
| 2 | UI components + integration — sidebar, thread, indicator, toolbar toggle, styles | PR 2 | Base: main. Depends on PR 1 for store + API. |

## Phase 1: Backend Foundation

- [x] 1.1 Create `backend/app/models/comment.py` — `CommentModel` with all columns, FKs, indexes; Pydantic schemas `CommentCreate`, `CommentUpdate`, `CommentResponse` with nested `replies`
- [x] 1.2 Generate Alembic migration for `comments` table with FKs, CASCADE deletes, indexes on `document_id` and `(document_id, block_id)`
- [x] 1.3 Create `backend/app/core/comment_storage.py` — `list_comments`, `create_comment`, `create_reply`, `update_comment`, `delete_comment`, `toggle_resolved` with Python nesting and permission checks via `_has_access()`
- [x] 1.4 Create `backend/app/api/comments.py` — 6 endpoints under `/api/documents/{doc_id}/comments`; register router in `main.py`; 404/403 error handling

## Phase 2: Frontend Client + Store

- [x] 2.1 Add `CommentData`, `CommentThread`, `CommentUpdateData` TS interfaces and 6 API functions (`fetchComments`, `createComment`, `createReply`, `updateComment`, `deleteComment`, `resolveComment`) to `frontend/src/api/client.ts`
- [x] 2.2 Create `frontend/src/stores/comment-store.ts` — Zustand store with comments state, visible flag, activeBlockId, loading, and all action methods

## Phase 3: Frontend Components

- [x] 3.1 Create `frontend/src/components/CommentSidebar.tsx` — fixed right panel (width 320px, top 48px) with header, fetch-on-mount, empty/loading states
- [x] 3.2 Create `frontend/src/components/CommentThread.tsx` — parent + nested replies, author avatar/initial, timestamps, action buttons (Reply, Edit/Delete, Resolve), inline reply form
- [x] 3.3 Create `frontend/src/components/CommentIndicator.tsx` — gutter dot at block y-position with count, active/resolved state variants

## Phase 4: Integration

- [x] 4.1 Modify `frontend/src/components/Editor.tsx` — mount CommentSidebar, wire `fetchComments` on document load, flex container for content + sidebar
- [x] 4.2 Modify `frontend/src/components/DocumentView.tsx` — render comment gutter column with CommentIndicator per block when sidebar visible; adjust content width
- [x] 4.3 Modify `frontend/src/components/Toolbar.tsx` — add comment toggle button (speech bubble icon) wired to store.toggleVisibility with active state
- [x] 4.4 Add comment CSS classes to `frontend/src/index.css` — sidebar, thread, item, indicator, gutter, reply form, transitions
