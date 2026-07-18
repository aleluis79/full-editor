# Proposal: Page Settings Popup

## Intent

Replace the inline paper size `<select>` with a gear-icon popup for full page config (paper size, orientation, margins). Orientation is needed for print/PDF and is missing from the model.

## Scope

### In Scope
- Remove paper size `<select>` from Toolbar
- Settings button (gear icon) with popup: paper size radio (A4/Letter/Legal), orientation toggle (Portrait/Landscape), margin inputs (top/right/bottom/left) in points
- Add `orientation` to `PaginationConfig` and `ExportPDFData`; swap width/height on landscape
- Persist orientation in document saves (content.config)
- Pass paper_size, margins, orientation to PDF export
- CSS for popup overlay

### Out of Scope
- Header/footer config in popup
- Printer-friendly CSS / @page rules
- Custom paper sizes or preview thumbnails

## Capabilities

### New Capabilities
- `page-layout`: document-level page configuration — paper size, orientation, margins.

### Modified Capabilities
- None (existing specs unrelated: line-height, external-links, image-insert, image-paste)

## Approach

1. Add `orientation: 'portrait' | 'landscape'` to `PaginationConfig` in `pagination/types.ts`
2. Add `getOrientedSize()` in `pagination/paper.ts` — swaps width/height when landscape
3. Add `updateOrientation()` to `page-store.ts` — updates config, swaps dims in engine, syncs layout
4. Update `document-store.ts` — save/load `content.config.orientation`
5. Create `<PageSettingsPopup>` — popup with paper radio, orientation toggle, margin inputs, reads/writes via page-store
6. Update `Toolbar.tsx` — remove `<select>`, add gear button; pass page config to `exportPDF()`
7. Update `ExportPDFData` / `api/client.ts` — add `orientation`
8. Update `pdf_export.py` — accept `orientation`, use `landscape(pagesize)` when set
9. Update `ExportRequest` in `documents.py` — add `orientation` field

## Affected Areas

| Area | Impact |
|------|--------|
| `pagination/types.ts` | Add `orientation` to PaginationConfig |
| `pagination/paper.ts` | Add `getOrientedSize()` |
| `stores/page-store.ts` | Add `updateOrientation()` |
| `stores/document-store.ts` | Save/load orientation |
| `components/Toolbar.tsx` | Remove `<select>`, add gear btn |
| `components/PageSettingsPopup.tsx` | **New** popup component |
| `api/client.ts` | Add `orientation` to ExportPDFData |
| `index.css` | Popup styles |
| `backend/api/documents.py` | Add orientation to ExportRequest |
| `backend/services/pdf_export.py` | Handle orientation param |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Existing docs lack orientation | High | Default to `'portrait'` in all readers |
| Landscape rendering mismatch | Medium | Engine recomputes with swapped dims on toggle |
| Invalid margin values | Low | Clamp to [0, paperSize/2] in store |

## Rollback Plan

Revert all changes. Existing docs with `orientation` in content.config are handled by default-portrait fallback on both frontend and backend.

## Dependencies

None.

## Success Criteria

- [ ] Paper size `<select>` removed; gear icon opens settings popup
- [ ] Changing orientation swaps page rendering width/height
- [ ] Saved orientation persists through reload
- [ ] PDF export respects orientation and margins
