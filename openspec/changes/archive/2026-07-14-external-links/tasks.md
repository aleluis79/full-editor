# Tasks: External Link Support

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 250-350 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Not needed |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Core Types & Operations

- [x] 1.1 Add `'link'` to `MarkType`, `href?: string` to `TextRun`, `SetLinkOp`/`RemoveLinkOp` types, add to `Operation` union in `frontend/src/core/types.ts`
- [x] 1.2 Update `createTextRun` in `frontend/src/core/document.ts` — accept optional `href`, preserve in `mergeRuns`
- [x] 1.3 Add `applySetLink`/`applyRemoveLink`/`invertSetLink`/`invertRemoveLink` in `frontend/src/core/operations.ts`; register in `applyOperation`/`invertOperation`

## Phase 2: Store & Keyboard

- [x] 2.1 Add `setLink`/`removeLink` actions in `frontend/src/stores/document-store.ts` importing new operations
- [x] 2.2 Add Ctrl+K handler in `frontend/src/components/Editor.tsx` — selection → URL popup, cursor in link → `RemoveLinkOp`

## Phase 3: Toolbar UI

- [x] 3.1 Add link button + URL popup (inline React state) in `frontend/src/components/Toolbar.tsx`; empty/whitespace URL → no-op; reflect link state

## Phase 4: Rendering & Layout

- [x] 4.1 Render `<a href={href}>` with blue underline in `frontend/src/components/TextRun.tsx` when `run.href` set; preserve other marks
- [x] 4.2 Add `href?: string` to `PositionedRun` in `frontend/src/core/layout/types.ts`
- [x] 4.3 Propagate `run.href` into `PositionedRun` in `layoutTextRuns` in `frontend/src/core/layout/engine.ts`

## Phase 5: PDF Export

- [x] 5.1 In `backend/app/services/pdf_export.py` `_extract_text`, wrap linked runs with `<a href="{href}">` when `'link'` in marks

## Phase 6: Tests (RED–GREEN–REFACTOR)

- [x] 6.1 RED: Write failing test for `applySetLink` — run split, href set, `'link'` mark applied
- [x] 6.2 GREEN: `make frontend-test` — confirm `applySetLink` test passes
- [x] 6.3 RED: Write failing test for `applyRemoveLink` — href + `'link'` removed, other marks preserved
- [x] 6.4 GREEN: `make frontend-test` — confirm `applyRemoveLink` test passes
- [x] 6.5 RED: Write test for empty/whitespace URL rejection — popup dispatches no op
- [x] 6.6 GREEN: `make frontend-test` — confirm empty URL test passes
- [x] 6.7 RED: Write test for Ctrl+K inside link → `RemoveLinkOp` dispatched (no selection)
- [x] 6.8 GREEN: `make frontend-test` — confirm keyboard handler test passes
- [x] 6.9 RED: Write test for layout href propagation — `PositionedRun.href === TextRun.href`
- [x] 6.10 GREEN: `make frontend-test` — confirm layout test passes
- [x] 6.11 RED: Write test for `TextRun.tsx` renders `<a>` element when `href` set
- [x] 6.12 GREEN: `make frontend-test` — confirm `<a>` render test passes
- [x] 6.13 RED: Write test for PDF `_extract_text` wraps linked run in `<a href>`
- [x] 6.14 GREEN: `make backend-test` — confirm PDF test passes
- [x] 6.15 REFACTOR: Review all tests — deduplicate, tighten assertions, ensure consistent style
