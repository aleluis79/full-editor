# Tasks: PDF Headers & Footers

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~420 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Phases 1-5) → PR 2 (Phase 6) → PR 3 (Phases 7-9) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|----|----------------------|-----------------|-------------------|
| 1 | Backend schema + renderer + tokens + margins | PR 1 | `pytest backend/tests/services/test_pdf_export.py` | pytest with in-memory PDF build | Remove `header_footer` field + renderer; `None` default keeps byte-equivalence |
| 2 | Backend integration tests | PR 2 | `pytest backend/tests/integration/test_pdf_export_hf.py` | Full `export()` → PyPDF2 inspection | Delete test file; no production change |
| 3 | Frontend types + Toolbar + Vitest | PR 3 | `cd frontend && npx vitest run` | Vitest + mocked `exportPDF` | Revert `client.ts` + `Toolbar.tsx`; backend tolerates missing field |

## Phase 1: Backend Schema

- [x] 1.1 **RED** Test `ExportRequest` accepts `header_footer` and rejects invalid scope. File: `backend/tests/api/test_documents_schema.py`.
- [x] 1.2 **GREEN** Add `HeaderFooterRun`, `HeaderFooterContent`, `HeaderFooterConfig` models + `header_footer` field. File: `backend/app/api/documents.py`.

## Phase 2: Token Resolution

- [x] 2.1 **RED** Tests for `_resolve_tokens`: `{pageNumber}`, `{totalPages}`, `{date}`, `{time}`, unknown preserved, empty runs. File: `backend/tests/services/test_pdf_export_tokens.py`.
- [x] 2.2 **GREEN** Implement `_resolve_tokens` with cached `datetime.now()`. File: `backend/app/services/pdf_export.py`.

## Phase 3: Renderer + onPage

- [x] 3.1 **RED** Scope tests: `all`, `exceptFirst`, `firstOnly`, `firstPageDifferent` override. Mock canvas/doc. File: `backend/tests/services/test_pdf_export_scope.py`.
- [x] 3.2 **GREEN** Implement `_render_header_footer` + `_draw_header_footer` with scope branching. File: `backend/app/services/pdf_export.py`.

## Phase 4: Two-Pass Build

- [x] 4.1 **RED** Test `_has_total_pages_token` detection. File: `backend/tests/services/test_pdf_export_tokens.py`.
- [x] 4.2 **RED** Test `_count_pages` returns correct count for multi-page story. File: `backend/tests/services/test_pdf_export_pages.py`.
- [x] 4.3 **GREEN** Implement both; wire conditional first-pass. File: `backend/app/services/pdf_export.py`.

## Phase 5: Margin Adjustment

- [x] 5.1 **RED** Test `_adjust_margins`: zero/normal/excessive/disabled. File: `backend/tests/services/test_pdf_export_margins.py`.
- [x] 5.2 **GREEN** Implement `_adjust_margins`; clamp to `page_height/2`. File: `backend/app/services/pdf_export.py`.

## Phase 6: Backend Integration

- [x] 6.1 Full export with header+footer; verify text in PDF bytes. File: `backend/tests/integration/test_pdf_export_hf.py`.
- [x] 6.2 `{pageNumber}` + `{totalPages}` resolve in 3-page PDF.
- [x] 6.3 `exceptFirst` skips page 1; `firstOnly` skips pages 2+.
- [x] 6.4 `header_footer=None` byte-equivalent baseline snapshot.
- [x] 6.5 Excessive height clamped safely.

## Phase 7: Frontend API Client

- [x] 7.1 **RED** Vitest: `ExportPDFData` includes `header_footer`. File: `frontend/src/api/__tests__/client.test.ts`.
- [x] 7.2 **GREEN** Add `HeaderFooterPayload` + nested interfaces; add `header_footer?` field. File: `frontend/src/api/client.ts`.

## Phase 8: Toolbar Integration

- [x] 8.1 **RED** Vitest: `handleExportPDF` includes/omits `header_footer` based on `enabled`. File: `frontend/src/components/__tests__/Toolbar.test.tsx`.
- [x] 8.2 **GREEN** Read `headerFooter` from `usePageStore`, map runs, include. File: `frontend/src/components/Toolbar.tsx`.

## Phase 9: Verification

- [x] 9.1 Run `make test`; confirm no regressions.
- [x] 9.2 Manual smoke: export with header/footer, verify tokens + scope.
