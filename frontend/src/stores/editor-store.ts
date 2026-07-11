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

  // Sticky marks — toggled from toolbar when no selection is active.
  // When non-empty, newly typed text will inherit these marks and attrs.
  stickyMarks: MarkType[];
  stickyAttrs: Partial<StyleAttrs>;
  /** Set to true when the user just toggled all sticky marks OFF.
   *  The next insertText will force a plain run (break out of the
   *  current run's inherited styling). Reset after one insertText. */
  stickyBreakOut: boolean;

  // Actions
  setCursorPosition: (position: LogicalPosition) => void;
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
  stickyMarks: [],
  stickyAttrs: {},
  stickyBreakOut: false,

  setCursorPosition: (position) => {
    // Clear sticky marks when the cursor moves to a different block
    // via mouse click (selection would be cleared too).
    // We use a get() to check if selection is being cleared simultaneously.
    set({ cursor: { position } });
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
        // When removing the last mark, signal insertText to break out
        // of the current run's inherited styling.
        stickyBreakOut: has && newMarks.length === 0,
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
    set({ stickyMarks: [], stickyAttrs: {}, stickyBreakOut: true });
  },

  consumeStickyBreakOut: () => {
    set({ stickyBreakOut: false });
  },
}));
