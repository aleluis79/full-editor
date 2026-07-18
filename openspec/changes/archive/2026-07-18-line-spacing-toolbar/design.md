# Design: Line Spacing Toolbar

## Technical Approach

Add `lineHeight` to `BlockAttrs` following the exact `textAlign` pattern. A popup toolbar button (matching the table picker pattern) applies presets via `setBlockAttrs`/`setBlockAttrsRange`. The layout engine reads per-block `lineHeight` and prefers it over constraint defaults. History descriptions branch on both `lineHeight` and `textAlign` in the same `setBlockAttrs` call.

## Architecture Decisions

| Option | Tradeoffs | Decision |
|--------|-----------|----------|
| **Preset popup** vs numeric input | Popup: faster, simpler, matches table picker. Numeric: more flexible but more complex (validation, parsing, keyboard). | **Preset popup** (table picker pattern) — per spec scope |
| **BlockAttrs** vs StyleAttrs | BlockAttrs matches textAlign pattern, no refactoring needed. StyleAttrs would require new infrastructure. | **BlockAttrs** — lineHeight is block-level, same storage as textAlign |
| **Inline style** vs CSS class | Inline `style.lineHeight` has highest specificity, avoids `.editor-*` specificity fights. CSS class needs dynamic class management per block. | **Inline style** — matches existing `textAlign` approach in DocumentView |
| **Layout engine override** vs global constraint swap | Per-block read in layoutParagraph/layoutHeading/layoutTableCell: explicit, testable, minimal change. | **Per-block read** — only 4 functions to modify, preserves heading default fallback |

## Data Flow

```
Toolbar button click
  → setShowLineSpacing(true)
  → popup renders presets [1.0, 1.15, 1.5, 2.0, 2.5, 3.0]

User clicks preset "2.0"
  → if active preset: setBlockAttrs(id, { lineHeight: undefined })  // toggle off
  → else: setBlockAttrs(id, { lineHeight: 2.0 })  // or setBlockAttrsRange for multi-block
  → store applies → history entry → doc update → re-layout → re-render

Layout engine reads block.attrs.lineHeight
  → layoutParagraph: override constraints.lineHeight
  → layoutHeading: merge into headingConstraints
  → layoutTextRuns: picks up from constraints
  → layoutTableCell: picks up from cellConstraints

DocumentView renders:
  style={{ lineHeight: block.attrs?.lineHeight ?? undefined }}
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/core/types.ts` | Modify | Add `lineHeight?: number` to `BlockAttrs` |
| `frontend/src/core/layout/engine.ts` | Modify | Read `block.attrs.lineHeight` in `layoutParagraph`, `layoutHeading`, `layoutTableCell` |
| `frontend/src/components/DocumentView.tsx` | Modify | Add `lineHeight: block.attrs?.lineHeight` to inline style (line ~633) |
| `frontend/src/components/Toolbar.tsx` | Modify | Add line spacing popup: button + useState + useRef + outside click handler + preset grid |
| `frontend/src/components/icons/LineHeight.tsx` | Create | SVG icon (vertical arrows with lines) |
| `frontend/src/components/icons/index.ts` | Modify | Export `LineHeight` |
| `frontend/src/stores/document-store.ts` | Modify | Update history descriptions in `setBlockAttrs` (line ~913) and `setBlockAttrsRange` (line ~967) to handle both `lineHeight` and `textAlign` |
| `frontend/src/components/__tests__/Toolbar.test.tsx` | Modify | Tests for popup open/close, preset selection, toggle off, outside click |

## Interfaces / Contracts

### BlockAttrs (modified)
```typescript
export interface BlockAttrs {
  textAlign?: TextAlign;
  lineHeight?: number; // NEW — positive float, e.g. 1.0, 1.15, 1.5, 2.0, 2.5, 3.0
}
```

### History description (modified logic)
```typescript
// In both setBlockAttrs and setBlockAttrsRange:
const parts: string[] = [];
if (attrs.textAlign) parts.push(`Align ${attrs.textAlign}`);
if (attrs.lineHeight) parts.push(`Line height ${attrs.lineHeight}`);
if (attrs.textAlign === undefined && attrs.lineHeight === undefined) parts.push('Set block attrs');
const description = parts.join(', ');
// For multi-block: append ` (N blocks)` when ops.length > 1
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `BlockAttrs.lineHeight` type validation | TypeScript — non-positive values rejected at store level (line 891 checks) |
| Unit | Layout engine reads per-block `lineHeight` | Mock a paragraph with `attrs.lineHeight: 2.0`, assert `layoutParagraph` produces correct height |
| Integration | Popup opens/closes on button click | Render Toolbar, click button → popup visible; click again → hidden |
| Integration | Outside click closes popup | Open popup, `mousedown` outside → popup closes |
| Integration | Selecting a preset applies `lineHeight` | Open popup, click "2.0" → verify store called with `{ lineHeight: 2.0 }` and popup closes |
| Integration | Active preset toggles off | Block has `lineHeight: 1.5`, click active preset → `{ lineHeight: undefined }` |
| Integration | Empty state shows no active preset | Block has no lineHeight → no preset highlighted |
| Integration | Multi-block selection applies to all | Select 3 paragraphs, click preset → `setBlockAttrsRange` called with correct attrs |
| E2E | Visual rendering with lineHeight | Render document view, apply lineHeight, verify inline style on DOM element |
| E2E | Undo reverts lineHeight | Apply preset, trigger undo, verify lineHeight removed from block attrs |

## Migration / Rollout

No migration required. `lineHeight` is optional on `BlockAttrs` — existing documents have no `lineHeight` and render with layout engine defaults. Feature is additive.

## Open Questions

None.

## Next Phase

`sdd-tasks` — break down into implementation tasks.
