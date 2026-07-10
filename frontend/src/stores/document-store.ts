import { create } from 'zustand';
import type { DocumentRoot, HistoryEntry, NodeId, MarkType, StyleAttrs, BlockType, InsertTextOp, DeleteTextOp, SplitBlockOp, MergeBlocksOp, ToggleMarkOp, SetStyleOp, InsertBlockOp, ConvertBlockOp, InsertImageOp, ResizeImageOp, InsertTableOp, AddTableRowOp, AddTableColumnOp, DeleteTableRowOp, DeleteTableColumnOp, MergeTableCellsOp, Selection, Paragraph, Heading } from '../core/types';
import {
  createDocument,
  createParagraph,
  createTableRow,
  cloneDocument,
  getBlockNodes,
  getBlockText,
  findNode,
} from '../core/document';
import {
  applyInsertText,
  applyDeleteText,
  applySplitBlock,
  applyMergeBlocks,
  applyToggleMark,
  applySetStyle,
  applyInsertBlock,
  applyConvertBlock,
  applyInsertImage,
  applyResizeImage,
  applyInsertTable,
  applyAddTableRow,
  applyAddTableColumn,
  applyDeleteTableRow,
  applyDeleteTableColumn,
  applyMergeTableCells,
  invertOperation,
  applyOperation,
} from '../core/operations';
import { deleteSelection, isSelectionEmpty } from '../core/selection';

// ============================================================
// Batch Configuration
// ============================================================

const BATCH_TIMEOUT_MS = 300; // Max time between keystrokes to batch
const MAX_HISTORY_ENTRIES = 500;

// ============================================================
// Document Store
// ============================================================

interface DocumentState {
  document: DocumentRoot;
  history: HistoryEntry[];
  historyIndex: number;
  batchTimeout: ReturnType<typeof setTimeout> | null;
  lastOperationTime: number;

  // Actions
  insertText: (blockId: NodeId, offset: number, text: string) => void;
  deleteText: (blockId: NodeId, offset: number, direction: 'backward' | 'forward') => void;
  splitBlock: (blockId: NodeId, offset: number) => NodeId | null;
  mergeBlocks: (blockId: NodeId) => { newCursorPosition: { nodeId: string; offset: number } } | null;
  deleteSelection: (selection: Selection) => { newCursorPosition: { nodeId: string; offset: number } };
  replaceSelection: (selection: Selection, text: string) => { newCursorPosition: { nodeId: string; offset: number } };
  toggleMark: (blockId: NodeId, startOffset: number, endOffset: number, mark: MarkType) => void;
  setStyle: (blockId: NodeId, startOffset: number, endOffset: number, key: keyof StyleAttrs, value: string | number | undefined) => void;
  insertBlock: (afterBlockId: NodeId, blockType: 'paragraph' | 'heading' | 'list' | 'blockquote' | 'horizontalRule', attrs?: Record<string, unknown>) => NodeId;
  convertBlock: (blockId: NodeId, toType: BlockType, attrs?: Record<string, unknown>) => void;
  insertImage: (afterBlockId: NodeId, src: string, alt?: string, width?: number, height?: number, inline?: boolean) => NodeId;
  resizeImage: (blockId: NodeId, width: number, height: number) => void;
  insertTable: (afterBlockId: NodeId, rows: number, cols: number) => NodeId;
  addTableRow: (tableId: NodeId, afterRowIndex: number) => void;
  addTableColumn: (tableId: NodeId, afterColumnIndex: number) => void;
  deleteTableRow: (tableId: NodeId, rowIndex: number) => void;
  deleteTableColumn: (tableId: NodeId, columnIndex: number) => void;
  mergeTableCells: (tableId: NodeId, startRow: number, startCol: number, endRow: number, endCol: number) => void;
  undo: () => { newCursorPosition: { nodeId: string; offset: number } } | null;
  redo: () => { newCursorPosition: { nodeId: string; offset: number } } | null;
  getBlockText: (blockId: string) => string;
  getAllBlocks: () => ReturnType<typeof getBlockNodes>;
  flushBatch: () => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  document: createDocument([createParagraph('')]),
  history: [],
  historyIndex: -1,
  batchTimeout: null,
  lastOperationTime: 0,

