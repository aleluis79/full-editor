# Proposal: External Link Support

## Intent

Users need to add clickable hyperlinks to document text. The editor has no link concept — TextRun only supports formatting marks (bold/italic/underline/strikethrough). This change adds external URLs to text runs with toolbar UI and keyboard shortcut.

## Scope

### In Scope
- `href` field on TextRun + `'link'` mark type in core types
- `SetLinkOp` / `RemoveLinkOp` operations (reuse `splitRunsAtRange`)
- Toolbar button with URL input popup
- Ctrl+K keyboard shortcut
- `<a>` rendering in TextRun.tsx
- Layout engine (`PositionedRun`) and PDF export href propagation
- Backend PDF (ReportLab `<a>` markup)

### Out of Scope
- Internal document anchors / cross-references
- Link validation (URL format is accepted as-is)
- Link preview on hover (tooltip)
- Auto-link detection (paste detection)
- Link editing — remove and re-add only

## Capabilities

### New Capabilities
- `external-links`: external hyperlink support for text runs in the document editor — add/remove links on selected text, render as `<a>` HTML, propagate `href` through layout and PDF export

### Modified Capabilities
- None

## Approach

1. Extend `MarkType` enum → add `'link'`; add `href?: string` to `TextRun` interface
2. Create `SetLinkOp` (wraps text in a link at range) and `RemoveLinkOp` (strips link from range) — both reuse `splitRunsAtRange`
3. Add toolbar button with a small URL popup dialog (input + OK/Cancel)
4. Register `Ctrl+K` in the keyboard handler
5. Update `TextRun.tsx` render: if run has `href`, render `<a href={href}>`
6. Propagate `href` through `PositionedRun` in layout engine
7. Forward `href` to PDF export (`_extract_text` → ReportLab `<a>` tag)
8. Update affected subsystems: core/types, core/operations, selection, layout, rendering, toolbar, keyboard, PDF API

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `core/types.ts` | Modified | Add `'link'` to MarkType, `href` to TextRun |
| `core/operations.ts` | Modified | New SetLinkOp / RemoveLinkOp |
| `core/selection.ts` | Modified | Handle link ops in document transforms |
| `components/TextRun.tsx` | Modified | Render `<a>` when href present |
| `components/Toolbar.tsx` | Modified | Link button + URL popup |
| `hooks/useKeyboard.ts` | Modified | Ctrl+K handler |
| `layout/types.ts` | Modified | href in PositionedRun |
| `layout/layoutBlock.ts` | Modified | Propagate href |
| `api/export/client.ts` | Modified | PDF export href |
| `api/export/reportlab.py` | Modified | ReportLab `<a>` markup |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Link breaks existing run merge logic | Low | `mergeRuns` already skips runs with different attrs — href works naturally |
| PDF export doesn't support `<a>` correctly | Low | ReportLab Paragraph supports `<a href>` natively; verify with test PDF |

## Rollback Plan

Revert types.ts TextRun/MarkType changes, ops, and all render/export sites. The `link` mark is additive — removing it from types won't break existing documents (old docs have no href data).

## Dependencies

- None

## Success Criteria

- [ ] User can select text, click link button, enter URL → text renders as clickable `<a>`
- [ ] Ctrl+K opens URL popup on selected text
- [ ] Links render correctly in the editor (blue, underlined)
- [ ] Links appear as clickable `<a href>` in PDF export
- [ ] Removing a link restores plain text
