import { create } from 'zustand';
import type { DocumentRoot } from '../core/types';
import type { DocumentLayout, BlockLayout, LayoutConstraints } from '../core/layout/types';
import { LayoutEngine, DEFAULT_CONSTRAINTS } from '../core/layout/engine';

// ============================================================
// Layout Store
// ============================================================

interface LayoutState {
  engine: LayoutEngine;
  layout: DocumentLayout | null;
  constraints: LayoutConstraints;

  // Actions
  calculateLayout: (doc: DocumentRoot) => void;
  getBlockLayout: (blockId: string) => BlockLayout | undefined;
  invalidateBlock: (blockId: string) => void;
  updateConstraints: (constraints: Partial<LayoutConstraints>) => void;
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  engine: new LayoutEngine(),
  layout: null,
  constraints: DEFAULT_CONSTRAINTS,

  calculateLayout: (doc) => {
    const { engine } = get();
    const layout = engine.layoutDocument(doc);
    set({ layout });
  },

  getBlockLayout: (blockId) => {
    const { layout } = get();
    return layout?.blocks.find((b) => b.blockId === blockId);
  },

  invalidateBlock: (blockId) => {
    const { engine } = get();
    engine.invalidateBlock(blockId);
  },

  updateConstraints: (constraints) => {
    const { engine } = get();
    const newConstraints = { ...get().constraints, ...constraints };
    engine.updateConstraints(newConstraints);
    set({ constraints: newConstraints });
  },
}));
