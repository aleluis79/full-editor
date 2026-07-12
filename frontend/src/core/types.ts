// ============================================================
// Document Model Types
// ============================================================

/** Unique identifier for any node in the document */
export type NodeId = string;

/** Mark types that can be applied to text runs (boolean toggles) */
export type MarkType = 'bold' | 'italic' | 'underline' | 'strikethrough';

/** Text alignment for blocks */
export type TextAlign = 'left' | 'center' | 'right' | 'justify';

/** Style attributes for text runs (key-value pairs) */
export interface StyleAttrs {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
}

/** Block-level style attributes */
export interface BlockAttrs {
  textAlign?: TextAlign;
}

/** Block types */
export type BlockType =
  | 'document'
  | 'section'
  | 'paragraph'
  | 'heading'
  | 'text'
  | 'list'
  | 'listItem'
  | 'blockquote'
  | 'horizontalRule'
  | 'image'
  | 'table'
  | 'tableRow'
  | 'tableCell';

/** Base interface for all document nodes */
export interface BaseNode {
  id: NodeId;
  type: BlockType;
}

/** Text run — the atomic unit of inline content */
export interface TextRun extends BaseNode {
  type: 'text';
  content: string;
  marks: MarkType[];
  attrs?: StyleAttrs;
}

/** Paragraph — a block containing inline runs */
export interface Paragraph extends BaseNode {
  type: 'paragraph';
  children: TextRun[];
  attrs?: BlockAttrs;
}

/** Heading — a paragraph with a level */
export interface Heading extends BaseNode {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: TextRun[];
  attrs?: BlockAttrs;
}

/** List — ordered or unordered */
export interface List extends BaseNode {
  type: 'list';
  ordered: boolean;
  children: ListItem[];
}

/** List item — a single item in a list */
export interface ListItem extends BaseNode {
  type: 'listItem';
  children: (Paragraph | List)[]; // Can contain paragraphs or nested lists
}

/** Blockquote — quoted text */
export interface Blockquote extends BaseNode {
  type: 'blockquote';
  children: Paragraph[];
}

/** Horizontal rule — a thematic break */
export interface HorizontalRule extends BaseNode {
  type: 'horizontalRule';
}

/** Image — block or inline image */
export interface Image extends BaseNode {
  type: 'image';
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Inline image sits within text flow, block image takes full width */
  inline: boolean;
}

/** Table cell */
export interface TableCell extends BaseNode {
  type: 'tableCell';
  children: Paragraph[];
  /** Number of columns this cell spans (for merged cells) */
  colSpan: number;
  /** Number of rows this cell spans (for merged cells) */
  rowSpan: number;
}

/** Table row */
export interface TableRow extends BaseNode {
  type: 'tableRow';
  cells: TableCell[];
}

/** Table */
export interface Table extends BaseNode {
  type: 'table';
  rows: TableRow[];
  /** Column widths in pixels */
  columnWidths: number[];
}

/** Section — can contain blocks */
export interface Section extends BaseNode {
  type: 'section';
  children: BlockNode[];
}

/** Document — the root node */
export interface Document extends BaseNode {
  type: 'document';
  children: BlockNode[];
}

/** Union of all block-level nodes */
export type BlockNode =
  | Paragraph
  | Heading
  | Section
  | List
  | ListItem
  | Blockquote
  | HorizontalRule
  | Image
  | Table
  | TableRow
  | TableCell;

/** Union of all inline nodes */
export type InlineNode = TextRun;

/** The complete document tree */
export type DocumentRoot = Document;

/** Node that has children (for traversal) */
export type ParentNode = BlockNode | DocumentRoot;

/** Check if a node has children and return it with proper typing */
export function hasChildren(node: unknown): node is { children: BlockNode[] } {
  return (
    node !== null &&
    typeof node === 'object' &&
    'children' in node &&
    Array.isArray((node as { children: unknown[] }).children)
  );
}

// ============================================================
// Cursor & Selection
// ============================================================

/** Logical position in the document */
export interface LogicalPosition {
  nodeId: NodeId;
  offset: number; // character offset within the node's text content
}

/** Cursor state */
export interface Cursor {
  position: LogicalPosition;
}

/** Selection range (anchor + focus) */
export interface Selection {
  anchor: LogicalPosition;
  focus: LogicalPosition;
}

// ============================================================
// Operations
// ============================================================

/** Diff produced by an operation */
export interface Diff {
  type: 'insert' | 'delete' | 'replace' | 'split' | 'merge';
  path: string[];
  before: unknown;
  after: unknown;
}

/** Base operation type */
export interface BaseOperation {
  type: string;
  blockId: NodeId;
}

/** Insert text operation */
export interface InsertTextOp extends BaseOperation {
  type: 'insertText';
  offset: number;
  text: string;
}

/** Delete text operation */
export interface DeleteTextOp extends BaseOperation {
  type: 'deleteText';
  offset: number;
  text: string; // the text that was deleted (for undo)
}

