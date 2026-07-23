# Proposal: PDF Headers & Footers

## Intent

Frontend renders headers/footers on screen (`DocumentView.tsx` + `PaginationEngine`), but `PDFExporter` ignores them. Users configure headers/footers in the UI and expect them in the PDF — currently they vanish. This bridges that gap end-to-end.

## Scope

### In Scope
- Pass `header_footer` config from `ExportPDFData` → `ExportRequest` → `PDFExporter`
- Render header/footer text per page in PDF via ReportLab `onPage` callback
- Dynamic functions: `{pageNumber}`, `{totalPages}`, `{date}`, `{time}`
- Respect `firstPageDifferent` (skip on page 1)
- Adjust `topMargin`/`bottomMargin` to reserve header/footer space

### Out of Scope
- Header/footer editing UI (already exists)
- Different headers per section or chapter
- Images in headers/footers (text runs only)

## Capabilities

### New Capabilities
- `pdf-header-footer`: render headers, footers, dynamic functions, and page numbers in exported PDFs.

### Modified Capabilities
- None

## Approach

1. **Frontend** (`api/client.ts`, `Toolbar.tsx`): Add `header_footer` to `ExportPDFData`. In `handleExportPDF`, read `config.headerFooter` from `page-store` and include it (px→pt conversion for heights).
2. **Backend schema** (`documents.py`): Add `header_footer: Optional[dict]` to `ExportRequest`.
3. **Backend renderer** (`pdf_export.py`): Add `_render_header_footer()` using `SimpleDocTemplate.onPage` callback to draw on each page canvas.
4. **Dynamic functions**: Regex-parse `{pageNumber}`, `{totalPages}`, `{date}`, `{time}` tokens in run content. Resolve via `canvas.getPageNumber()` and two-pass build for total count.
5. **Margins**: When enabled, increase `topMargin` by `header.height`, `bottomMargin` by `footer.height`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/api/client.ts` | Modified | Add `header_footer` to `ExportPDFData` |
| `frontend/src/components/Toolbar.tsx` | Modified | Pass headerFooter in `handleExportPDF` |
| `backend/app/api/documents.py` | Modified | Add `header_footer` to `ExportRequest` |
| `backend/app/services/pdf_export.py` | Modified | Header/footer rendering, dynamic functions, margin adjustment |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Two-pass needed for `{totalPages}` | High | Use ReportLab `afterFlowable` or two-pass `doc.build()` |
| Header overlaps content | Medium | Reserve exact margin space; validate heights < page height |
| Token parsing breaks on special chars | Low | Regex replacement; escape HTML before ReportLab XML |

## Rollback Plan

Revert all changes. `header_footer` defaults to `None` — existing exports unaffected. No DB migration.

## Dependencies

None. Frontend types/store already exist.

## Success Criteria

- [ ] Header text appears in PDF when configured
- [ ] Footer text appears in PDF when configured
- [ ] `{pageNumber}` resolves correctly per page
- [ ] `{totalPages}` resolves to total page count
- [ ] `{date}` / `{time}` resolve to export timestamp
- [ ] `firstPageDifferent: true` omits header/footer on page 1
- [ ] No content overlap with header/footer areas
- [ ] Export without header_footer works identically to today
