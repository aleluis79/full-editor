# Layout Engine

## Core Principle

The Layout Engine calculates geometry. It NEVER renders HTML. It NEVER knows about pages.

## Unit of Work: Block-Level

Each block (paragraph, heading, table, image) is laid out independently.

```typescript
interface LayoutResult {
  blockId: string;
  lines: Line[];
  totalHeight: number;
}

interface Line {
  runs: PositionedRun[];
  width: number;
  height: number;
  y: number;  // relative to block
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
  color: string;
}
```

## Strategy Pattern by Node Type

```typescript
interface LayoutStrategy {
  measure(node: DocumentNode, constraints: Constraints): LayoutResult;
}

const strategies = new Map<string, LayoutStrategy>();
strategies.set('paragraph', new ParagraphLayout());
strategies.set('heading', new HeadingLayout());
strategies.set('table', new TableLayout());
strategies.set('image', new ImageLayout());
strategies.set('list', new ListLayout());
```

## Invalidation Tree

When content changes:
1. Mark affected block as dirty
2. Recalculate only that block
3. If height changed → update Y offsets of all subsequent blocks (no re-measurement)
4. If width changed (resize) → re-layout from that point forward

Dirty flags per block. Only process dirty blocks.

## Text Measurement

OffscreenCanvas in Web Worker for non-blocking measurement.

```typescript
// In Web Worker
const canvas = new OffscreenCanvas(1, 1);
const ctx = canvas.getContext('2d');

function measureText(text: string, font: string): Metrics {
  ctx.font = font;
  return ctx.measureText(text);
}
```

## Constraints

```typescript
interface Constraints {
  width: number;     // available width (page width - margins - indentation)
  height: number;    // max height (Infinity for no limit)
}
```

## Layout Flow

```
ParagraphLayout.measure(paragraph, constraints)
  → For each run in paragraph.children:
    - Measure text with OffscreenCanvas
    - Accumulate width
    - If width > constraints.width → break line
  → Return lines with positions
```
