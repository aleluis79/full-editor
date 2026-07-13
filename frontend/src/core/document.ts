import type {
  DocumentRoot,
  Paragraph,
  Heading,
  Section,
  List,
  ListItem,
  Blockquote,
  HorizontalRule,
  Image,
  Table,
  TableRow,
  TableCell,
  TextRun,
  BlockNode,
  NodeId,
  MarkType,
  StyleAttrs,
} from './types';
import { hasChildren } from './types';

// ============================================================
// ID Generation
// ============================================================

let counter = 0;

/** Generate a unique node ID */
export function createId(): NodeId {
  return `node-${Date.now()}-${++counter}`;
}

/** Deep clone a document (for immutable updates) */
export function cloneDocument(doc: DocumentRoot): DocumentRoot {
  return JSON.parse(JSON.stringify(doc));
}

// ============================================================
// Node Constructors
// ============================================================

/** Create a text run */
export function createTextRun(
  content: string,
  marks: MarkType[] = []
): TextRun {
  return {
    id: createId(),
    type: 'text',
    content,
    marks,
  };
}

/** Create a paragraph with optional initial text */
export function createParagraph(text?: string): Paragraph {
  const children = text
    ? [createTextRun(text)]
    : [createTextRun('')];

  return {
    id: createId(),
    type: 'paragraph',
    children,
  };
}

/** Create a heading */
export function createHeading(
  level: 1 | 2 | 3 | 4 | 5 | 6,
  text?: string
): Heading {
  return {
    id: createId(),
    type: 'heading',
    level,
    children: [createTextRun(text ?? '')],
  };
}

/** Create a section */
export function createSection(children: BlockNode[] = []): Section {
  return {
    id: createId(),
    type: 'section',
    children,
  };
}

/** Create a list (ordered or unordered) */
export function createList(ordered: boolean = false, items?: ListItem[]): List {
  return {
    id: createId(),
    type: 'list',
    ordered,
    children: items ?? [createListItem()],
  };
}

/** Create a list item */
export function createListItem(children?: (Paragraph | List)[]): ListItem {
  return {
    id: createId(),
    type: 'listItem',
    children: children ?? [createParagraph()],
  };
}

/** Create a blockquote */
export function createBlockquote(children?: Paragraph[]): Blockquote {
  return {
    id: createId(),
    type: 'blockquote',
    children: children ?? [createParagraph()],
  };
}

/** Create a horizontal rule */
export function createHorizontalRule(): HorizontalRule {
  return {
    id: createId(),
    type: 'horizontalRule',
  };
}

/** Create an image */
export function createImage(
  src: string,
  alt: string = '',
  width: number = 300,
  height: number = 200,
  inline: boolean = false
): Image {
  return {
    id: createId(),
    type: 'image',
    src,
    alt,
    width,
    height,
    inline,
  };
}

/** Create a table cell */
export function createTableCell(): TableCell {
  return {
    id: createId(),
    type: 'tableCell',
    children: [createParagraph()],
    colSpan: 1,
    rowSpan: 1,
  };
}

/** Create a table row */
export function createTableRow(cols: number = 3): TableRow {
  const cells: TableCell[] = [];
  for (let i = 0; i < cols; i++) {
    cells.push(createTableCell());
  }
  return {
    id: createId(),
    type: 'tableRow',
    cells,
  };
}

/** Create a table */
export function createTable(rows: number = 3, cols: number = 3): Table {
  const tableRows: TableRow[] = [];
  for (let i = 0; i < rows; i++) {
    tableRows.push(createTableRow(cols));
  }

  // Default column widths: equal distribution
  const defaultColWidth = Math.floor(624 / cols); // 624 = content width
  const columnWidths: number[] = [];
  for (let i = 0; i < cols; i++) {
    columnWidths.push(defaultColWidth);
  }

  return {
    id: createId(),
    type: 'table',
    rows: tableRows,
    columnWidths,
  };
}

/** Create the root document */
export function createDocument(children: BlockNode[] = []): DocumentRoot {
  return {
    id: createId(),
    type: 'document',
    children: children.length > 0 ? children : [createParagraph()],
  };
}

// ============================================================
// Document Traversal
// ============================================================

