import { create } from 'zustand';
import type { DocumentLayout } from '../core/layout/types';
import type {
  Page,
  PaginationConfig,
  PaperSize,
  Margins,
  HeaderFooterConfig,
  PageNumberPosition,
} from '../core/pagination/types';
import type { TextRun } from '../core/types';
import { PaginationEngine } from '../core/pagination/engine';
import { getOrientedSize } from '../core/pagination/paper';
import { useLayoutStore } from './layout-store';
import { useDocumentStore } from './document-store';

// ============================================================
// A4 at 96dpi: 794 x 1123px, 1 inch margins = 96px
// ============================================================

const DEFAULT_PAPER: PaperSize = { name: 'A4', width: 794, height: 1123 };
const DEFAULT_MARGINS: Margins = { top: 96, right: 96, bottom: 96, left: 96 };

// ============================================================
// Page Store
// ============================================================

interface PageState {
  engine: PaginationEngine;
  pages: Page[];
  totalPages: number;
  config: PaginationConfig;
  /** Which header/footer zone is being edited inline (null = main editor active) */
  editingHeaderFooter: 'header' | 'footer' | null;
  /** Cursor offset within the active header/footer textarea */
  hfCursorOffset: number;

  // Actions
  paginate: (layout: DocumentLayout) => void;
  getPage: (index: number) => Page | undefined;
  updatePaperSize: (paperSize: PaperSize) => void;
  updateOrientation: (orientation: 'portrait' | 'landscape') => void;
  updateMargins: (margins: Partial<Margins>) => void;
  updateHeaderFooter: (config: Partial<HeaderFooterConfig>) => void;
  updatePageNumberPosition: (position: PageNumberPosition) => void;
  /** Set which header/footer zone is being edited inline */
  setEditingHeaderFooter: (mode: 'header' | 'footer' | null) => void;
  /** Update runs for header or footer target */
  updateHeaderFooterRuns: (target: 'header' | 'footer', runs: TextRun[]) => void;
  /** Set cursor offset within the active header/footer textarea */
  setHfCursorOffset: (offset: number) => void;
  /** Rounded paper sizes for the UI selector */
  availablePaperSizes: PaperSize[];
}

