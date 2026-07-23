// ============================================================
// Pagination Types
// ============================================================

import type { BlockLayout } from '../layout/types';
import type { TextRun } from '../types';

/** Paper size in points (1/72 inch) */
export interface PaperSize {
  name: string;
  width: number;
  height: number;
}

/** Margins in points */
export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Header/Footer content */
export interface HeaderFooterContent {
  /** Text runs for the header/footer */
  runs: TextRun[];
  /** Height in points */
  height: number;
  /** Block-level attributes (alignment, etc.) */
  attrs?: {
    textAlign?: 'left' | 'center' | 'right';
  };
}

/** Page number position */
export type PageNumberPosition = 'bottom-center' | 'bottom-left' | 'bottom-right' | 'top-center' | 'top-left' | 'top-right';

/** Header/Footer configuration */
export interface HeaderFooterConfig {
  /** Enable headers */
  enabled: boolean;
  /** First page different (no header/footer on first page) */
  firstPageDifferent: boolean;
  /** Header content */
  header: HeaderFooterContent;
  /** Footer content */
  footer: HeaderFooterContent;
  /** Page number position */
  pageNumberPosition: PageNumberPosition;
}

/** A single page in the document */
export interface Page {
  index: number;
  width: number;
  height: number;
  contentArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  headerArea?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  footerArea?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  blocks: BlockLayout[];
  pageNumber: number;
}

/** Pagination configuration */
export interface PaginationConfig {
  paperSize: PaperSize;
  orientation: 'portrait' | 'landscape';
  margins: Margins;
  headerFooter: HeaderFooterConfig;
}

/** Pagination result */
export interface PaginationResult {
  pages: Page[];
  totalPages: number;
}