/** Get all block nodes in document order (includes table internals for operations) */
export function getBlockNodes(doc: DocumentRoot): BlockNode[] {
  const result: BlockNode[] = [];

  function walk(node: { children: BlockNode[] }) {
    for (const child of node.children) {
      if ((child as { type: string }).type === 'text') continue;

      result.push(child);

      if (child.type === 'table') {
        const table = child as unknown as Table;
        for (const row of table.rows) {
          result.push(row as unknown as BlockNode);
          for (const cell of row.cells) {
            result.push(cell as unknown as BlockNode);
            if (hasChildren(cell)) {
              walk(cell as unknown as { children: BlockNode[] });
            }
          }
        }
        continue;
      }

      if (hasChildren(child)) {
        walk(child as { children: BlockNode[] });
      }
    }
  }

  walk(doc);
  return result;
}

/** Get blocks for layout — skips table internals to avoid double-counting heights. */
export function getLayoutBlocks(doc: DocumentRoot): BlockNode[] {
  const result: BlockNode[] = [];

  function walk(node: { children: BlockNode[] }) {
    for (const child of node.children) {
      if ((child as { type: string }).type === 'text') continue;
      result.push(child);
      if (child.type === 'table') continue; // table handles its own layout
      if (hasChildren(child)) {
        walk(child as { children: BlockNode[] });
      }
    }
  }

  walk(doc);
  return result;
}

/** Find a node by ID */
export function findNode(
  doc: DocumentRoot,
  id: NodeId
): BlockNode | TextRun | null {
  if (doc.id === id) return null; // Don't return doc itself as BlockNode

  for (const child of doc.children) {
    if (child.id === id) return child;

    if (hasChildren(child)) {
      const found = findNodeInChildren(child, id);
      if (found) return found;
    }

    // Table uses `rows` (not `children`) — traverse into rows → cells
    if (child.type === 'table') {
      const table = child as unknown as Table;
      for (const row of table.rows) {
        if (row.id === id) return row as unknown as BlockNode;
        for (const cell of row.cells) {
          if (cell.id === id) return cell as unknown as BlockNode;
          if (hasChildren(cell)) {
            const found = findNodeInChildren(cell as unknown as { children: BlockNode[] }, id);
            if (found) return found;
          }
        }
      }
    }
  }

  return null;
}

