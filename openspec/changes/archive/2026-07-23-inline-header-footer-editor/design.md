# Design: Inline Header/Footer WYSIWYG Editor

## Technical Approach

Replace the static `renderHeaderFooterContent()` in `DocumentView.tsx` (L159-172, L279-299) with a new `InlineHeaderFooterEditor` component. The editor uses a **hidden textarea + styled overlay** pattern (same approach as the main document editor — no `contentEditable`). A single `editingHeaderFooter` flag in `page-store` enforces the one-active-editor constraint. The main `Toolbar` detects header/footer mode and shows a contextual subset (marks + tokens). `PageSettingsPopup` drops text inputs, keeping only toggles, heights, and position.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|----------|---------|--------|-----------|
| Editing engine | contentEditable vs textarea+overlay | **textarea+overlay** | Consistent with main editor pattern; avoids contentEditable cross-browser quirks; existing cursor measurement via Range API is reusable |
| Toolbar strategy | Separate floating toolbar vs extend main Toolbar | **Extend main Toolbar** | Single source of truth for mark state; no duplicate UI; users already know the toolbar location |
| State location | New dedicated store vs extend page-store | **Extend page-store** | Header/footer config already lives there; `editingHeaderFooter` is a UI mode of the same feature |
| Token resolution | Resolve at render time vs store resolved values | **Resolve at render time** | Tokens like `{pageNumber}` are dynamic per page; storing resolved values would desync on pagination changes |
| Cursor tracking | Per-component local state vs shared editor-store cursor | **Local state in InlineHeaderFooterEditor** | Header/footer cursor is independent from document cursor; sharing would require complex gating |

## Data Flow

```
User clicks header zone on page 2
    │
    ▼
InlineHeaderFooterEditor.onClick()
    │  sets local cursor position from click coordinates
    │
    ▼
page-store.setEditingHeaderFooter('header')
    │
    ├──→ Toolbar detects mode → shows marks + tokens subset
    │
    ├──→ All page header zones re-render:
    │    active zone: textarea visible + overlay with cursor
    │    inactive zones: read-only overlay
    │
    └──→ User types / applies mark / inserts token
         │
         ▼
         InlineHeaderFooterEditor updates runs
         │  via page-store.updateHeaderFooter()
         │
         ▼
         All pages re-render header with new runs
         (real-time preview across all pages)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/components/InlineHeaderFooterEditor.tsx` | Create | Inline WYSIWYG editor: hidden textarea + styled span overlay, cursor measurement, mark/token support |
| `frontend/src/stores/page-store.ts` | Modify | Add `editingHeaderFooter: 'header' \| 'footer' \| null`, `setEditingHeaderFooter()`, `updateHeaderFooterRuns()` |
| `frontend/src/components/DocumentView.tsx` | Modify | Replace `renderHeaderFooterContent()` calls (L170, L290) with `<InlineHeaderFooterEditor>` instances |
| `frontend/src/components/Toolbar.tsx` | Modify | Read `editingHeaderFooter` from page-store; when active, hide document-specific buttons (blocks, alignment, lists, image, table) and show token insertion buttons |
| `frontend/src/components/PageSettingsPopup.tsx` | Modify | Remove header/footer text inputs and token buttons (L302-376); keep enabled toggle, firstPageDifferent, height inputs, pageNumberPosition |
| `frontend/src/core/header-footer-ops.ts` | Create | Pure functions: `insertTokenAtCursor()`, `toggleMarkOnRuns()`, `runsFromPlainText()`, `resolveTokens()` |

## Interfaces / Contracts

### State Extension (page-store)

```typescript
// Added to PageState interface
editingHeaderFooter: 'header' | 'footer' | null;
setEditingHeaderFooter: (mode: 'header' | 'footer' | null) => void;
updateHeaderFooterRuns: (target: 'header' | 'footer', runs: TextRun[]) => void;
```

### InlineHeaderFooterEditor Props

```typescript
interface InlineHeaderFooterEditorProps {
  target: 'header' | 'footer';
  runs: TextRun[];
  area: { x: number; y: number; width: number; height: number };
  isActive: boolean;
  pageNumber: number;       // for {pageNumber} resolution
  totalPages: number;       // for {totalPages} resolution
  onActivate: () => void;   // sets editingHeaderFooter
  onChange: (runs: TextRun[]) => void;
}
```

### Token Resolution

```typescript
const TOKEN_RESOLVERS: Record<string, (ctx: TokenContext) => string> = {
  '{pageNumber}': (ctx) => String(ctx.pageNumber),
  '{totalPages}': (ctx) => String(ctx.totalPages),
  '{date}': () => new Date().toLocaleDateString(),
  '{time}': () => new Date().toLocaleTimeString(),
};
```

### Token Insertion Algorithm

```
insertTokenAtCursor(runs, cursorOffset, token):
  1. Walk runs to find which run contains cursorOffset
  2. Split that run at cursorOffset → before + after
  3. Create new TextRun { content: token, marks: [] }
  4. Return [...runsBefore, before, tokenRun, after, ...runsAfter]
```

## Focus Management

- **Single-editor constraint**: `editingHeaderFooter` is the source of truth. When `'header'`, main document editor sets `focused: false` in editor-store. When `null`, main editor regains focus.
- **Escape handling**: Global keydown listener in `DocumentView` checks `editingHeaderFooter !== null` → calls `setEditingHeaderFooter(null)` → main editor re-focuses.
- **Click-outside**: If click target is not inside any `InlineHeaderFooterEditor` and not inside Toolbar → `setEditingHeaderFooter(null)`.
- **Keyboard routing**: When `editingHeaderFooter !== null`, keyboard events are handled by the active `InlineHeaderFooterEditor` instance, not by the main editor's keydown handler. Main editor checks this flag before processing keystrokes.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `header-footer-ops.ts` pure functions | Vitest: insertTokenAtCursor at boundary offsets, toggleMarkOnRuns with selection ranges, resolveTokens with all token types |
| Unit | Token resolution | Vitest: `{pageNumber}` → "3", unknown token → literal string |
| Integration | InlineHeaderFooterEditor render + interaction | Vitest + Testing Library: click activates, typing updates runs, mark toggle changes run marks |
| Integration | Toolbar contextual mode | Vitest: when `editingHeaderFooter='header'`, token buttons visible; document buttons hidden |
| Integration | Focus management | Vitest: Escape exits to main editor, click-outside exits, keyboard routes to active editor |
| E2E | Full workflow | Playwright: click header → type → apply bold → insert token → verify preview → export PDF matches |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. The `TextRun[]` schema already supports marks. Existing `HeaderFooterConfig.header.runs` and `footer.runs` are reused as-is. Plain text from the old popup inputs converts to a single `TextRun` with no marks (backward compatible).

## Open Questions

- [ ] Should the contextual toolbar be a **subset** of the main toolbar (hide irrelevant buttons) or a **separate floating bar** positioned near the active zone? Decision: subset of main toolbar (simpler, consistent).
- [ ] When `firstPageDifferent` is enabled, should page 1 show a separate editable zone for first-page header/footer content? Decision: deferred (out of scope per proposal).
