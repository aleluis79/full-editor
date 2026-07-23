# Tasks: Spell Checker

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 800-1200 |
| 400-line budget risk | High |
| Chained PRs recommended | No |
| Suggested split | Single PR (requires size:exception) |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full feature — backend + frontend + tests | PR 1 | 17 files across 4 phases; requires `size:exception` approval |

## Phase 1: Backend Foundation

- [x] 1.1 Create `backend/app/models/custom_word.py` — SQLAlchemy model + Pydantic schemas
- [x] 1.2 Create Alembic migration for `custom_words` table
- [x] 1.3 Create `backend/app/api/custom_words.py` — FastAPI CRUD router (GET/POST/DELETE)
- [x] 1.4 Modify `backend/app/models/__init__.py` — export CustomWordModel
- [x] 1.5 Modify `backend/app/main.py` — register custom_words router
- [x] 1.6 Write pytest tests for CustomWord CRUD + auth scoping

## Phase 2: Frontend Infrastructure

- [x] 2.1 Create `frontend/src/stores/spell-check-store.ts` — Zustand misspellings store
- [x] 2.2 Create `frontend/src/workers/spell-check.worker.ts` — nspell Web Worker wrapper
- [x] 2.3 Create `frontend/src/hooks/useSpellCheck.ts` — 400ms debounce + worker lifecycle
- [x] 2.4 Modify `frontend/src/api/client.ts` — add fetchCustomWords, addCustomWord, deleteCustomWord
- [x] 2.5 Modify `frontend/src/stores/editor-store.ts` — add spellCheckEnabled toggle field
- [x] 2.6 Modify `frontend/src/i18n/locales/en/toolbar.json` — new spell check keys
- [x] 2.7 Modify `frontend/src/i18n/locales/es/toolbar.json` — new spell check keys

## Phase 3: Frontend UI

- [x] 3.1 Modify `frontend/src/components/DocumentView.tsx` — wavy underline in LayoutParagraph
- [x] 3.2 Modify `frontend/src/components/TextRun.tsx` — wavy underline for standalone runs
- [x] 3.3 Create `frontend/src/components/SpellCheckPopover.tsx` — suggestion popover + context menu
- [x] 3.4 Modify `frontend/src/components/Toolbar.tsx` — toggle button + popover integration
- [x] 3.5 Modify `frontend/src/index.css` — `.spell-misspelled` class

## Phase 4: Tests

- [x] 4.1 Write Vitest tests for nspell wrapper — check, suggest, URL/number skip
- [x] 4.2 Write Vitest tests for spell-check-store — toggle, clear, popover, worker roundtrip
- [x] 4.3 Write Vitest tests for useSpellCheck hook — debounce, worker lifecycle, custom words init
