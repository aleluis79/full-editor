import { create } from 'zustand';
import type { Cursor, Selection, LogicalPosition, MarkType, StyleAttrs } from '../core/types';

// ============================================================
// Editor Store
// ============================================================

interface EditorState {
  cursor: Cursor;
  selection: Selection | null;
  focused: boolean;
  clickCount: number; // 1 = single, 2 = double, 3 = triple
  /** When a table is selected (clicked on header/actions) the alignment
   *  buttons apply to the whole table instead of the cell text. */
  selectedTableId: string | null;
  /** Monotonically increasing counter that increments on every
   *  cursor position change. Used as a dependency in Toolbar's
   *  activeStyles computation to force reliable recomputation. */
  cursorVersion: number;

  // Sticky marks — toggled from toolbar when no selection is active.
  // When non-empty, newly typed text will inherit these marks and attrs.
  stickyMarks: MarkType[];
  stickyAttrs: Partial<StyleAttrs>;
  /** Set to true when the user just toggled all sticky marks OFF.
   *  The next insertText will force a plain run (break out of the
   *  current run's inherited styling). Reset after one insertText. */
  stickyBreakOut: boolean;
  /** When the user toggles a sticky mark OFF (e.g. clicks B again),
   *  this stores the mark that was removed. The toolbar filters it
   *  from activeStyles so the button shows inactive even when the
   *  cursor is on text that has that mark. Cleared when the cursor
   *  moves or after one insertText. */
  stickyToggledOff: MarkType | null;

  // Actions
  setCursorPosition: (position: LogicalPosition) => void;
  selectTable: (tableId: string | null) => void;
  setSelection: (selection: Selection | null) => void;
  setFocused: (focused: boolean) => void;
  clearSelection: () => void;
  extendSelection: (focus: LogicalPosition) => void;
  setClickCount: (count: number) => void;

  // Sticky marks actions
  toggleStickyMark: (mark: MarkType) => void;
  setStickyStyle: (key: keyof StyleAttrs, value: string | number | undefined) => void;
  clearStickyMarks: () => void;
  /** Reset stickyBreakOut after it has been consumed by insertText */
  consumeStickyBreakOut: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  cursor: {
    position: { nodeId: '', offset: 0 },
  },
  selection: null,
  focused: false,
  clickCount: 0,
  cursorVersion: 0,
  selectedTableId: null,
  stickyMarks: [],
  stickyAttrs: {},
  stickyBreakOut: false,
  stickyToggledOff: null,

  selectTable: (tableId) => {
    set({ selectedTableId: tableId });
  },

  setCursorPosition: (position) => {
    set((state) => ({
      cursor: { position },
      cursorVersion: state.cursorVersion + 1,
      // Cursor moved: clear the toggled-off mark so the toolbar resumes
      // reflecting the actual cursor position styles.
      stickyToggledOff: null,
    }));
  },

  setSelection: (selection) => {
    // When a selection is active, clear sticky marks — the user is
    // selecting existing text, not about to type new text.
    if (selection) {
      set({ selection, stickyMarks: [], stickyAttrs: {} });
    } else {
      set({ selection: null });
    }
  },

  setFocused: (focused) => {
    set({ focused });
  },

  clearSelection: () => {
    set({ selection: null });
  },

  extendSelection: (focus) => {
    set((state) => {
      if (!state.selection) {
        // Start new selection from current cursor
        return {
          selection: {
            anchor: state.cursor.position,
            focus,
          },
        };
      }
      // Extend existing selection
      return {
        selection: {
          ...state.selection,
          focus,
        },
      };
    });
  },

  setClickCount: (count) => {
    set({ clickCount: count });
  },

  toggleStickyMark: (mark) => {
    set((state) => {
      const has = state.stickyMarks.includes(mark);
      const newMarks = has
        ? state.stickyMarks.filter((m) => m !== mark)
        : [...state.stickyMarks, mark];
      return {
        stickyMarks: newMarks,
        // When removing the last mark, track which mark was toggled off
        // so the toolbar can filter it from activeStyles. Also signal
        // insertText to break out of the current run's styling.
        stickyBreakOut: has && newMarks.length === 0,
        stickyToggledOff: has && newMarks.length === 0 ? mark : null,
      };
    });
  },

  setStickyStyle: (key, value) => {
    set((state) => ({
      stickyAttrs: value !== undefined
        ? { ...state.stickyAttrs, [key]: value }
        : { ...state.stickyAttrs, [key]: undefined } as Partial<StyleAttrs>,
    }));
  },

  clearStickyMarks: () => {
    set((state) => ({
      stickyMarks: [],
      stickyAttrs: {},
      stickyToggledOff: null,
      // Only break out if there were actual sticky marks to clear.
      // When clearStickyMarks is called after applying a style to a
      // selection, sticky was already empty — no need to break out.
      stickyBreakOut: state.stickyMarks.length > 0 || Object.keys(state.stickyAttrs).length > 0,
    }));
  },

  consumeStickyBreakOut: () => {
    set({ stickyBreakOut: false, stickyToggledOff: null });
  },
}));