function findNodeInChildren(
  node: { children: BlockNode[] },
  id: NodeId
): BlockNode | null {
  for (const child of node.children) {
    if (child.id === id) return child;

    if (hasChildren(child)) {
      const found = findNodeInChildren(child as { children: BlockNode[] }, id);
      if (found) return found;
    }

    // Table uses `rows` (not `children`) — traverse into rows → cells → paragraphs
    if (child.type === 'table') {
      const table = child as unknown as Table;
      for (const row of table.rows) {
        if (row.id === id) return row as unknown as BlockNode;
        for (const cell of row.cells) {
          if (cell.id === id) return cell as unknown as BlockNode;
          if (hasChildren(cell)) {
            const found = findNodeInChildren(cell as unknown as { children: BlockNode[] }, id);
            if (found) return found;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Find the parent list and item index for a block nested inside a list.
 * Returns null if the block is not inside any list.
 */
export function findListContext(
  doc: DocumentRoot,
  blockId: NodeId
): { list: List; listItem: ListItem; itemIndex: number } | null {
  for (const child of doc.children) {
    if (child.type === 'list') {
      const list = child as List;
      for (let i = 0; i < list.children.length; i++) {
        const item = list.children[i];
        if (item.id === blockId || item.children.some((c) => c.id === blockId)) {
          return { list, listItem: item, itemIndex: i };
        }
        // Check nested lists
        for (const nestedChild of item.children) {
          if (nestedChild.type === 'list') {
            const nestedList = nestedChild as List;
            for (let j = 0; j < nestedList.children.length; j++) {
              const nestedItem = nestedList.children[j];
              if (nestedItem.children.some((c) => c.id === blockId)) {
                return { list: nestedList, listItem: nestedItem, itemIndex: j };
              }
            }
          }
        }
      }
    }
  }
  return null;
}

/** Get the parent of a node */
export function getParent(
  doc: DocumentRoot,
  id: NodeId
): BlockNode | DocumentRoot | null {
  for (const child of doc.children) {
    if (child.id === id) return doc;
    if (hasChildren(child)) {
      const found = findParentInChildren(child as { children: BlockNode[] }, id);
      if (found) return found as BlockNode | DocumentRoot;
    }
  }
  return null;
}

function findParentInChildren(
  node: { children: BlockNode[] },
  id: NodeId
): { children: BlockNode[] } | null {
  for (const child of node.children) {
    if (child.id === id) return node;

    if (hasChildren(child)) {
      const found = findParentInChildren(child as { children: BlockNode[] }, id);
      if (found) return found;
    }

    // Table uses `rows` → `cells` (not `children`) — traverse into them
    if (child.type === 'table') {
      const table = child as unknown as Table;
      for (const row of table.rows) {
        if (row.id === id) return { children: table.rows as unknown as BlockNode[] };
        for (const cell of row.cells) {
          if (cell.id === id) return { children: row.cells as unknown as BlockNode[] };
          if (hasChildren(cell)) {
            const found = findParentInChildren(cell as unknown as { children: BlockNode[] }, id);
            if (found) return found;
          }
        }
      }
    }
  }

  return null;
}

/** Get the index of a child within its parent */
export function getChildIndex(
  doc: DocumentRoot,
  id: NodeId
): { parent: { children: BlockNode[] }; index: number } | null {
  const parent = getParent(doc, id);
  if (!parent || !hasChildren(parent)) return null;

  const index = parent.children.findIndex((c) => c.id === id);

  return index >= 0 ? { parent, index } : null;
}

/** Get text content of a block (concatenation of all text runs) */
export function getBlockText(block: Paragraph | Heading): string {
  return block.children.map((r) => r.content).join('');
}

/** Get the previous block in document order */
export function getPreviousBlock(
  doc: DocumentRoot,
  blockId: NodeId
): BlockNode | null {
  const blocks = getBlockNodes(doc);
  const idx = blocks.findIndex((b) => b.id === blockId);
  return idx > 0 ? blocks[idx - 1] : null;
}

/** Get the next block in document order */
export function getNextBlock(
  doc: DocumentRoot,
  blockId: NodeId
): BlockNode | null {
  const blocks = getBlockNodes(doc);
  const idx = blocks.findIndex((b) => b.id === blockId);
  return idx >= 0 && idx < blocks.length - 1 ? blocks[idx + 1] : null;
}

/**
 * Get the marks and style attrs of the TextRun at the given offset
 * within a text block. Used to determine what styles are active at
 * the cursor position for toolbar reflection and sticky marks.
 */
/**
 * Get the marks and style attrs of the TextRun at the given offset
 * within a text block. Uses strict less-than (<) so an offset exactly
 * at the boundary between two runs returns the NEXT run — matching
 * the convention in findRunAtOffset (operations.ts) where the cursor
 * belongs to the following character.
 */
export function getRunStylesAtOffset(
  block: Paragraph | Heading,
  offset: number
): { marks: MarkType[]; attrs?: StyleAttrs } | null {
  if (block.children.length === 0) return null;

  let accumulated = 0;
  for (const run of block.children) {
    // Strict less-than: offset at a boundary falls through to the next
    // run, so the cursor at the start of a styled run sees that style.
    if (offset < accumulated + run.content.length) {
      return {
        marks: [...run.marks],
        attrs: run.attrs ? { ...run.attrs } : undefined,
      };
    }
    accumulated += run.content.length;
  }

  // Past all text or at the very end — return the last run's styles
  if (block.children.length > 0) {
    const lastRun = block.children[block.children.length - 1];
    return {
      marks: [...lastRun.marks],
      attrs: lastRun.attrs ? { ...lastRun.attrs } : undefined,
    };
  }

  return null;
}

/**
 * Find the table cell that contains the given paragraph nodeId.
 * Returns the cell, its parent row, the row/column indices, and
 * the paragraph index within the cell.
 */
export function findTableCellContext(
  doc: DocumentRoot,
  nodeId: string,
): {
  table: Table;
  row: TableRow;
  cell: TableCell;
  rowIndex: number;
  colIndex: number;
  paraIndex: number;
} | null {
  for (const child of doc.children) {
    if (child.type === 'table') {
      const table = child as unknown as Table;
      for (let ri = 0; ri < table.rows.length; ri++) {
        const row = table.rows[ri];
        for (let ci = 0; ci < row.cells.length; ci++) {
          const cell = row.cells[ci];
          const pi = cell.children.findIndex((p) => p.id === nodeId);
          if (pi >= 0) {
            return { table, row, cell, rowIndex: ri, colIndex: ci, paraIndex: pi };
          }
        }
      }
    }
  }
  return null;
}
