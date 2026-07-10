# Full Editor — Architecture Reference

Professional document editor built from scratch. No Tiptap, ProseMirror, Slate, or Lexical.

## Architecture Model: Hybrid (Option C)

- **Document Model + Editing**: TypeScript (frontend) — source of truth for interactive editing
- **Backend Python**: Persistence, PDF export, heavy batch operations
- **Layout Engine**: TypeScript in Web Worker
- **Format interchange**: JSON between frontend and backend

## Layers

```
Document Model (TypeScript)
     ↓
Operations Engine + History Engine
     ↓
Layout Engine (Web Worker)
     ↓
Pagination Engine
     ↓
Renderer (DOM)
     ↓
Interaction Layer

Backend Python: Persistencia + PDF Export
```

## Decision Log

| Module | Decision |
|---|---|
| Document Model | Deep tree with sections, inline runs, mutable + operations |
| Operations | Structural diffs, batch per input session, flattened compounds |
| History | Stack of serialized diffs, mechanical undo |
| Layout | Block-level, invalidation tree, Strategy Pattern, OffscreenCanvas in Worker |
| Pagination | Greedy look-ahead, per-section headers/footers, incremental |
| Renderer | DOM, virtualization by page, overlays for cursor/selection |
| Interaction | Hit testing via layout, visual cursor, anchor+focus selection |
| Backend | REST, JSON in PostgreSQL, SQLModel, reportlab for PDF |
| Frontend | Zustand stores by domain, React UI + DOM for page content |
| Testing | Vitest (unit/integration) + Playwright (E2E) |
| Roadmap | 13 phases, each produces a functional editor |

## Phased Development Roadmap

1. **Minimum Functional Editor** — Document model, paragraphs, cursor, basic typing
2. **Selection & Clipboard** — Selection, copy/cut/paste
3. **History** — Undo/Redo with Command Pattern + diffs
4. **Text Styles** — Bold, italic, underline, font family, size, color
5. **Block Types** — Headings, lists, blockquotes, horizontal rules
6. **Layout Engine** — Text measurement, wrapping, positioning, alignment
7. **Pagination** — Paper sizes, margins, page distribution, virtualization
8. **Headers, Footers & Page Numbers** — Per-section headers/footers
9. **Images** — Inline and block images, text wrapping
10. **Tables** — Grid, cells, rows/columns, merge, styles
11. **Backend & Persistence** — FastAPI + SQLModel, REST API
12. **PDF Export** — reportlab/fpdf2 with pre-calculated positions
13. **Optimization** — Web Workers, lazy loading, 500+ pages performance

## Key Architecture Documents

- [Document Model](01-document-model.md)
- [Operations Engine](02-operations-engine.md)
- [Layout Engine](03-layout-engine.md)
- [Pagination Engine](04-pagination-engine.md)
- [Renderer](05-renderer.md)
- [Interaction Layer](06-interaction-layer.md)
- [Backend](07-backend.md)
- [Frontend](08-frontend.md)
- [Testing](09-testing.md)