  insertText: (blockId, offset, text) => {
    const { document, history, historyIndex, lastOperationTime } = get();
    const now = Date.now();
    const timeSinceLastOp = now - lastOperationTime;

    // Log for debugging
    console.log('insertText called:', { blockId, offset, text, docChildren: document.children.length });

    // Create a deep clone for immutable update
    const docClone = cloneDocument(document);

    // Create the operation
    const op: InsertTextOp = {
      type: 'insertText',
      blockId,
      offset,
      text,
    };

    // Apply the operation to the clone
    try {
      applyInsertText(docClone, op);
      console.log('applyInsertText succeeded');
    } catch (e) {
      console.error('applyInsertText failed:', e, { blockId, offset, text });
      return;
    }

    // Check if we should batch with the previous operation
    const lastEntry = historyIndex >= 0 ? history[historyIndex] : null;
    const shouldBatch =
      lastEntry &&
      lastEntry.forward.length > 0 &&
      lastEntry.forward[0].type === 'insertText' &&
      timeSinceLastOp < BATCH_TIMEOUT_MS &&
      (lastEntry.forward[0] as InsertTextOp).blockId === blockId &&
      (lastEntry.forward[0] as InsertTextOp).offset + (lastEntry.forward[0] as InsertTextOp).text.length === offset;

    if (shouldBatch && lastEntry) {
      // Merge with previous operation
      const prevOp = lastEntry.forward[0] as InsertTextOp;
      const mergedOp: InsertTextOp = {
        type: 'insertText',
        blockId,
        offset: prevOp.offset,
        text: prevOp.text + text,
      };

      // Update the last entry
      const updatedEntry: HistoryEntry = {
        ...lastEntry,
        forward: [mergedOp],
        inverse: [invertOperation(mergedOp)],
      };

      const newHistory = [...history.slice(0, historyIndex), updatedEntry];

      set({
        document: docClone,
        history: newHistory,
        lastOperationTime: now,
      });
    } else {
      // Create new history entry
      const entry: HistoryEntry = {
        id: `h-${now}`,
        timestamp: now,
        forward: [op],
        inverse: [invertOperation(op)],
        description: `Insert "${text}"`,
      };

      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(entry);

      // Trim history if too long
      if (newHistory.length > MAX_HISTORY_ENTRIES) {
        newHistory.splice(0, newHistory.length - MAX_HISTORY_ENTRIES);
      }

      set({
        document: docClone,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        lastOperationTime: now,
      });
    }
  },

  deleteText: (blockId, offset, direction) => {
    const { document, history, historyIndex, lastOperationTime } = get();
    const docClone = cloneDocument(document);
    const now = Date.now();
    const timeSinceLastOp = now - lastOperationTime;


    // Get the text that will be deleted
    const block = findNode(docClone, blockId);
    if (!block || (block.type !== 'paragraph' && block.type !== 'heading')) {
      return;
    }

    const textBlock = block as any;
    const blockText = getBlockText(textBlock);

    if (direction === 'backward' && offset <= 0) return;
    if (direction === 'forward' && offset >= blockText.length) return;

    const deleteOffset = direction === 'backward' ? offset - 1 : offset;
    const deletedChar = blockText[deleteOffset];

    // Create the operation
    const op: DeleteTextOp = {
      type: 'deleteText',
      blockId,
      offset: deleteOffset,
      text: deletedChar,
    };

    // Apply the operation to clone
    applyDeleteText(docClone, op);

    // Check if we should batch
    const lastEntry = historyIndex >= 0 ? history[historyIndex] : null;
    const shouldBatch =
      lastEntry &&
      lastEntry.forward.length > 0 &&
      lastEntry.forward[0].type === 'deleteText' &&
      timeSinceLastOp < BATCH_TIMEOUT_MS &&
      (lastEntry.forward[0] as DeleteTextOp).blockId === blockId &&
      (lastEntry.forward[0] as DeleteTextOp).offset === deleteOffset;

    if (shouldBatch && lastEntry) {
      // Merge with previous operation
      const prevOp = lastEntry.forward[0] as DeleteTextOp;
      const mergedOp: DeleteTextOp = {
        type: 'deleteText',
        blockId,
        offset: deleteOffset,
        text: deletedChar + prevOp.text, // Prepend because we're deleting backwards
      };

      const updatedEntry: HistoryEntry = {
        ...lastEntry,
        forward: [mergedOp],
        inverse: [invertOperation(mergedOp)],
      };

      const newHistory = [...history.slice(0, historyIndex), updatedEntry];

      set({
        document: docClone,
        history: newHistory,
        lastOperationTime: now,
      });
    } else {
      const entry: HistoryEntry = {
        id: `h-${now}`,
        timestamp: now,
        forward: [op],
        inverse: [invertOperation(op)],
        description: `Delete ${direction}`,
      };

      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(entry);

      if (newHistory.length > MAX_HISTORY_ENTRIES) {
        newHistory.splice(0, newHistory.length - MAX_HISTORY_ENTRIES);
      }

      set({
        document: docClone,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        lastOperationTime: now,
      });
    }
  },

