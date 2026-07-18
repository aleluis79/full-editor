## Exploration: line-spacing-toolbar

### Current State
The editor currently has no per-block line height control. Line height is set globally via `LayoutConstraints.lineHeight` (default 1.5) in the layout engine, and headings hardcode 1.2. The CSS class `.paragraph` uses `line-height: var(--line-height)` (1.5), while headings use `line-height: 1.2`/`1.3`. BlockAttrs currently only contains `textAlign?: TextAlign`. Backend PDF export hardcodes leading values (1.5× fontSize for paragraphs, 1.3× for headings, 1.4× for table cells). The toolbar has alignment buttons that call `setBlockAttrs`/`setBlockAttrsRange` with `{ textAlign: ... }` — the same pattern would apply for lineHeight.

### Affected Areas
- `frontend/src/core/types.ts` — Add `lineHeight?: number` to `BlockAttrs` interface
- `frontend/src/core/layout/engine.ts` — Use `block.attrs?.lineHeight` in `layoutParagraph` (override constraint) and `layoutHeading` parameters; `layoutTableCell` also hardcodes lineHeight for min-height
- `frontend/src/components/DocumentView.tsx` — Add `lineHeight: block.attrs?.lineHeight` inline style in `LayoutParagraph` (line ~633 area)
- `frontend/src/components/Toolbar.tsx` — Add line spacing popup button group; follow the alignment button pattern for `setBlockAttrs`/`setBlockAttrsRange`
- `frontend/src/components/icons/LineHeight.tsx` — New SVG icon component following existing pattern (24×24, stroke=2, currentColor)
- `frontend/src/components/icons/index.ts` — Export `LineHeight` icon
- `frontend/src/stores/document-store.ts` — Update history description in `setBlockAttrs` (line 913) and `setBlockAttrsRange` (line 967) to handle `lineHeight` values
- `frontend/src/components/__tests__/Toolbar.test.tsx` — Add tests for line spacing popup (or create new test file)
- `backend/app/services/pdf_export.py` — Update `_process_paragraph` and `_process_heading` to read `block.attrs.lineHeight` instead of hardcoding 1.5/1.3 multipliers; update `_process_table` cell leading similarly

### Additional Issues Identified
1. **CSS overrides**: `index.css` sets `.paragraph { line-height: var(--line-height) }`. The inline style in `DocumentView` (lineHeight) will need to override this — inline styles already take precedence over CSS variables, but need verification that `lineHeight` (camelCase) maps correctly to `line-height`.
2. **layoutTableCell** on line 286 of engine.ts uses `this.constraints.lineHeight` for `paraMinHeight`. Should also respect per-block lineHeight if set on the cell's paragraphs.
3. **Backend PDF export**: Hardcoded leading values need updating to read `attrs.lineHeight`. Not required for the initial frontend scope but important for consistency.
4. **No test infrastructure for popups**: The existing Toolbar tests only test image insert. Popup testing (open/close, value selection) will need new patterns.

### Approaches
1. **Preset popup** (recommended) — Popup with predefined line height options (1.0, 1.15, 1.5, 2.0, 2.5, 3.0). Empty state shows no active value. Follows the "popup" requirement. Similar UX to Google Docs line spacing.
   - Pros: Simple UX, no input validation needed, fast to implement, matches existing popup patterns (table picker, block picker)
   - Cons: Limited to preset values (but covers 99% of use cases)
   - Effort: Medium

2. **Numeric input popup** — Popup with preset buttons plus a numeric input field for custom values.
   - Pros: Maximum flexibility for power users
   - Cons: More complex, needs validation, larger UI, not commonly needed
   - Effort: High

3. **Select dropdown** — Use `<select>` like font size/type. Rejected by prior decision.
   - Pros: Consistent with existing toolbar selects
   - Cons: Does not match the "popup" requirement, clunky for a small set of options
   - Effort: Low

### Recommendation
**Approach 1 — Preset popup.** Matches the "popup control" requirement, follows existing popup patterns (table picker at line 905, block picker at line 827), and covers the vast majority of line spacing needs. The icon for the toolbar button can be a standard line-spacing icon (horizontal lines with vertical arrows). Empty default display (no checkmark) when the current block has no explicit lineHeight — the user sees no active state, and the layout engine's default applies.

### Risks
- **Per-block lineHeight in layout engine**: Must properly override `constraints.lineHeight` only when `block.attrs?.lineHeight` is set. Null/undefined means "use default". The heading already overrides lineHeight to 1.2 — per-block lineHeight should take priority over both the constraint default and the heading default.
- **History description**: `setBlockAttrs` only checks `attrs.textAlign`. When lineHeight is the only attribute being set, the history entry will read "Set block attrs" instead of something meaningful. Update both `setBlockAttrs` and `setBlockAttrsRange`.
- **CSS specificity**: The inline `style.lineHeight` must override the CSS class's `line-height: var(--line-height)`. Since inline styles have highest specificity, this works, but should be verified.
- **Backend scope**: PDF export line height changes can be deferred to a separate change if desired, but should be documented.

### Ready for Proposal
Yes — clear scope, well-understood patterns, minimal risk.