/** Split block operation */
export interface SplitBlockOp extends BaseOperation {
  type: 'splitBlock';
  offset: number;
  newBlockId: NodeId;
}

/** Merge blocks operation (inverse of split) */
export interface MergeBlocksOp extends BaseOperation {
  type: 'mergeBlocks';
  previousBlockId: NodeId;
  offset: number;
}

/** Toggle mark operation (bold, italic, underline, strikethrough) */
export interface ToggleMarkOp extends BaseOperation {
  type: 'toggleMark';
  mark: MarkType;
  startOffset: number;
  endOffset: number;
}

/** Set style attribute operation (font family, size, color) */
export interface SetStyleOp extends BaseOperation {
  type: 'setStyle';
  key: keyof StyleAttrs;
  value: string | number | undefined;
  startOffset: number;
  endOffset: number;
}

/** Set block-level attributes (alignment, etc.) */
export interface SetBlockAttrsOp extends BaseOperation {
  type: 'setBlockAttrs';
  blockId: NodeId;
  attrs: BlockAttrs;
  prevAttrs: BlockAttrs;
}

/** Insert block operation (after a given block) */
export interface InsertBlockOp extends BaseOperation {
  type: 'insertBlock';
  blockType: 'paragraph' | 'heading' | 'list' | 'blockquote' | 'horizontalRule';
  afterBlockId: NodeId;
  attrs?: Record<string, unknown>;
}

/** Convert block operation (change block type) */
export interface ConvertBlockOp extends BaseOperation {
  type: 'convertBlock';
  fromType: BlockType;
  toType: BlockType;
  attrs?: Record<string, unknown>;
}

/** Delete block operation */
export interface DeleteBlockOp extends BaseOperation {
  type: 'deleteBlock';
  block: BlockNode;
  afterBlockId: NodeId | null;
}

/** Insert image operation */
export interface InsertImageOp extends BaseOperation {
  type: 'insertImage';
  afterBlockId: NodeId;
  src: string;
  alt: string;
  width: number;
  height: number;
  inline: boolean;
}

/** Resize image operation */
export interface ResizeImageOp extends BaseOperation {
  type: 'resizeImage';
  width: number;
  height: number;
}

/** Insert table operation */
export interface InsertTableOp extends BaseOperation {
  type: 'insertTable';
  afterBlockId: NodeId;
  rows: number;
  cols: number;
}

/** Add table row operation */
export interface AddTableRowOp extends BaseOperation {
  type: 'addTableRow';
  tableId: NodeId;
  afterRowIndex: number;
}

/** Add table column operation */
export interface AddTableColumnOp extends BaseOperation {
  type: 'addTableColumn';
  tableId: NodeId;
  afterColumnIndex: number;
}

/** Delete table row operation */
export interface DeleteTableRowOp extends BaseOperation {
  type: 'deleteTableRow';
  tableId: NodeId;
  rowIndex: number;
  deletedRow: TableRow;
}

/** Delete table column operation */
export interface DeleteTableColumnOp extends BaseOperation {
  type: 'deleteTableColumn';
  tableId: NodeId;
  columnIndex: number;
  deletedCells: TableCell[];
}

/** Merge table cells operation */
export interface MergeTableCellsOp extends BaseOperation {
  type: 'mergeTableCells';
  tableId: NodeId;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

/** Union of all operations */
export type Operation =
  | InsertTextOp
  | DeleteTextOp
  | SplitBlockOp
  | MergeBlocksOp
  | ToggleMarkOp
  | SetStyleOp
  | SetBlockAttrsOp
  | InsertBlockOp
  | ConvertBlockOp
  | DeleteBlockOp
  | InsertImageOp
  | ResizeImageOp
  | InsertTableOp
  | AddTableRowOp
  | AddTableColumnOp
  | DeleteTableRowOp
  | DeleteTableColumnOp
  | MergeTableCellsOp;

/** History entry — stores forward and inverse operations */
export interface HistoryEntry {
  id: string;
  timestamp: number;
  forward: Operation[];
  inverse: Operation[];
  description: string;
  /** For complex operations (like deleteSelection) that can't be modeled
   *  as simple operations. When present, undo/redo restore the original
   *  blocks directly instead of applying inverse/forward ops. */
  selectionDelete?: {
    blocks: BlockNode[];  // clone of affected blocks (first to last)
    firstBlockId: NodeId; // ID of the first affected block
    prevBlockId: NodeId | null; // block before the range, null if at start
    anchor: { nodeId: NodeId; offset: number };
    focus: { nodeId: NodeId; offset: number };
  };
  /** Snapshot for convertRangeToList undo — restores original blocks. */
  convertRangeSnapshot?: {
    blocks: BlockNode[];
    atIndex: number;
  };
}

// ============================================================
// Layout (Phase 1: minimal)
// ============================================================

/** Position of cursor on screen */
export interface ScreenPosition {
  x: number;
  y: number;
  height: number;
}