  splitBlock: (blockId, offset) => {
    const { document, history, historyIndex } = get();
    const docClone = cloneDocument(document);
    const now = Date.now();


    // Create the operation
    const op: SplitBlockOp = {
      type: 'splitBlock',
      blockId,
      offset,
      newBlockId: '',
    };

    // Apply the operation to clone
    const newBlockId = applySplitBlock(docClone, op);

    // Update the operation with the new block ID
    op.newBlockId = newBlockId;

    const entry: HistoryEntry = {
      id: `h-${now}`,
      timestamp: now,
      forward: [op],
      inverse: [invertOperation(op)],
      description: 'Split paragraph',
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(entry);

    set({
      document: docClone,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      lastOperationTime: now,
    });

    return newBlockId;
  },

  mergeBlocks: (blockId) => {
    const { document, history, historyIndex } = get();
    const docClone = cloneDocument(document);
    const now = Date.now();

    // Check if there's a mergeable next block
    const childIndex = docClone.children.findIndex((c) => c.id === blockId);
    if (childIndex < 0 || childIndex >= docClone.children.length - 1) return null;
    const nextBlock = docClone.children[childIndex + 1];
    if (!nextBlock || (nextBlock.type !== 'paragraph' && nextBlock.type !== 'heading')) return null;

    // Calculate cursor target BEFORE merge — the boundary offset is the
    // original text length of the block that stays (previousBlockId).
    const origBlock = findNode(docClone, blockId) as Paragraph | Heading | null;
    const cursorOffset = origBlock ? getBlockText(origBlock).length : 0;

    const op: MergeBlocksOp = {
      type: 'mergeBlocks',
      blockId,
      previousBlockId: blockId,
      offset: cursorOffset,
    };

    applyMergeBlocks(docClone, op);

    const entry: HistoryEntry = {
      id: `h-${now}`,
      timestamp: now,
      forward: [op],
      inverse: [invertOperation(op)],
      description: 'Merge paragraphs',
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(entry);

    if (newHistory.length > MAX_HISTORY_ENTRIES) {
      newHistory.splice(0, newHistory.length - MAX_HISTORY_ENTRIES);
    }

    set({
      document: docClone,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      lastOperationTime: now,
    });

    return {
      newCursorPosition: {
        nodeId: blockId,
        offset: cursorOffset,
      },
    };
  },

  deleteSelection: (selection) => {
    const { document, history, historyIndex } = get();
    const docClone = cloneDocument(document);
    const now = Date.now();

    if (isSelectionEmpty(selection)) {
      return { newCursorPosition: selection.anchor };
    }

    const result = deleteSelection(docClone, selection);

    const entry: HistoryEntry = {
      id: `h-${now}`,
      timestamp: now,
      forward: [{
        type: 'deleteText',
        blockId: selection.anchor.nodeId,
        offset: selection.anchor.offset,
        text: '',
      }],
      inverse: [{
        type: 'insertText',
        blockId: selection.anchor.nodeId,
        offset: selection.anchor.offset,
        text: '',
      }],
      description: 'Delete selection',
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(entry);

    set({
      document: docClone,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      lastOperationTime: now,
    });

    return { newCursorPosition: result.newCursorPosition };
  },

  replaceSelection: (selection, text) => {
    const { document, history, historyIndex } = get();
    const docClone = cloneDocument(document);
    const now = Date.now();


    if (isSelectionEmpty(selection)) {
      // Just insert at cursor
      const op: InsertTextOp = {
        type: 'insertText',
        blockId: selection.anchor.nodeId,
        offset: selection.anchor.offset,
        text,
      };
      applyInsertText(docClone, op);

      const entry: HistoryEntry = {
        id: `h-${now}`,
        timestamp: now,
        forward: [op],
        inverse: [invertOperation(op)],
        description: `Insert "${text}"`,
      };

      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(entry);

      set({
        document: docClone,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        lastOperationTime: now,
      });

      return {
        newCursorPosition: {
          nodeId: selection.anchor.nodeId,
          offset: selection.anchor.offset + text.length,
        },
      };
    }

    // Delete selection first
    const deleteResult = deleteSelection(docClone, selection);
    const newOffset = deleteResult.newCursorPosition.offset;

    // Insert text at the position after deletion
    const insertOp: InsertTextOp = {
      type: 'insertText',
      blockId: deleteResult.newCursorPosition.nodeId,
      offset: newOffset,
      text,
    };
    applyInsertText(docClone, insertOp);

    const entry: HistoryEntry = {
      id: `h-${now}`,
      timestamp: now,
      forward: [insertOp],
      inverse: [invertOperation(insertOp)],
      description: `Replace selection with "${text}"`,
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(entry);

    set({
      document: docClone,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      lastOperationTime: now,
    });

    return {
      newCursorPosition: {
        nodeId: deleteResult.newCursorPosition.nodeId,
        offset: newOffset + text.length,
      },
    };
  },

  toggleMark: (blockId, startOffset, endOffset, mark) => {
    const { document, history, historyIndex } = get();
    const docClone = cloneDocument(document);
    const now = Date.now();

    const op: ToggleMarkOp = {
      type: 'toggleMark',
      blockId,
      mark,
      startOffset,
      endOffset,
    };

    applyToggleMark(document, op);

    const entry: HistoryEntry = {
      id: `h-${now}`,
      timestamp: now,
      forward: [op],
      inverse: [invertOperation(op)],
      description: `Toggle ${mark}`,
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(entry);

    set({
      document: docClone,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      lastOperationTime: now,
    });
  },

  setStyle: (blockId, startOffset, endOffset, key, value) => {
    const { document, history, historyIndex } = get();
    const docClone = cloneDocument(document);
    const now = Date.now();

    const op: SetStyleOp = {
      type: 'setStyle',
      blockId,
      key,
      value,
      startOffset,
      endOffset,
    };

    applySetStyle(document, op);

    const entry: HistoryEntry = {
      id: `h-${now}`,
      timestamp: now,
      forward: [op],
      inverse: [invertOperation(op)],
      description: `Set ${key}`,
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(entry);

    set({
      document: docClone,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      lastOperationTime: now,
    });
  },

  insertBlock: (afterBlockId, blockType, attrs) => {
    const { document, history, historyIndex } = get();
    const docClone = cloneDocument(document);
    const now = Date.now();

    const op: InsertBlockOp = {
      type: 'insertBlock',
      blockId: '',
      blockType,
      afterBlockId,
      attrs,
    };

    applyInsertBlock(document, op);

    const entry: HistoryEntry = {
      id: `h-${now}`,
      timestamp: now,
      forward: [op],
      inverse: [invertOperation(op)],
      description: `Insert ${blockType}`,
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(entry);

    set({
      document: docClone,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      lastOperationTime: now,
    });

    // Return the ID of the newly inserted block
    const blocks = getBlockNodes(document);
    const afterIndex = blocks.findIndex((b) => b.id === afterBlockId);
    return afterIndex >= 0 && afterIndex < blocks.length - 1
      ? blocks[afterIndex + 1].id
      : '';
  },

  convertBlock: (blockId, toType, attrs) => {
    const { document, history, historyIndex } = get();
    const docClone = cloneDocument(document);
    const now = Date.now();

    const block = findNode(document, blockId);
    if (!block) return;

    const op: ConvertBlockOp = {
      type: 'convertBlock',
      blockId,
      fromType: block.type,
      toType,
      attrs,
    };

    applyConvertBlock(document, op);

    const entry: HistoryEntry = {
      id: `h-${now}`,
      timestamp: now,
      forward: [op],
      inverse: [invertOperation(op)],
      description: `Convert to ${toType}`,
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(entry);

    set({
      document: docClone,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      lastOperationTime: now,
    });
  },

  insertImage: (afterBlockId, src, alt = '', width = 300, height = 200, inline = false) => {
    const { document, history, historyIndex } = get();
    const docClone = cloneDocument(document);
    const now = Date.now();

    const op: InsertImageOp = {
      type: 'insertImage',
      blockId: '',
      afterBlockId,
      src,
      alt,
      width,
      height,
      inline,
    };

    applyInsertImage(document, op);

    const entry: HistoryEntry = {
      id: `h-${now}`,
      timestamp: now,
      forward: [op],
      inverse: [invertOperation(op)],
      description: 'Insert image',
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(entry);

    set({
      document: docClone,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      lastOperationTime: now,
    });

    // Return the ID of the newly inserted image
    const blocks = getBlockNodes(document);
    const afterIndex = blocks.findIndex((b) => b.id === afterBlockId);
    return afterIndex >= 0 && afterIndex < blocks.length - 1
      ? blocks[afterIndex + 1].id
      : '';
  },

  resizeImage: (blockId, width, height) => {
    const { document, history, historyIndex } = get();
    const docClone = cloneDocument(document);
    const now = Date.now();

    const op: ResizeImageOp = {
      type: 'resizeImage',
      blockId,
      width,
      height,
    };

    applyResizeImage(document, op);

    const entry: HistoryEntry = {
      id: `h-${now}`,
      timestamp: now,
      forward: [op],
      inverse: [invertOperation(op)],
      description: 'Resize image',
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(entry);

    set({
      document: docClone,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      lastOperationTime: now,
    });
  },

  insertTable: (afterBlockId, rows, cols) => {
    const { document, history, historyIndex } = get();
    const docClone = cloneDocument(document);
    const now = Date.now();

    const op: InsertTableOp = {
      type: 'insertTable',
      blockId: '',
      afterBlockId,
      rows,
      cols,
    };

    applyInsertTable(document, op);

    const entry: HistoryEntry = {
      id: `h-${now}`,
      timestamp: now,
      forward: [op],
      inverse: [invertOperation(op)],
      description: `Insert table ${rows}x${cols}`,
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(entry);

    set({
      document: docClone,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      lastOperationTime: now,
    });

    // Return the ID of the newly inserted table
    const blocks = getBlockNodes(document);
    const afterIndex = blocks.findIndex((b) => b.id === afterBlockId);
    return afterIndex >= 0 && afterIndex < blocks.length - 1
      ? blocks[afterIndex + 1].id
      : '';
  },

  addTableRow: (tableId, afterRowIndex) => {
    const { document, history, historyIndex } = get();
    const docClone = cloneDocument(document);
    const now = Date.now();

    const op: AddTableRowOp = {
      type: 'addTableRow',
      blockId: tableId,
      tableId,
      afterRowIndex,
    };

    applyAddTableRow(document, op);

    const entry: HistoryEntry = {
      id: `h-${now}`,
      timestamp: now,
      forward: [op],
      inverse: [invertOperation(op)],
      description: 'Add table row',
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(entry);

    set({
      document: docClone,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      lastOperationTime: now,
    });
  },

  addTableColumn: (tableId, afterColumnIndex) => {
    const { document, history, historyIndex } = get();
    const docClone = cloneDocument(document);
    const now = Date.now();

    const op: AddTableColumnOp = {
      type: 'addTableColumn',
      blockId: tableId,
      tableId,
      afterColumnIndex,
    };

    applyAddTableColumn(document, op);

    const entry: HistoryEntry = {
      id: `h-${now}`,
      timestamp: now,
      forward: [op],
      inverse: [invertOperation(op)],
      description: 'Add table column',
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(entry);

    set({
      document: docClone,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      lastOperationTime: now,
    });
  },

  deleteTableRow: (tableId, rowIndex) => {
    const { document, history, historyIndex } = get();
    const docClone = cloneDocument(document);
    const now = Date.now();

    const op: DeleteTableRowOp = {
      type: 'deleteTableRow',
      blockId: tableId,
      tableId,
      rowIndex,
      deletedRow: createTableRow(),
    };

    applyDeleteTableRow(document, op);

    const entry: HistoryEntry = {
      id: `h-${now}`,
      timestamp: now,
      forward: [op],
      inverse: [invertOperation(op)],
      description: 'Delete table row',
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(entry);

    set({
      document: docClone,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      lastOperationTime: now,
    });
  },

  deleteTableColumn: (tableId, columnIndex) => {
    const { document, history, historyIndex } = get();
    const docClone = cloneDocument(document);
    const now = Date.now();

    const op: DeleteTableColumnOp = {
      type: 'deleteTableColumn',
      blockId: tableId,
      tableId,
      columnIndex,
      deletedCells: [],
    };

    applyDeleteTableColumn(document, op);

    const entry: HistoryEntry = {
      id: `h-${now}`,
      timestamp: now,
      forward: [op],
      inverse: [invertOperation(op)],
      description: 'Delete table column',
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(entry);

    set({
      document: docClone,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      lastOperationTime: now,
    });
  },

  mergeTableCells: (tableId, startRow, startCol, endRow, endCol) => {
    const { document, history, historyIndex } = get();
    const docClone = cloneDocument(document);
    const now = Date.now();

    const op: MergeTableCellsOp = {
      type: 'mergeTableCells',
      blockId: tableId,
      tableId,
      startRow,
      startCol,
      endRow,
      endCol,
    };

    applyMergeTableCells(document, op);

    const entry: HistoryEntry = {
      id: `h-${now}`,
      timestamp: now,
      forward: [op],
      inverse: [invertOperation(op)],
      description: 'Merge table cells',
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(entry);

    set({
      document: docClone,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      lastOperationTime: now,
    });
  },

  undo: () => {
    const { document, history, historyIndex } = get();
    const docClone = cloneDocument(document);
    if (historyIndex < 0) return null;

    const entry = history[historyIndex];

    // Apply inverse operations in reverse order
    for (let i = entry.inverse.length - 1; i >= 0; i--) {
      const op = entry.inverse[i];
      applyOperation(document, op);
    }

    // Calculate cursor position from the first inverse operation
    const firstInverse = entry.inverse[0];
    let cursorPos = { nodeId: '', offset: 0 };

    if (firstInverse.type === 'insertText') {
      cursorPos = {
        nodeId: firstInverse.blockId,
        offset: (firstInverse as InsertTextOp).offset,
      };
    } else if (firstInverse.type === 'deleteText') {
      cursorPos = {
        nodeId: firstInverse.blockId,
        offset: (firstInverse as DeleteTextOp).offset,
      };
    } else if (firstInverse.type === 'mergeBlocks') {
      cursorPos = {
        nodeId: firstInverse.blockId,
        offset: 0,
      };
    } else if (firstInverse.type === 'splitBlock') {
      cursorPos = {
        nodeId: firstInverse.blockId,
        offset: (firstInverse as SplitBlockOp).offset,
      };
    }

    set({
      document: docClone,
      historyIndex: historyIndex - 1,
    });

    return { newCursorPosition: cursorPos };
  },

  redo: () => {
    const { document, history, historyIndex } = get();
    const docClone = cloneDocument(document);
    if (historyIndex >= history.length - 1) return null;

    const entry = history[historyIndex + 1];

    // Apply forward operations
    for (const op of entry.forward) {
      applyOperation(document, op);
    }

    // Calculate cursor position from the first forward operation
    const firstForward = entry.forward[0];
    let cursorPos = { nodeId: '', offset: 0 };

    if (firstForward.type === 'insertText') {
      const insertOp = firstForward as InsertTextOp;
      cursorPos = {
        nodeId: insertOp.blockId,
        offset: insertOp.offset + insertOp.text.length,
      };
    } else if (firstForward.type === 'deleteText') {
      cursorPos = {
        nodeId: firstForward.blockId,
        offset: (firstForward as DeleteTextOp).offset,
      };
    } else if (firstForward.type === 'splitBlock') {
      cursorPos = {
        nodeId: (firstForward as SplitBlockOp).newBlockId,
        offset: 0,
      };
    } else if (firstForward.type === 'mergeBlocks') {
      cursorPos = {
        nodeId: firstForward.blockId,
        offset: 0,
      };
    }

    set({
      document: docClone,
      historyIndex: historyIndex + 1,
    });

    return { newCursorPosition: cursorPos };
  },

  getBlockText: (blockId) => {
    const { document } = get();
    const blocks = getBlockNodes(document);
    const block = blocks.find((b) => b.id === blockId);
    if (!block || (block.type !== 'paragraph' && block.type !== 'heading')) return '';
    return getBlockText(block as any);
  },

  getAllBlocks: () => {
    const { document } = get();
    return getBlockNodes(document);
  },

  flushBatch: () => {
    const { batchTimeout } = get();
    if (batchTimeout) {
      clearTimeout(batchTimeout);
      set({ batchTimeout: null });
    }
  },
}));
