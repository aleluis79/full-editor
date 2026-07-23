# Proposal: Inline Header/Footer WYSIWYG Editor

## Intent

Headers/footers configured in `PageSettingsPopup.tsx` via plain text inputs — no visual feedback, no rich text formatting. Users can't see styled output until PDF export.

## Scope

### In Scope
- Inline clickable header/footer zones on each page (`DocumentView.tsx`)
- WYSIWYG editing with cursor, selection, real-time preview
- Rich marks: bold, italic, underline, strikethrough
- Contextual toolbar (marks + tokens) when editing
- Token insertion (`{pageNumber}`, `{totalPages}`, `{date}`, `{time}`)
- Remove header/footer text inputs from `PageSettingsPopup.tsx` (toggle, height, position remain)

### Out of Scope
- Backend PDF rendering (ReportLab already handles styled runs)
- Page margin/paper/orientation editing (stays in popup)
- `firstPageDifferent` separate content (deferred)
- Multi-line headers/footers
- Drag-to-resize height

## Capabilities

### New Capabilities
- `inline-header-footer-editor`: Click-to-activate inline WYSIWYG editing of header/footer on the page surface with contextual toolbar for marks and tokens.

### Modified Capabilities
- `pdf-header-footer`: Rendering must account for styled runs (marks) in preview and PDF, not just plain content.

## Approach

1. Replace `renderHeaderFooterContent()` in `DocumentView.tsx` (L159-172, L279-299) with `InlineHeaderFooterEditor` — textarea + JS events (no contentEditable).
2. Add `editingHeaderFooter: 'header' | 'footer' | null` to `page-store.ts`. One editor active at a time.
3. Extend `Toolbar.tsx` to detect header/footer mode → show marks + tokens.
4. `TextRun[]` with marks exists in `HeaderFooterConfig` — no schema changes. Inline editor produces rich runs.
5. Remove text inputs from popup, keep config controls.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/components/DocumentView.tsx` | Modified | Static header/footer → inline editable zones |
| `frontend/src/components/PageSettingsPopup.tsx` | Modified | Remove header/footer text inputs |
| `frontend/src/components/Toolbar.tsx` | Modified | Header/footer mode + contextual toolbar |
| `frontend/src/stores/page-store.ts` | Modified | Add `editingHeaderFooter` state |
| `frontend/src/components/InlineHeaderFooterEditor.tsx` | New | Inline WYSIWYG component |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Focus conflict between inline/main editor | High | Store mode flag; one active; Escape exits |
| Toolbar switching jarring | Medium | Dashed border on active zone |
| Keyboard routing ambiguity | Medium | `editingHeaderFooter` gates handlers |

## Rollback Plan

Keep popup inputs hidden (not deleted) behind feature flag. Remove after one release cycle. Full revert = undo commit(s).

## Dependencies

None. Uses existing `TextRun` model, `PaginationEngine` areas, Zustand stores.

## Success Criteria

- [ ] Click header/footer → inline editing with cursor
- [ ] Marks render in real-time
- [ ] Toolbar shows formatting + tokens when active
- [ ] Tokens insert at cursor and resolve in preview
- [ ] PDF export matches preview (WYSIWYG fidelity)
- [ ] Escape/click-outside exits to document editing
- [ ] PageSettingsPopup has no header/footer text inputs
