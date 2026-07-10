// ============================================================
// Layout Types
// ============================================================

import type { MarkType, StyleAttrs } from '../types';

/** Metrics for a single character or text segment */
export interface TextMetrics {
  width: number;
  height: number;
}

/** A positioned run of text within a line */
export interface PositionedRun {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  color: string;
  marks: MarkType[];
  attrs?: StyleAttrs;
}

/** A line of text within a block */
export interface LayoutLine {
  runs: PositionedRun[];
  width: number;
  height: number;
  y: number; // relative to block
  baseline: number;
}

/** Layout result for a single block */
export interface BlockLayout {
  blockId: string;
  blockType: string;
  lines: LayoutLine[];
  width: number;
  height: number;
  y: number; // absolute Y position in document
  x: number; // absolute X position in document
}

/** Layout result for the entire document */
export interface DocumentLayout {
  blocks: BlockLayout[];
  totalHeight: number;
  totalWidth: number;
}

/** Constraints for layout calculation */
export interface LayoutConstraints {
  width: number; // available width
  height: number; // max height (Infinity for no limit)
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  paddingTop: number;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
}
