import { create } from 'zustand';

// ── Types ──────────────────────────────────────────────────────

export interface Misspelling {
  word: string;
  start: number;
  end: number;
  suggestions: string[];
}

export interface PopoverState {
  blockId: string;
  start: number;
  end: number;
  suggestions: string[];
}

export interface PopoverPosition {
  x: number;
  y: number;
}

interface SpellCheckState {
  /** Whether spell check is enabled (default: true) */
  enabled: boolean;
  /** Map of blockId → misspellings for that block */
  misspellings: Record<string, Misspelling[]>;
  /** The user's custom dictionary words (fetched from API) */
  customWords: string[];
  /** Current popover state (null when hidden) */
  popover: PopoverState | null;
  /** Screen position of the popover */
  popoverPosition: PopoverPosition | null;

  // Actions
  toggle: () => void;
  setMisspellings: (blockId: string, words: Misspelling[]) => void;
  clearBlock: (blockId: string) => void;
  clearAll: () => void;
  setCustomWords: (words: string[]) => void;
  addCustomWord: (word: string) => void;
  showPopover: (opts: PopoverState, position?: PopoverPosition) => void;
  hidePopover: () => void;
}

export const useSpellCheckStore = create<SpellCheckState>((set) => ({
  enabled: true,
  misspellings: {},
  customWords: [],
  popover: null,
  popoverPosition: null,

  toggle: () => {
    set((state) => {
      const next = !state.enabled;
      return {
        enabled: next,
        // Clear all misspellings when disabling
        misspellings: next ? state.misspellings : {},
        popover: next ? state.popover : null,
        popoverPosition: next ? state.popoverPosition : null,
      };
    });
  },

  setMisspellings: (blockId, words) => {
    set((state) => ({
      misspellings: { ...state.misspellings, [blockId]: words },
    }));
  },

  clearBlock: (blockId) => {
    set((state) => {
      const next = { ...state.misspellings };
      delete next[blockId];
      return { misspellings: next };
    });
  },

  clearAll: () => {
    set({ misspellings: {}, popover: null, popoverPosition: null });
  },

  setCustomWords: (words) => {
    set({ customWords: words });
  },

  addCustomWord: (word) => {
    set((state) => ({
      customWords: state.customWords.includes(word)
        ? state.customWords
        : [...state.customWords, word],
    }));
  },

  showPopover: (opts, position) => {
    set({ popover: opts, popoverPosition: position ?? null });
  },

  hidePopover: () => {
    set({ popover: null, popoverPosition: null });
  },
}));
