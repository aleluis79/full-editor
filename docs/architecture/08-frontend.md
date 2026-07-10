# Frontend Architecture

## Stack

- React 19 + TypeScript
- Vite 8
- Zustand for state management
- Vitest for testing

## State Management: Zustand Stores by Domain

```typescript
// DocumentStore - model, operations, history
interface DocumentStore {
  document: Document;
  executeOperation: (op: Operation) => void;
  undo: () => void;
  redo: () => void;
}

// LayoutStore - cached layout, pages, block positions
interface LayoutStore {
  pages: Page[];
  blocks: Map<string, LayoutResult>;
  invalidate: (blockId: string) => void;
}

// EditorStore - cursor, selection, editing mode
interface EditorStore {
  cursor: CursorPosition;
  selection: Selection | null;
  setCursor: (pos: CursorPosition) => void;
  setSelection: (sel: Selection) => void;
}

// UIStore - zoom, panels, sidebar, theme
interface UIStore {
  zoom: number;
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
}
```

## Component Hierarchy

```
EditorRoot
├── Toolbar
├── Sidebar
├── PageCanvas (scroll container)
│   ├── Page
│   │   ├── Header
│   │   ├── Content (blocks)
│   │   ├── Footer
│   │   └── PageNumber
│   ├── Page
│   └── Page
└── StatusBar
```

## Rendering Strategy

- **React**: Toolbar, Sidebar, StatusBar, page shell
- **DOM puro**: Page content (via ref, direct manipulation)
- React doesn't diff page content on every keystroke

## Data Flow (Typing a character)

```
1. Interaction Layer: KeyDown → 'A'
2. DocumentStore: InsertText → mutate model → generate Diff → push to History
3. LayoutStore: invalidate paragraph → recalculate block
4. PaginationEngine: check if page still fits
5. Renderer: re-render affected pages (DOM diff only changed elements)
6. EditorStore: update cursor → Layout Engine calculates screen position
```

All in one frame (< 16ms).
