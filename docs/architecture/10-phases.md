# Development Phases

Each phase produces a functional editor.

## Phase 1: Minimum Functional Editor

**Goal**: Open the editor, type text, move cursor. A custom Notepad.

- Document model (runs, tree, IDs)
- Paragraphs with text
- Basic typing (insert characters)
- Backspace/Delete
- Own cursor (arrow navigation)

**Stack**: Frontend only. No backend. No real layout (single infinite "page").

---

## Phase 2: Selection & Clipboard

**Goal**: Select text, copy, paste.

- Own selection (click+drag, Shift+arrows)
- Double click → select word
- Triple click → select paragraph
- Copy/Cut/Paste (plain text)

---

## Phase 3: History

**Goal**: Undo/Redo works correctly.

- Undo/Redo (Command Pattern + diffs)
- Input batch (group keystrokes)
- History panel (future)

---

## Phase 4: Text Styles

**Goal**: Format text with inline styles.

- Marks: bold, italic, underline, strikethrough
- Marks: font family, font size, color
- Toggle marks (Ctrl+B, Ctrl+I, Ctrl+U)
- Formatting toolbar

---

## Phase 5: Block Types

**Goal**: Documents with real structure.

- Headings (H1-H6)
- Lists (ordered, unordered, nested)
- Blockquotes
- Horizontal rules

---

## Phase 6: Layout Engine

**Goal**: Text distributes correctly in simulated page.

- Text measurement (OffscreenCanvas in Worker)
- Word wrapping
- X/Y positioning per block
- Alignment (left, center, right, justify)
- Indentation and spacing
- Invalidation tree for incremental recalculation

---

## Phase 7: Pagination

**Goal**: Multi-page document with scroll.

- Pagination Engine (greedy look-ahead)
- Paper sizes (A4, Letter, Legal)
- Configurable margins
- Block distribution across pages
- Incremental pagination
- Page virtualization

---

## Phase 8: Headers, Footers & Page Numbers

**Goal**: Professional documents.

- Per-section headers
- Per-section footers
- Page numbers
- First page different (cover page)

---

## Phase 9: Images

**Goal**: Documents with images.

- Insert image (inline and block)
- Image resize
- Text wrapping around images
- Positioning

---

## Phase 10: Tables

**Goal**: Functional tables.

- Insert table (grid)
- Edit cells
- Add/remove rows and columns
- Cell merge
- Table styles
- Cell layout (mini-layout engine)

---

## Phase 11: Backend & Persistence

**Goal**: Documents persist.

- FastAPI + SQLModel
- Create/load/save documents
- JSON serialization of model
- REST API

---

## Phase 12: PDF Export

**Goal**: Export to PDF with fidelity.

- PDF renderer (reportlab/fpdf2)
- Headers/footers in PDF
- Page numbers in PDF
- Images in PDF
- Tables in PDF

---

## Phase 13: Optimization

**Goal**: Fast with large documents.

- Web Worker for full layout
- Lazy page loading
- Profile and optimize hot paths
- 500+ page documents
