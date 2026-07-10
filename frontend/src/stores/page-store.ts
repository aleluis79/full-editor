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
}

export const usePageStore = create<PageState>((set, get) => ({
  engine: new PaginationEngine(),
  pages: [],
  totalPages: 0,
  config: {
    paperSize: { name: 'A4', width: 595.28, height: 841.89 },
    margins: { top: 72, right: 72, bottom: 72, left: 72 },
    headerFooter: {
      enabled: false,
      firstPageDifferent: true,
      header: { runs: [], height: 36 },
      footer: { runs: [], height: 36 },
      pageNumberPosition: 'bottom-center',
    },
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
    const { engine } = get();
    engine.updateConfig({ paperSize });
    set({ config: engine.getConfig() });
  },

  updateMargins: (margins) => {
    const { engine, config } = get();
    engine.updateConfig({
      margins: { ...config.margins, ...margins },
    });
    set({ config: engine.getConfig() });
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
