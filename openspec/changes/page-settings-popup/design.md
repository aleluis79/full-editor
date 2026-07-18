# Design: Page Settings Popup

## Technical Approach

Replace the inline paper size `<select>` with a gear-icon popup. Add `orientation` to the page model, persist it, and pass it through to PDF export. Margins shown in points (user-facing) but stored in CSS pixels (matching the PaginationEngine's internal unit). Conversion happens only at display and at the PDF export boundary.

## Architecture Decisions

### Decision: Internal margin unit

**Choice**: Keep CSS pixels (96dpi) in PaginationEngine/page-store. Display as points (÷96×72) in popup inputs. Convert to points (×72÷96) on PDF export.
**Alternatives**: Change paper.ts to ReportLab points (595×842) — would require layout engine recalibration and risks visual regressions.
**Rationale**: Existing paper sizes (794×1123) are baked into screen layout. Changing them affects text wrapping across all documents. Keeping CSS pixels internally isolates the change to the popup display layer.

### Decision: Orientation storage

**Choice**: Add `orientation: 'portrait' | 'landscape'` to `PaginationConfig`. `getOrientedSize()` returns width/height swapped when landscape. PaginationEngine uses oriented dimensions.
**Alternatives**: Store width/height directly as oriented values, but then switching back to portrait loses the original dimensions.
**Rationale**: Storing orientation as a flag preserves the original paper dimensions and makes toggle reversible.

### Decision: Popup as inline component, not portal

**Choice**: `PageSettingsPopup` follows the `.line-spacing-popover` pattern — absolute-positioned div in the toolbar group, outside-click via `useEffect`/`mousedown`.
**Alternatives**: React portal to `document.body` — used by some apps, but no existing popup in this codebase uses portals.
**Rationale**: Consistency with line-spacing, block-picker, and table-picker popovers. Simpler, no portal management.

## Data Flow

```
 Gear Click
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ PageSettingsPopup                                     │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Paper: ○ A4  ○ Letter  ○ Legal                   │ │
│ │ Orientation: [Portrait | Landscape]               │ │
│ │ Margins: [Top:___] [Right:___] [Bottom:___] [L___]│ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────┬───────────────────────────────┘
    │                     │                      │
    ▼                     ▼                      ▼
updatePaperSize()   updateOrientation()    updateMargins()
    │                     │                      │
    └─────────────────────┼──────────────────────┘
                          ▼
               page-store → engine.updateConfig()
                          │
                          ▼
              updateConstraints(width) → layout-store
                          │
                          ▼
                   document-store
                  (save/load orientation)

Export flow:
  frontend: pageConfig → { paper_size: name, orientation, margins: ×0.75 }
       │
       ▼
  backend: ExportRequest → reportlab.landscape(pagesize) + margins
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/core/pagination/types.ts` | Modify | Add `orientation: 'portrait' \| 'landscape'` to `PaginationConfig` |
| `frontend/src/core/pagination/paper.ts` | Modify | Add `getOrientedSize(ps, orientation)` — swaps w/h on landscape |
| `frontend/src/core/pagination/engine.ts` | Modify | Use oriented dimensions from paper.ts instead of raw paperSize |
| `frontend/src/stores/page-store.ts` | Modify | Add `updateOrientation()`, default `orientation: 'portrait'` |
| `frontend/src/stores/document-store.ts` | Modify | Save/load `content.config.orientation`; default to `'portrait'` |
| `frontend/src/components/PageSettingsPopup.tsx` | **Create** | Popup with paper radio, orientation toggle, margin inputs |
| `frontend/src/components/icons/Settings.tsx` | **Create** | Gear/settings SVG icon (16×16) |
| `frontend/src/components/icons/index.ts` | Modify | Export `Settings` |
| `frontend/src/components/Toolbar.tsx` | Modify | Remove `<select>` (lines 606-625), add gear button, pass orientation to `exportPDF()` |
| `frontend/src/api/client.ts` | Modify | Add `orientation?: string` to `ExportPDFData` |
| `frontend/src/index.css` | Modify | Add `.page-settings-popover` styles |
| `backend/app/api/documents.py` | Modify | Add `orientation: str = "portrait"` to `ExportRequest` |
| `backend/app/services/pdf_export.py` | Modify | Accept `orientation`, apply `landscape()` when set |

## Interfaces / Contracts

```typescript
// pagination/types.ts
export interface PaginationConfig {
  paperSize: PaperSize;
  orientation: 'portrait' | 'landscape'; // NEW
  margins: Margins;
  headerFooter: HeaderFooterConfig;
}

// pagination/paper.ts
export function getOrientedSize(
  paperSize: PaperSize,
  orientation: 'portrait' | 'landscape'
): { width: number; height: number };

// api/client.ts
export interface ExportPDFData {
  content: Record<string, unknown>;
  paper_size?: string;
  orientation?: string;            // NEW
  margins?: Margins;
  page_breaks?: string[];
}
```

```python
# backend/api/documents.py
class ExportRequest(BaseModel):
    content: dict
    paper_size: str = "A4"
    orientation: str = "portrait"  # NEW
    margins: dict = {"top": 72, "right": 72, "bottom": 72, "left": 72}
    page_breaks: list[str] = []
```

```python
# backend/services/pdf_export.py
from reportlab.lib.pagesizes import landscape as rl_landscape

# In export():
page_size = PAPER_SIZES.get(paper_size, A4)
if orientation == "landscape":
    page_size = rl_landscape(page_size)
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `getOrientedSize()` | A4 portrait → 794×1123, A4 landscape → 1123×794. Legal landscape → 1344×816. |
| Unit | `updateOrientation()` in page-store | Call with 'landscape', verify `config.orientation` is 'landscape' and constraints width reflects swapped dims. |
| Unit | Margin clamping in `updateMargins()` | Pass negative values, verify clamped to 0. |
| Unit | Orientation persistence in document-store | `loadDocument` with orientation: 'landscape' in saved config → page-store has orientation 'landscape'. Missing orientation → defaults to 'portrait'. |
| Unit | Document save includes orientation | Verify content.config sent to API includes orientation field. |
| Integration | Toolbar gear button renders | Render Toolbar, find gear button by title. Click → popup appears. |
| Integration | Backend orientation handling | Call `exporter.export()` with `orientation='landscape'` on Letter → verify page size is landscape Letter. |
| Integration | Backend orientation default | Call `exporter.export()` without orientation → renders portrait. |
| Integration | Backend margin passthrough | Call `exporter.export()` with custom margins → verify SimpleDocTemplate receives them. |

## Migration / Rollout

No migration required. Existing content.config files without `orientation` or with missing margins use `'portrait'` / 96px defaults via the existing fallback in both frontend and backend.

## Open Questions

- None
