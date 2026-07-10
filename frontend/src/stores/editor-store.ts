import { create } from 'zustand';
import type { Cursor, Selection, LogicalPosition } from '../core/types';

// ============================================================
// Editor Store
// ============================================================

interface EditorState {
  cursor: Cursor;
  selection: Selection | null;
  focused: boolean;
  clickCount: number; // 1 = single, 2 = double, 3 = triple

  // Actions
  setCursorPosition: (position: LogicalPosition) => void;
  setSelection: (selection: Selection | null) => void;
  setFocused: (focused: boolean) => void;
  clearSelection: () => void;
  extendSelection: (focus: LogicalPosition) => void;
  setClickCount: (count: number) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  cursor: {
    position: { nodeId: '', offset: 0 },
  },
  selection: null,
  focused: false,
  clickCount: 0,

  setCursorPosition: (position) => {
    set({ cursor: { position } });
  },

  setSelection: (selection) => {
    set({ selection });
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
}));
