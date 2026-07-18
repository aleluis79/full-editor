// ============================================================
// Pagination Engine
// ============================================================

import type { BlockLayout } from '../layout/types';
import type {
  Page,
  PaginationConfig,
  PaginationResult,
  HeaderFooterConfig,
} from './types';
import { A4, getOrientedSize } from './paper';

/** Default margins (1 inch = 72 points) */
export const DEFAULT_MARGINS = {
  top: 72,
  right: 72,
  bottom: 72,
  left: 72,
};

/** Default header/footer config */
const DEFAULT_HEADER_FOOTER: HeaderFooterConfig = {
  enabled: false,
  firstPageDifferent: true,
  header: {
    runs: [],
    height: 36,
  },
  footer: {
    runs: [],
    height: 36,
  },
  pageNumberPosition: 'bottom-center',
};

/** Default pagination config */
export const DEFAULT_PAGINATION_CONFIG: PaginationConfig = {
  paperSize: A4,
  orientation: 'portrait',
  margins: DEFAULT_MARGINS,
  headerFooter: DEFAULT_HEADER_FOOTER,
};

/**
 * Pagination Engine — distributes blocks across pages
 */
export class PaginationEngine {
  private config: PaginationConfig;

  constructor(config: Partial<PaginationConfig> = {}) {
    this.config = {
      ...DEFAULT_PAGINATION_CONFIG,
      ...config,
      headerFooter: {
        ...DEFAULT_HEADER_FOOTER,
        ...config.headerFooter,
      },
    };
  }

  /**
   * Update pagination config
   */
  updateConfig(config: Partial<PaginationConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      headerFooter: {
        ...this.config.headerFooter,
        ...config.headerFooter,
      },
    };
  }

  /**
   * Get current config
   */
  getConfig(): PaginationConfig {
    return { ...this.config };
  }

  /**
   * Paginate blocks into pages
   */
  paginate(blocks: BlockLayout[]): PaginationResult {
    const { paperSize, orientation, margins, headerFooter } = this.config;
    const orientedSize = getOrientedSize(paperSize, orientation);

    // Calculate content area considering headers/footers
    const headerHeight = headerFooter.enabled ? headerFooter.header.height : 0;
    const footerHeight = headerFooter.enabled ? headerFooter.footer.height : 0;

    const contentWidth = orientedSize.width - margins.left - margins.right;
    const contentStartY = margins.top + headerHeight;
    const contentEndY = orientedSize.height - margins.bottom - footerHeight;
    const contentHeight = contentEndY - contentStartY;

    const pages: Page[] = [];
    let currentPageBlocks: BlockLayout[] = [];
    let currentPageHeight = 0;
    let pageIndex = 0;

    for (const block of blocks) {
      const blockHeight = block.height + this.getBlockMargin(block);

      // Check if block fits on current page
      if (currentPageHeight + blockHeight > contentHeight && currentPageBlocks.length > 0) {
        // Create new page with current blocks
        pages.push(this.createPage(
          pageIndex,
          orientedSize,
          margins,
          contentWidth,
          contentStartY,
          headerHeight,
          footerHeight,
          currentPageBlocks,
          pageIndex + 1
        ));
        pageIndex++;
        currentPageBlocks = [];
        currentPageHeight = 0;
      }

      // Add block to current page
      currentPageBlocks.push({
        ...block,
        y: currentPageHeight,
      });
      currentPageHeight += blockHeight;
    }

    // Create final page if there are remaining blocks
    if (currentPageBlocks.length > 0) {
      pages.push(this.createPage(
        pageIndex,
        orientedSize,
        margins,
        contentWidth,
        contentStartY,
        headerHeight,
        footerHeight,
        currentPageBlocks,
        pageIndex + 1
      ));
    }

    // If no pages, create one empty page
    if (pages.length === 0) {
      pages.push(this.createPage(
        0,
        orientedSize,
        margins,
        contentWidth,
        contentStartY,
        headerHeight,
        footerHeight,
        [],
        1
      ));
    }

    return {
      pages,
      totalPages: pages.length,
    };
  }

  /**
   * Create a page with blocks
   */
  private createPage(
    index: number,
    paperSize: { width: number; height: number },
    margins: { top: number; right: number; bottom: number; left: number },
    contentWidth: number,
    contentStartY: number,
    headerHeight: number,
    footerHeight: number,
    blocks: BlockLayout[],
    pageNumber: number
  ): Page {
    const hasHeader = headerHeight > 0;
    const hasFooter = footerHeight > 0;

    return {
      index,
      width: paperSize.width,
      height: paperSize.height,
      contentArea: {
        x: margins.left,
        y: contentStartY,
        width: contentWidth,
        height: paperSize.height - contentStartY - margins.bottom - footerHeight,
      },
      headerArea: hasHeader ? {
        x: margins.left,
        y: margins.top,
        width: contentWidth,
        height: headerHeight,
      } : undefined,
      footerArea: hasFooter ? {
        x: margins.left,
        y: paperSize.height - margins.bottom - footerHeight,
        width: contentWidth,
        height: footerHeight,
      } : undefined,
      blocks,
      pageNumber,
    };
  }

  /**
   * Get block margin (top + bottom) — matches layout engine's marginBottom.
   */
  private getBlockMargin(_block: BlockLayout): number {
    return 0;
  }
}
