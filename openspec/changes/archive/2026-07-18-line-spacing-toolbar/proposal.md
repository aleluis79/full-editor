# Proposal: Line Spacing Toolbar

## Intent

Per-block line spacing control in the toolbar. Currently line height is global (1.5 paragraphs, 1.2 headings). Users need to fine-tune vertical spacing per paragraph/heading via a preset popup, following the same pattern as text alignment.

## Scope

### In Scope
- Add `lineHeight?: number` to `BlockAttrs` in core types
- Update layout engine to read per-block lineHeight in layoutParagraph, layoutHeading, layoutTableCell
- Apply lineHeight as inline style in DocumentView
- Create LineHeight SVG icon and add toolbar popup with presets (1.0, 1.15, 1.5, 2.0, 2.5, 3.0)
- Update history descriptions in document-store for setBlockAttrs/setBlockAttrsRange
- Tests for popup behavior and lineHeight application

### Out of Scope
- PDF export backend update (deferred, documented)
- Custom numeric input (presets only)
- Table cell line spacing via toolbar (cells inherit per-paragraph lineHeight from layout engine)
- Keyboard shortcut

## Capabilities

### New Capabilities
- `block-line-height`: Per-block line height control via BlockAttrs, layout engine reading, toolbar popup UI, and inline style application

### Modified Capabilities
None — existing specs (image-insert-dialog, image-paste, external-links) unchanged at the spec level.

## Approach

Add `lineHeight` to `BlockAttrs` following the `textAlign` pattern. The existing `setBlockAttrs`/`setBlockAttrsRange` operations handle it generically. The popup UI mirrors the table picker pattern: toolbar button → popover with preset buttons. Empty state shows no selection — the layout engine default applies.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `core/types.ts` | Modified | Add `lineHeight?: number` to BlockAttrs |
| `core/layout/engine.ts` | Modified | Read block.attrs.lineHeight in layout functions |
| `DocumentView.tsx` | Modified | Apply lineHeight as inline style |
| `Toolbar.tsx` | Modified | Add line spacing popup button group |
| `icons/LineHeight.tsx` | New | SVG icon component |
| `icons/index.ts` | Modified | Export LineHeight |
| `stores/document-store.ts` | Modified | Update history descriptions for lineHeight |
| `__tests__/Toolbar.test.tsx` | Modified | Add popup/lineHeight tests |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Heading hardcoded 1.2 overrides per-block lineHeight | Low | Per-block attrs take priority over both default and heading default |
| History descriptions lack lineHeight context | Low | Update both setBlockAttrs and setBlockAttrsRange |
| CSS class line-height overrides inline style | Low | Inline `style.lineHeight` has highest specificity — verified |

## Rollback Plan

Revert BlockAttrs change in types.ts, layout engine reads, DocumentView inline style, toolbar button/popup, and history descriptions. Tests revert naturally. Single commit revert.

## Dependencies

None — all changes are frontend-only.

## Success Criteria

- [ ] Popup opens/closes on toolbar button click
- [ ] Selecting a preset applies lineHeight to selected blocks
- [ ] Empty state (no explicit lineHeight) shows no active preset
- [ ] History entries correctly describe lineHeight changes
- [ ] All new and existing tests pass
