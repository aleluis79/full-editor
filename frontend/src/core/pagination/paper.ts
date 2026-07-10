// ============================================================
// Paper Sizes (in points, 1/72 inch)
// ============================================================

import type { PaperSize } from './types';

/** A4 — 210mm x 297mm */
export const A4: PaperSize = {
  name: 'A4',
  width: 595.28, // 210mm * 72/25.4
  height: 841.89, // 297mm * 72/25.4
};

/** Letter — 8.5" x 11" */
export const LETTER: PaperSize = {
  name: 'Letter',
  width: 612, // 8.5 * 72
  height: 792, // 11 * 72
};

/** Legal — 8.5" x 14" */
export const LEGAL: PaperSize = {
  name: 'Legal',
  width: 612, // 8.5 * 72
  height: 1008, // 14 * 72
};

/** All available paper sizes */
export const PAPER_SIZES: PaperSize[] = [A4, LETTER, LEGAL];

/** Get paper size by name */
export function getPaperSize(name: string): PaperSize {
  return PAPER_SIZES.find((p) => p.name === name) ?? A4;
}
