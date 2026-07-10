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
import { PaginationEngine } from '../core/pagination/engine';
import { useLayoutStore } from './layout-store';

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

  // Actions
  paginate: (layout: DocumentLayout) => void;
  getPage: (index: number) => Page | undefined;
  updatePaperSize: (paperSize: PaperSize) => void;
  updateMargins: (margins: Partial<Margins>) => void;
  updateHeaderFooter: (config: Partial<HeaderFooterConfig>) => void;
  updatePageNumberPosition: (position: PageNumberPosition) => void;
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
  config: {
    paperSize: { ...DEFAULT_PAPER },
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
    const { engine, config } = get();
    engine.updateConfig({ paperSize });

    // Sync layout constraints width to match new content width
    const contentWidth = paperSize.width - config.margins.left - config.margins.right;
    useLayoutStore.getState().updateConstraints({ width: contentWidth });

    set({ config: engine.getConfig() });
  },

  updateMargins: (margins) => {
    const { engine, config } = get();
    engine.updateConfig({
      margins: { ...config.margins, ...margins },
    });
    // Re-sync width when margins change
    const newConfig = engine.getConfig();
    const contentWidth = newConfig.paperSize.width - newConfig.margins.left - newConfig.margins.right;
    useLayoutStore.getState().updateConstraints({ width: contentWidth });
    set({ config: newConfig });
  },

  updateHeaderFooter: (hfConfig) => {
    const { engine, config } = get();
    engine.updateConfig({
      headerFooter: {
        ...config.headerFooter,
        ...hfConfig,
      },
    });
    set({ config: engine.getConfig() });
  },

  updatePageNumberPosition: (position) => {
    const { engine, config } = get();
    engine.updateConfig({
      headerFooter: {
        ...config.headerFooter,
        pageNumberPosition: position,
      },
    });
    set({ config: engine.getConfig() });
  },
}));
