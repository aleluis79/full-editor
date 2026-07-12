// ============================================================
// Layout Engine
// ============================================================

import type {
  DocumentRoot,
  Paragraph,
  Heading,
  Image,
  Table,
  TableCell,
  TextRun,
  BlockNode,
} from '../types';
import type {
  LayoutConstraints,
  BlockLayout,
  DocumentLayout,
  LayoutLine,
  PositionedRun,
} from './types';
import { measureText, splitIntoWords } from './measure';
import { getBlockNodes } from '../document';

/** Default layout constraints */
export const DEFAULT_CONSTRAINTS: LayoutConstraints = {
  width: 602, // 794 - 96*2 (A4 with 1 inch margins at 96dpi)
  height: Infinity,
  fontFamily: 'Georgia',
  fontSize: 16,
  lineHeight: 1.5,
  marginTop: 0,
  marginBottom: 0,
  marginLeft: 0,
  marginRight: 0,
  paddingTop: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  paddingRight: 0,
};

/**
 * Layout Engine — calculates geometry for document blocks
 */
export class LayoutEngine {
  private constraints: LayoutConstraints;
  private blockCache: Map<string, BlockLayout> = new Map();

  constructor(constraints: Partial<LayoutConstraints> = {}) {
    this.constraints = { ...DEFAULT_CONSTRAINTS, ...constraints };
  }

  /**
   * Update layout constraints
   */
  updateConstraints(constraints: Partial<LayoutConstraints>): void {
    this.constraints = { ...this.constraints, ...constraints };
    this.blockCache.clear();
  }

  /**
   * Layout the entire document
   */
  layoutDocument(doc: DocumentRoot): DocumentLayout {
    // Clear cache on every full layout — operations like splitBlock modify
    // block content in place (same blockId, different text). Without this,
    // layoutBlock returns stale cached heights, and subsequent blocks
    // get positioned at wrong Y coordinates (overlapping).
    this.blockCache.clear();

    const blocks = getBlockNodes(doc);
    const result: BlockLayout[] = [];
    let currentY = 0;

    for (const block of blocks) {
      const layout = this.layoutBlock(block, currentY);
      result.push(layout);
      currentY += layout.height + this.constraints.marginBottom;
    }

    return {
      blocks: result,
      totalHeight: currentY,
      totalWidth: this.constraints.width,
    };
  }

  /**
   * Layout a single block
   */
  layoutBlock(block: BlockNode, startY: number): BlockLayout {
    // Check cache
    const cached = this.blockCache.get(block.id);
    if (cached && cached.y === startY) {
      return cached;
    }

    let layout: BlockLayout;

    switch (block.type) {
      case 'paragraph':
        layout = this.layoutParagraph(block as Paragraph, startY);
        break;
      case 'heading':
        layout = this.layoutHeading(block as Heading, startY);
        break;
      case 'image':
        layout = this.layoutImage(block as Image, startY);
        break;
      case 'table':
        layout = this.layoutTable(block as Table, startY);
        break;
      case 'horizontalRule':
        layout = this.layoutHorizontalRule(block, startY);
        break;
      case 'list':
      case 'listItem':
      case 'blockquote':
        // Container blocks — their children are laid out individually by
        // getBlockNodes. Skip them to avoid treating ListItem children as
        // TextRuns (which crashes with "can't access Symbol.iterator").
        layout = {
          blockId: block.id,
          blockType: block.type,
          lines: [],
          width: this.constraints.width,
          height: 0,
          y: startY,
          x: this.constraints.marginLeft,
        };
        break;
      default:
        // For other block types, use a simple paragraph layout
        layout = this.layoutParagraph(block as unknown as Paragraph, startY);
    }

    this.blockCache.set(block.id, layout);
    return layout;
  }

  /**
   * Invalidate cache for a block
   */
  invalidateBlock(blockId: string): void {
    this.blockCache.delete(blockId);
  }

  /**
   * Layout a paragraph
   */
  private layoutParagraph(paragraph: Paragraph, startY: number): BlockLayout {
    const runs = paragraph.children ?? [];
    const lines = this.layoutTextRuns(runs, this.constraints);
    const minHeight = this.constraints.fontSize * this.constraints.lineHeight;
    const totalHeight = Math.max(
      minHeight,
      lines.reduce((sum, line) => sum + line.height, 0)
    );

    return {
      blockId: paragraph.id,
      blockType: 'paragraph',
      lines,
      width: this.constraints.width,
      height: totalHeight,
      y: startY,
      x: 0,
    };
  }

  /**
   * Layout a heading
   */
  private layoutHeading(heading: Heading, startY: number): BlockLayout {
    const fontSize = this.getHeadingFontSize(heading.level);
    const headingConstraints = {
      ...this.constraints,
      fontSize,
      lineHeight: 1.2,
    };

    const runs = heading.children ?? [];
    const lines = this.layoutTextRuns(runs, headingConstraints);
    const totalHeight = lines.reduce((sum, line) => sum + line.height, 0);

    return {
      blockId: heading.id,
      blockType: 'heading',
      lines,
      width: this.constraints.width,
      height: totalHeight,
      y: startY,
      x: 0,
    };
  }

