# Tasks: Page Settings Popup

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~350 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Core Model

- [x] 1.1 Add `orientation: 'portrait' | 'landscape'` to `PaginationConfig` in `types.ts`
- [x] 1.2 Add `getOrientedSize(ps, orientation)` to `paper.ts` — swaps w/h on landscape
- [x] 1.3 Update `engine.ts` to use `getOrientedSize()` instead of raw `paperSize`

## Phase 2: State & Persistence

- [x] 2.1 Add `updateOrientation()` and default `'portrait'` to `page-store.ts`
- [x] 2.2 Save/load `content.config.orientation` in `document-store.ts`; default `'portrait'`

## Phase 3: UI Components

- [x] 3.1 Create `icons/Settings.tsx` gear SVG (16×16), export from `icons/index.ts`
- [x] 3.2 Create `PageSettingsPopup.tsx` — paper radio, orientation toggle, margin inputs, outside-click close
- [x] 3.3 Add `.page-settings-popover` styles to `index.css`
- [x] 3.4 Update `Toolbar.tsx` — remove `<select>`, add gear button, pass orientation to `exportPDF()`

## Phase 4: Export Pipeline

- [x] 4.1 Add `orientation?: string` to `ExportPDFData` in `api/client.ts`
- [x] 4.2 Add `orientation: str = "portrait"` to `ExportRequest` in `documents.py`
- [x] 4.3 Accept `orientation` in `pdf_export.py`, apply `landscape()` when `"landscape"`

## Phase 5: Testing

- [x] 5.1 Unit: `getOrientedSize()` — A4/Letter/Legal portrait + landscape in `pagination/__tests__/paper.test.ts`
- [x] 5.2 Unit: `updateOrientation()` and margin clamping in `stores/__tests__/page-store.test.ts`
- [x] 5.3 Unit: orientation save/load + default fallback in `stores/__tests__/document-store.test.ts`
- [x] 5.4 Integration: Toolbar gear button renders → popup opens in `components/__tests__/Toolbar.test.tsx`
- [x] 5.5 Integration: backend orientation (landscape letter, default portrait, margin passthrough) in `backend/tests/test_pdf_export.py`