export const usePageStore = create<PageState>((set, get) => ({
  engine: new PaginationEngine({
    paperSize: DEFAULT_PAPER,
    margins: DEFAULT_MARGINS,
  }),
  pages: [],
  totalPages: 0,
  editingHeaderFooter: null,
  hfCursorOffset: 0,
  config: {
    paperSize: { ...DEFAULT_PAPER },
    orientation: 'portrait',
    margins: { ...DEFAULT_MARGINS },
    headerFooter: {
      enabled: false,
      firstPageDifferent: true,
      header: { runs: [], height: 36 },
      footer: { runs: [], height: 36 },
      pageNumberPosition: 'bottom-center',
    },
  },
  availablePaperSizes: [
    { name: 'A4', width: 794, height: 1123 },
    { name: 'Letter', width: 816, height: 1056 },
    { name: 'Legal', width: 816, height: 1344 },
  ],

  setEditingHeaderFooter: (mode) => {
    set({ editingHeaderFooter: mode });
  },

  setHfCursorOffset: (offset) => {
    set({ hfCursorOffset: offset });
  },

  updateHeaderFooterRuns: (target, runs) => {
    const { engine, config } = get();
    const hf = config.headerFooter;
    engine.updateConfig({
      headerFooter: {
        ...hf,
        [target]: { ...hf[target], runs },
      },
    });
    set({ config: engine.getConfig() });

    // Mark document as dirty so the save button is enabled
    useDocumentStore.getState().markDirty();
  },

  paginate: (layout) => {
    const { engine } = get();
    const result = engine.paginate(layout.blocks);
    set({
      pages: result.pages,
      totalPages: result.totalPages,
    });
  },

  getPage: (index) => {
    const { pages } = get();
    return pages[index];
  },

  updatePaperSize: (paperSize) => {
    const { engine, config, paginate } = get();
    engine.updateConfig({ paperSize });

    // Sync layout constraints width to match new content width using oriented dims
    const orientedSize = getOrientedSize(paperSize, config.orientation);
    const contentWidth = orientedSize.width - config.margins.left - config.margins.right;
    useLayoutStore.getState().updateConstraints({ width: contentWidth });

    set({ config: engine.getConfig() });

    // Recalculate layout & pagination so the page view reflects the new size
    const doc = useDocumentStore.getState().document;
    useLayoutStore.getState().calculateLayout(doc);
    // Re-read layout after calculateLayout updates the store (Zustand returns new state object)
    const freshLayout = useLayoutStore.getState().layout;
    if (freshLayout) paginate(freshLayout);

    // Mark document as dirty so the save button is enabled
    useDocumentStore.getState().markDirty();
  },

  updateOrientation: (orientation) => {
    const { engine, paginate } = get();
    engine.updateConfig({ orientation });

    // Use oriented dimensions to sync layout constraints
    const newConfig = engine.getConfig();
    const orientedSize = getOrientedSize(newConfig.paperSize, orientation);
    const contentWidth = orientedSize.width - newConfig.margins.left - newConfig.margins.right;
    useLayoutStore.getState().updateConstraints({ width: contentWidth });

    set({ config: engine.getConfig() });

    // Recalculate layout & pagination so the page view reflects the new orientation
    const doc = useDocumentStore.getState().document;
    useLayoutStore.getState().calculateLayout(doc);
    // Re-read layout after calculateLayout updates the store (Zustand returns new state object)
    const freshLayout = useLayoutStore.getState().layout;
    if (freshLayout) paginate(freshLayout);

    // Mark document as dirty so the save button is enabled
    useDocumentStore.getState().markDirty();
  },

  updateMargins: (margins) => {
    const { engine, config, paginate } = get();
    // Clamp negative values to 0
    const clamped = { ...margins };
    for (const key of Object.keys(clamped) as (keyof Margins)[]) {
      if (clamped[key] !== undefined && clamped[key]! < 0) {
        clamped[key] = 0;
      }
    }
    engine.updateConfig({
      margins: { ...config.margins, ...clamped },
    });
    // Re-sync width when margins change
    const newConfig = engine.getConfig();
    const orientedSize = getOrientedSize(newConfig.paperSize, newConfig.orientation);
    const contentWidth = orientedSize.width - newConfig.margins.left - newConfig.margins.right;
    useLayoutStore.getState().updateConstraints({ width: contentWidth });
    set({ config: newConfig });

    // Recalculate layout & pagination so the page view reflects the new margins
    const doc = useDocumentStore.getState().document;
    useLayoutStore.getState().calculateLayout(doc);
    // Re-read layout after calculateLayout updates the store (Zustand returns new state object)
    const freshLayout = useLayoutStore.getState().layout;
    if (freshLayout) paginate(freshLayout);

    // Mark document as dirty so the save button is enabled
    useDocumentStore.getState().markDirty();
  },

  updateHeaderFooter: (hfConfig) => {
    const { engine, config, paginate } = get();
    engine.updateConfig({
      headerFooter: {
        ...config.headerFooter,
        ...hfConfig,
      },
    });
    set({ config: engine.getConfig() });

    // Recalculate layout & pagination so the page view reflects the new header/footer areas
    const doc = useDocumentStore.getState().document;
    useLayoutStore.getState().calculateLayout(doc);
    // Re-read layout after calculateLayout updates the store (Zustand returns new state object)
    const freshLayout = useLayoutStore.getState().layout;
    if (freshLayout) paginate(freshLayout);

    // Mark document as dirty so the save button is enabled
    useDocumentStore.getState().markDirty();
  },

  updatePageNumberPosition: (position) => {
    const { engine, config, paginate } = get();
    engine.updateConfig({
      headerFooter: {
        ...config.headerFooter,
        pageNumberPosition: position,
      },
    });
    set({ config: engine.getConfig() });

    // Recalculate pagination to reflect the new page number position
    const doc = useDocumentStore.getState().document;
    useLayoutStore.getState().calculateLayout(doc);
    const freshLayout = useLayoutStore.getState().layout;
    if (freshLayout) paginate(freshLayout);

    // Mark document as dirty so the save button is enabled
    useDocumentStore.getState().markDirty();
  },
}));
