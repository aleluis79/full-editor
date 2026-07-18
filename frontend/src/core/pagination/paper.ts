// ============================================================
// Paper Sizes (in CSS pixels at 96dpi)
// ============================================================
//
// These match the CSS rendering: 1 inch = 96px
// - A4: 210mm x 297mm → 794 x 1123px
// - Letter: 8.5" x 11" → 816 x 1056px
// - Legal: 8.5" x 14" → 816 x 1344px

import type { PaperSize } from './types';

/**
 * Get effective page dimensions considering orientation.
 * Landscape swaps width and height.
 */
export function getOrientedSize(paperSize: PaperSize, orientation: 'portrait' | 'landscape'): { width: number; height: number } {
  if (orientation === 'landscape') {
    return { width: paperSize.height, height: paperSize.width };
  }
  return { width: paperSize.width, height: paperSize.height };
}

/** A4 — 210mm x 297mm (794 x 1123px at 96dpi) */
export const A4: PaperSize = {
  name: 'A4',
  width: 794,
  height: 1123,
};

/** Letter — 8.5" x 11" */
export const LETTER: PaperSize = {
  name: 'Letter',
  width: 816,
  height: 1056,
};

/** Legal — 8.5" x 14" */
export const LEGAL: PaperSize = {
  name: 'Legal',
  width: 816,
  height: 1344,
};

/** All available paper sizes */
export const PAPER_SIZES: PaperSize[] = [A4, LETTER, LEGAL];

/** Get paper size by name */
export function getPaperSize(name: string): PaperSize {
  return PAPER_SIZES.find((p) => p.name === name) ?? A4;
}
