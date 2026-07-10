/**
 * Layout Engine Web Worker
 * 
 * Runs layout computation off the main thread to avoid blocking UI.
 */

// Import layout engine (we'll need to handle imports differently in workers)
// For now, we'll implement a simplified version here

interface TextMetrics {
  width: number;
  height: number;
}

interface PositionedRun {
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
  marks: string[];
}

interface LayoutLine {
  runs: PositionedRun[];
  width: number;
  height: number;
  y: number;
  baseline: number;
}

interface BlockLayout {
  blockId: string;
  blockType: string;
  lines: LayoutLine[];
  width: number;
  height: number;
  y: number;
  x: number;
}

interface DocumentLayout {
  blocks: BlockLayout[];
  totalHeight: number;
  totalWidth: number;
}

interface LayoutConstraints {
  width: number;
  height: number;
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

// Canvas for text measurement
let measureCanvas: OffscreenCanvas | null = null;
let measureCtx: OffscreenCanvasRenderingContext2D | null = null;

function getMeasureContext(): OffscreenCanvasRenderingContext2D {
  if (!measureCanvas) {
    measureCanvas = new OffscreenCanvas(1, 1);
    measureCtx = measureCanvas.getContext('2d')!;
  }
  return measureCtx!;
}

// Measurement cache
const measurementCache = new Map<string, TextMetrics>();

function measureText(
  text: string,
  fontFamily: string,
  fontSize: number,
  bold: boolean = false,
  italic: boolean = false
): TextMetrics {
  const cacheKey = `${fontFamily}:${fontSize}:${bold}:${italic}:${text}`;
  const cached = measurementCache.get(cacheKey);
  if (cached) return cached;

  const ctx = getMeasureContext();
  const fontStyle = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
  ctx.font = fontStyle;

  const metrics = ctx.measureText(text);
  const height = fontSize * 1.2;

  const result: TextMetrics = {
    width: metrics.width,
    height,
  };

  measurementCache.set(cacheKey, result);
  return result;
}

function splitIntoWords(text: string): string[] {
  const words: string[] = [];
  let current = '';

  for (const char of text) {
    if (char === ' ' || char === '\t') {
      if (current) {
        words.push(current);
        current = '';
      }
      words.push(char);
    } else if (char === '\n') {
      if (current) {
        words.push(current);
        current = '';
      }
      words.push('\n');
    } else {
      current += char;
    }
  }

  if (current) {
    words.push(current);
  }

  return words;
}

function layoutTextRuns(
  runs: Array<{ content: string; marks: string[]; attrs?: Record<string, unknown> }>,
  constraints: LayoutConstraints
): LayoutLine[] {
  const lines: LayoutLine[] = [];
  let currentLine: PositionedRun[] = [];
  let currentLineWidth = 0;
  let currentLineHeight = constraints.fontSize * constraints.lineHeight;
  let lineY = 0;

  for (const run of runs) {
    const words = splitIntoWords(run.content);

    for (const word of words) {
      if (word === '\n') {
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

      if (currentLineWidth + wordWidth > constraints.width && currentLine.length > 0) {
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

      const runX = currentLineWidth;
      currentLine.push({
        text: word,
        x: runX,
        y: 0,
        width: wordWidth,
        height: currentLineHeight,
        fontFamily: constraints.fontFamily,
        fontSize: constraints.fontSize,
        bold: run.marks.includes('bold'),
        italic: run.marks.includes('italic'),
        underline: run.marks.includes('underline'),
        strikethrough: run.marks.includes('strikethrough'),
        color: (run.attrs?.color as string) ?? '#000000',
        marks: run.marks,
      });
      currentLineWidth += wordWidth;
    }
  }

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

function layoutBlock(
  block: { id: string; type: string; children?: Array<{ content: string; marks: string[]; attrs?: Record<string, unknown> }>; level?: number },
  startY: number,
  constraints: LayoutConstraints
): BlockLayout {
  if (block.type === 'paragraph') {
    const lines = layoutTextRuns(block.children ?? [], constraints);
    const totalHeight = lines.reduce((sum, line) => sum + line.height, 0);
    return {
      blockId: block.id,
      blockType: 'paragraph',
      lines,
      width: constraints.width,
      height: totalHeight,
      y: startY,
      x: 0,
    };
  }

  if (block.type === 'heading') {
    const fontSize = block.level === 1 ? 32 : block.level === 2 ? 24 : 20;
    const headingConstraints = { ...constraints, fontSize, lineHeight: 1.2 };
    const lines = layoutTextRuns(block.children ?? [], headingConstraints);
    const totalHeight = lines.reduce((sum, line) => sum + line.height, 0);
    return {
      blockId: block.id,
      blockType: 'heading',
      lines,
      width: constraints.width,
      height: totalHeight,
      y: startY,
      x: 0,
    };
  }

  if (block.type === 'horizontalRule') {
    return {
      blockId: block.id,
      blockType: 'horizontalRule',
      lines: [],
      width: constraints.width,
      height: 24,
      y: startY,
      x: 0,
    };
  }

  if (block.type === 'image') {
    const width = (block as unknown as { width: number }).width ?? 300;
    const height = (block as unknown as { height: number }).height ?? 200;
    const maxWidth = constraints.width;
    const scale = Math.min(1, maxWidth / width);
    return {
      blockId: block.id,
      blockType: 'image',
      lines: [],
      width: width * scale,
      height: height * scale,
      y: startY,
      x: 0,
    };
  }

  // Default: empty block
  return {
    blockId: block.id,
    blockType: block.type,
    lines: [],
    width: constraints.width,
    height: 0,
    y: startY,
    x: 0,
  };
}

// Message handler
self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'layout') {
    const { blocks, constraints } = payload;
    const result: BlockLayout[] = [];
    let currentY = 0;

    for (const block of blocks) {
      const layout = layoutBlock(block, currentY, constraints);
      result.push(layout);
      currentY += layout.height + (constraints.marginBottom ?? 12);
    }

    const documentLayout: DocumentLayout = {
      blocks: result,
      totalHeight: currentY,
      totalWidth: constraints.width,
    };

    self.postMessage({ type: 'layout-result', payload: documentLayout });
  }

  if (type === 'clear-cache') {
    measurementCache.clear();
    self.postMessage({ type: 'cache-cleared' });
  }
};