  /**
   * Layout a horizontal rule
   */
  private layoutHorizontalRule(block: BlockNode, startY: number): BlockLayout {
    return {
      blockId: block.id,
      blockType: 'horizontalRule',
      lines: [],
      width: this.constraints.width,
      height: 24, // Fixed height for HR
      y: startY,
      x: 0,
    };
  }

  /**
   * Layout an image
   */
  private layoutImage(image: Image, startY: number): BlockLayout {
    // Constrain image width to available width
    const maxWidth = this.constraints.width;
    const scale = Math.min(1, maxWidth / image.width);
    const width = image.width * scale;
    const height = image.height * scale;

    return {
      blockId: image.id,
      blockType: 'image',
      lines: [],
      width,
      height,
      y: startY,
      x: 0,
    };
  }

  /**
   * Layout a table
   */
  private layoutTable(table: Table, startY: number): BlockLayout {
    const { rows, columnWidths } = table;

    // Calculate total table width
    const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0);

    // Calculate row heights (based on content)
    const rowHeights: number[] = [];
    for (const row of rows) {
      let maxHeight = 20; // Minimum row height
      for (const cell of row.cells) {
        if (cell.colSpan === 0) continue; // Skip merged cells
        const cellHeight = this.layoutTableCell(cell).height;
        maxHeight = Math.max(maxHeight, cellHeight);
      }
      rowHeights.push(maxHeight);
    }

    const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0);

    return {
      blockId: table.id,
      blockType: 'table',
      lines: [],
      width: totalWidth,
      height: totalHeight,
      y: startY,
      x: 0,
    };
  }

  /**
   * Layout a table cell
   */
  private layoutTableCell(cell: TableCell): { width: number; height: number } {
    const cellWidth = 200; // Default cell width
    let totalHeight = 0;

    for (const paragraph of cell.children) {
      const lines = this.layoutTextRuns(paragraph.children, this.constraints);
      const paragraphHeight = lines.reduce((sum, line) => sum + line.height, 0);
      totalHeight += paragraphHeight;
    }

    return {
      width: cellWidth,
      height: Math.max(20, totalHeight + 16), // Add padding
    };
  }

  /**
   * Layout text runs into lines with word wrapping
   */
  private layoutTextRuns(
    runs: TextRun[],
    constraints: LayoutConstraints
  ): LayoutLine[] {
    if (!runs || runs.length === 0) {
      return [];
    }

    const lines: LayoutLine[] = [];
    let currentLine: PositionedRun[] = [];
    let currentLineWidth = 0;
    let currentLineHeight = constraints.fontSize * constraints.lineHeight;
    let lineY = 0;

    for (const run of runs) {
      const words = splitIntoWords(run.content);

      for (const word of words) {
        // Handle newlines
        if (word === '\n') {
          // Finish current line
          if (currentLine.length > 0) {
            lines.push({
              runs: currentLine,
              width: currentLineWidth,
              height: currentLineHeight,
              y: lineY,
              baseline: currentLineHeight * 0.8,
            });
            lineY += currentLineHeight;
            currentLine = [];
            currentLineWidth = 0;
          }
          continue;
        }

        const wordWidth = measureText(
          word,
          constraints.fontFamily,
          constraints.fontSize,
          run.marks.includes('bold'),
          run.marks.includes('italic')
        ).width;

        // Check if word fits on current line
        if (currentLineWidth + wordWidth > constraints.width && currentLine.length > 0) {
          // Finish current line
          lines.push({
            runs: currentLine,
            width: currentLineWidth,
            height: currentLineHeight,
            y: lineY,
            baseline: currentLineHeight * 0.8,
          });
          lineY += currentLineHeight;
          currentLine = [];
          currentLineWidth = 0;
        }

        // Add word to current line
        const runX = currentLineWidth;
        currentLine.push({
          text: word,
          x: runX,
          y: 0, // Relative to line
          width: wordWidth,
          height: currentLineHeight,
          fontFamily: constraints.fontFamily,
          fontSize: constraints.fontSize,
          bold: run.marks.includes('bold'),
          italic: run.marks.includes('italic'),
          underline: run.marks.includes('underline'),
          strikethrough: run.marks.includes('strikethrough'),
          color: run.attrs?.color ?? '#000000',
          marks: run.marks,
          attrs: run.attrs,
        });
        currentLineWidth += wordWidth;
      }
    }

    // Finish last line
    if (currentLine.length > 0) {
      lines.push({
        runs: currentLine,
        width: currentLineWidth,
        height: currentLineHeight,
        y: lineY,
        baseline: currentLineHeight * 0.8,
      });
    }

    return lines;
  }

  /**
   * Get font size for heading level
   */
  private getHeadingFontSize(level: number): number {
    switch (level) {
      case 1: return 32;
      case 2: return 24;
      case 3: return 20;
      case 4: return 18;
      case 5: return 16;
      case 6: return 14;
      default: return 16;
    }
  }
}
