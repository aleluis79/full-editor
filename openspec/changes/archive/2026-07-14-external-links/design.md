# Design: External Link Support

## Technical Approach

Add `href` as an optional string field on `TextRun` and `'link'` as a `MarkType` value. Links are toggled via two new operations (`SetLinkOp`, `RemoveLinkOp`) that reuse the existing `splitRunsAtRange` mechanism. Rendering wraps linked runs in `<a>` elements. PDF export emits ReportLab `<a href>` markup.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|---|---|---|---|
| Link storage | (a) `href` field on TextRun, (b) separate link entity map | (a) Field on TextRun | Links are per-run data, not cross-cutting. Matches existing StyleAttrs pattern. No indirection needed for render or layout. |
| Operation design | (a) Single `ToggleLinkOp` with href param, (b) separate `SetLinkOp`/`RemoveLinkOp` | (b) Two ops | Links have payload (href) unlike boolean marks. Set/Remove distinction makes undo/redo unambiguous — no toggle ambiguity when applying across multi-run ranges. |
| Popup dialog | (a) HTML `<dialog>`, (b) inline React state + portal | (b) Inline React state | Matches existing table picker pattern (`showTablePicker`). No extra DOM layer needed. |

## Data Flow

```
User clicks 🔗 or Ctrl+K
      │
      ▼
hasSelection? ───no──→ cursor inside link? ──yes──→ RemoveLinkOp
      │                                              (no selection = remove)
      │
     yes
      │
      ▼
  URL popup dialog
      │
      ▼
Empty URL? ──yes──→ close, no-op
      │
      ▼
 SetLinkOp(blockId, startOffset, endOffset, href)
      │
      ▼
 splitRunsAtRange(split at selection boundaries)
      │
      ▼
 For each run in [startRunIndex..endRunIndex]:
   marks.push('link'), run.href = href
      │
      ▼
 React re-render → TextRun checks run.href → <a href={href}>
      │
      ▼
 Layout engine → PositionedRun.href propagated
      │
      ▼
 PDF export → _extract_text wraps href runs in <a href="...">
```

## File Changes

| File | Action | Description |
|---|---|---|
| `frontend/src/core/types.ts` | Modify | Add `'link'` to `MarkType`, `href?: string` to `TextRun`, `SetLinkOp`/`RemoveLinkOp` types, add to `Operation` union |
| `frontend/src/core/document.ts` | Modify | `createTextRun` accepts optional `href`, `mergeRuns` preserves it |
| `frontend/src/core/operations.ts` | Modify | Add `applySetLink`, `applyRemoveLink`, `invertSetLink`, `invertRemoveLink`; register in `applyOperation`/`invertOperation` |
| `frontend/src/components/TextRun.tsx` | Modify | If `run.href`, render `<a href={href}>` with blue underline style |
| `frontend/src/components/Toolbar.tsx` | Modify | Add link button + URL popup dialog + link state reflection |
| `frontend/src/components/Editor.tsx` | Modify | Add `setLink` store function, Ctrl+K handler in keyboard switch |
| `frontend/src/stores/document-store.ts` | Modify | Add `setLink`/`removeLink` actions, import new operations |
| `frontend/src/core/layout/types.ts` | Modify | Add `href?: string` to `PositionedRun` |
| `frontend/src/core/layout/engine.ts` | Modify | Propagate `run.href` into `PositionedRun` in `layoutTextRuns` |
| `backend/app/services/pdf_export.py` | Modify | In `_extract_text`, wrap linked runs with `<a href="...">` |

## Interfaces / Contracts

```typescript
// types.ts additions
type MarkType = 'bold' | 'italic' | 'underline' | 'strikethrough' | 'link';

interface TextRun extends BaseNode {
  type: 'text';
  content: string;
  marks: MarkType[];
  attrs?: StyleAttrs;
  href?: string;           // NEW
}

interface SetLinkOp extends BaseOperation {
  type: 'setLink';
  startOffset: number;
  endOffset: number;
  href: string;
}

interface RemoveLinkOp extends BaseOperation {
  type: 'removeLink';
  startOffset: number;
  endOffset: number;
}

// Popup component API (inline in Toolbar.tsx, not a separate file)
interface LinkPopupProps {
  onSubmit: (url: string) => void;
  onCancel: () => void;
}
```

```python
# pdf_export.py — _extract_text addition
if 'link' in marks:
    href = child.get("href", "")
    if href:
        content = f'<a href="{href}">{content}</a>'
```

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | `SetLinkOp` splits runs and sets href on correct range | `applySetLink(doc, op)` → assert runs in range have `href` and `'link'` mark |
| Unit | `RemoveLinkOp` strips href from linked range | `applyRemoveLink` → assert href removed, `'link'` removed from marks, other marks preserved |
| Unit | Empty URL rejected | Popup handler: empty/whitespace → no operation dispatched |
| Unit | Ctrl+K on cursor inside link → RemoveLinkOp | `hasSelection=false` + cursor inside linked run → RemoveLinkOp dispatched |
| Unit | Layout propagates href | `layoutTextRuns` → `PositionedRun.href === TextRun.href` |
| Unit | PDF `_extract_text` wraps link | Run with `href` → output contains `<a href="...">` |
| Integration | Toolbar popup → URL input → SetLinkOp applied | Mount Toolbar, click link button, enter URL, verify store called |
| E2E | Full flow: select text → Ctrl+K → enter URL → `<a>` rendered | Keyboard simulation + DOM assertion |

## Migration / Rollout

No migration required. `href` is optional and undefined by default. Old documents without links render identically.

## Open Questions

- [ ] Should the link popup pre-fill with `https://` or leave empty? (Spec says empty URL → no-op, so pre-fill is a UX choice.)
