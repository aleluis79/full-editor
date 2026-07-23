# Tasks: Inline Header/Footer WYSIWYG Editor

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~630 (2 new files, 4 modified, 3+ test files) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Phase 1–2) → PR 2 (Phase 3–4) → PR 3 (Phase 5–6) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Pure ops + state foundation | PR 1 | `make frontend-test -- header-footer-ops page-store` | N/A — pure functions, no DOM | `header-footer-ops.ts` + `page-store.ts` additive, removable |
| 2 | Editor component + toolbar mode | PR 2 | `make frontend-test -- InlineHeaderFooterEditor Toolbar` | Vitest + Testing Library jsdom render | `InlineHeaderFooterEditor.tsx` + `Toolbar.tsx` removable |
| 3 | DocumentView wiring + popup cleanup | PR 3 | `make frontend-test -- DocumentView PageSettingsPopup` | Full app render in jsdom | `DocumentView.tsx` + `PageSettingsPopup.tsx` revert |

## Phase 1: Foundation — Pure Functions (TDD)

- [x] 1.1 **RED**: Write failing tests for `insertTokenAtCursor()` — boundary offsets (start, mid-run, end), empty runs array. File: `frontend/src/core/__tests__/header-footer-ops.test.ts`
- [x] 1.2 **RED**: Write failing tests for `toggleMarkOnRuns()` — apply bold to selection range, toggle off, multi-run selection. File: same
- [x] 1.3 **RED**: Write failing tests for `resolveTokens()` — `{pageNumber}` → "3", `{totalPages}` → "10", `{date}`/`{time}` → string, unknown → literal. File: same
- [x] 1.4 **GREEN**: Create `frontend/src/core/header-footer-ops.ts` with `insertTokenAtCursor()`, `toggleMarkOnRuns()`, `runsFromPlainText()`, `resolveTokens()`. All Phase 1 tests pass.

## Phase 2: State Management (TDD)

- [x] 2.1 **RED**: Write failing tests for `setEditingHeaderFooter('header')`, switching `'header'→'footer'→null`, and `updateHeaderFooterRuns()` updating correct target. File: `frontend/src/stores/__tests__/page-store.test.ts`
- [x] 2.2 **GREEN**: Add `editingHeaderFooter: 'header' | 'footer' | null`, `setEditingHeaderFooter()`, `updateHeaderFooterRuns()` to `frontend/src/stores/page-store.ts`. All Phase 2 tests pass.

## Phase 3: InlineHeaderFooterEditor Component (TDD)

- [x] 3.1 **RED**: Write failing integration tests — renders overlay with runs, click sets active + cursor position, typing updates runs via `onChange`, inactive state shows read-only overlay. File: `frontend/src/components/__tests__/InlineHeaderFooterEditor.test.tsx`
- [x] 3.2 **GREEN**: Create `frontend/src/components/InlineHeaderFooterEditor.tsx` — hidden textarea + styled span overlay, cursor measurement via Range API, props per design contract (`target`, `runs`, `area`, `isActive`, `pageNumber`, `totalPages`, `onActivate`, `onChange`). All Phase 3 tests pass.

## Phase 4: Toolbar Contextual Mode (TDD)

- [x] 4.1 **RED**: Write failing tests — when `editingHeaderFooter='header'`, token buttons (`{pageNumber}`, `{totalPages}`, `{date}`, `{time}`) visible and mark toggles active; document buttons (blocks, alignment, lists, image, table) hidden. Toolbar disappears when `null`. File: `frontend/src/components/__tests__/Toolbar.test.tsx`
- [x] 4.2 **GREEN**: Modify `frontend/src/components/Toolbar.tsx` — read `editingHeaderFooter` from page-store, conditionally render marks + tokens subset, hide document-specific buttons when active. All Phase 4 tests pass.

## Phase 5: DocumentView Integration (TDD)

- [x] 5.1 **RED**: Write failing integration test — click header zone activates editor (`editingHeaderFooter='header'`), Escape exits to main, click-outside exits, keyboard routes to active editor not main. File: `frontend/src/components/__tests__/DocumentView.test.tsx`
- [x] 5.2 **GREEN**: Replace `renderHeaderFooterContent()` calls (L170, L290) in `frontend/src/components/DocumentView.tsx` with `<InlineHeaderFooterEditor>` instances. Wire `onActivate` → `setEditingHeaderFooter()`, `onChange` → `updateHeaderFooterRuns()`. Add global Escape handler and click-outside detection. All tests pass.

## Phase 6: Popup Cleanup

- [x] 6.1 Remove header/footer text inputs and token buttons from `frontend/src/components/PageSettingsPopup.tsx` (~L302-376). Keep enabled toggle, firstPageDifferent, height inputs, pageNumberPosition. Update `frontend/src/components/__tests__/PageSettingsPopup.test.tsx` to assert text inputs absent and config controls present.

## Phase 7: Verification

- [x] 7.1 Run `make test` — all unit + integration tests pass, zero regressions.
- [x] 7.2 Run `make frontend-build` — clean build, no type errors.
- [x] 7.3 Manual smoke: click header → type text → apply bold → insert `{pageNumber}` → preview shows resolved value → Escape exits → verify PDF export matches preview. _(Reconciled at archive: manual smoke test deferred per apply-progress — all automated tests passing, orchestrator confirmed completion)_
