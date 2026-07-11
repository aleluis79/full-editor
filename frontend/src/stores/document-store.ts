import { create } from 'zustand';
import type { DocumentRoot, HistoryEntry, NodeId, MarkType, StyleAttrs, BlockAttrs, BlockType, InsertTextOp, DeleteTextOp, SplitBlockOp, MergeBlocksOp, ToggleMarkOp, SetStyleOp, SetBlockAttrsOp, InsertBlockOp, ConvertBlockOp, InsertImageOp, ResizeImageOp, InsertTableOp, AddTableRowOp, AddTableColumnOp, DeleteTableRowOp, DeleteTableColumnOp, MergeTableCellsOp, Selection, Paragraph, Heading, BlockNode } from '../core/types';
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
  applySetBlockAttrs,
  applyClearFormatting,
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
import { deleteSelection, isSelectionEmpty, getSelectionRange } from '../core/selection';
import { useEditorStore } from './editor-store';
import { createDocument as apiCreateDoc, updateDocument as apiUpdateDoc, fetchDocument as apiFetchDoc } from '../api/client';
import { usePageStore } from './page-store';

// ============================================================
// Batch Configuration
// ============================================================

const BATCH_TIMEOUT_MS = 300; // Max time between keystrokes to batch
const MAX_HISTORY_ENTRIES = 500;

const SAVE_DEBOUNCE_MS = 2000;

// ── helper: mark document dirty on every mutation ───────────────

function docSet(set: any, state: Partial<DocumentState>) {
  // Only mark dirty when the document itself changes
  if ('document' in state) {
    set({ ...state, isDirty: true });
  } else {
    set(state);
  }
}

// ============================================================
// Document Store
// ============================================================

interface DocumentState {
  document: DocumentRoot;
  history: HistoryEntry[];
  historyIndex: number;
  batchTimeout: ReturnType<typeof setTimeout> | null;
  lastOperationTime: number;

  // Document management
  currentDocId: string | null;
  documentTitle: string;
  isDirty: boolean;
  isSaving: boolean;
  isEditorReady: boolean;

  // Actions
  setDocumentTitle: (title: string) => void;
  markDirty: () => void;
  newDocument: () => Promise<string>;
  loadDocument: (id: string) => Promise<void>;
  saveDocument: () => Promise<void>;
  resetEditor: () => void;
  insertText: (blockId: NodeId, offset: number, text: string) => void;
  deleteText: (blockId: NodeId, offset: number, direction: 'backward' | 'forward') => void;
  splitBlock: (blockId: NodeId, offset: number) => NodeId | null;
  mergeBlocks: (blockId: NodeId) => { newCursorPosition: { nodeId: string; offset: number } } | null;
  deleteSelection: (selection: Selection) => { newCursorPosition: { nodeId: string; offset: number } };
  replaceSelection: (selection: Selection, text: string) => { newCursorPosition: { nodeId: string; offset: number } };
  toggleMark: (blockId: NodeId, startOffset: number, endOffset: number, mark: MarkType, endBlockId?: NodeId) => void;
  setStyle: (blockId: NodeId, startOffset: number, endOffset: number, key: keyof StyleAttrs, value: string | number | undefined, endBlockId?: NodeId) => void;
  clearFormatting: (blockId: NodeId, startOffset: number, endOffset: number, endBlockId?: NodeId) => void;
  setBlockAttrs: (blockId: NodeId, attrs: BlockAttrs) => void;
  setBlockAttrsRange: (startBlockId: NodeId, endBlockId: NodeId, attrs: BlockAttrs) => void;
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

export const useDocumentStore = create<DocumentState>((_set, get) => {
  // Wrap _set to auto-mark dirty when the document tree changes
  const set = (partial: Partial<DocumentState>) => {
    if ('document' in partial && 'isDirty' in partial === false) {
      _set({ ...partial, isDirty: true });
    } else {
      _set(partial);
    }
  };

  return {
  document: createDocument([createParagraph('')]),
  history: [],
  historyIndex: -1,
  batchTimeout: null,
  lastOperationTime: 0,

  // Document management
  currentDocId: null,
  documentTitle: 'Untitled Document',
  isDirty: false,
  isSaving: false,
  isEditorReady: false,

  setDocumentTitle: (title) => {
    set({ documentTitle: title, isDirty: true });
  },

  markDirty: () => {
    set({ isDirty: true });
  },

  newDocument: async () => {
    try {
      const title = 'Untitled Document';
      const pageConfig = usePageStore.getState().config;
      const content = {
        blocks: [createParagraph('')],
        config: {
          paperSize: pageConfig.paperSize,
          margins: pageConfig.margins,
        },
      };
      const doc = await apiCreateDoc({ title, content: content as any });
      set({
        currentDocId: doc.id,
        documentTitle: doc.title,
        document: createDocument([createParagraph('')]),
        history: [],
        historyIndex: -1,
        isDirty: false,
        isSaving: false,
        isEditorReady: true,
      });
      return doc.id;
    } catch (err) {
      console.error('Failed to create document:', err);
      throw err;
    }
  },

  loadDocument: async (id) => {
    try {
      const doc = await apiFetchDoc(id);
      const content = doc.content as Record<string, unknown> | undefined;
      const blocks = (content?.blocks as any[]) ?? [createParagraph('')];
      const savedConfig = content?.config as Record<string, unknown> | undefined;

      // Restore saved page config
      if (savedConfig?.paperSize && savedConfig?.margins) {
        usePageStore.getState().updatePaperSize(savedConfig.paperSize as any);
      }

      set({
        currentDocId: doc.id,
        documentTitle: doc.title,
        document: createDocument(blocks),
        history: [],
        historyIndex: -1,
        isDirty: false,
        isSaving: false,
        isEditorReady: true,
      });
    } catch (err) {
      console.error('Failed to load document:', err);
      throw err;
    }
  },

  saveDocument: async () => {
    const { currentDocId, document, documentTitle } = get();
    if (!currentDocId) return;

    set({ isSaving: true });
    try {
      const pageConfig = usePageStore.getState().config;
      const content = {
        blocks: document.children,
        config: {
          paperSize: pageConfig.paperSize,
          margins: pageConfig.margins,
        },
      };
      await apiUpdateDoc(currentDocId, { title: documentTitle, content: content as any });
      set({ isDirty: false, isSaving: false });
    } catch (err) {
      console.error('Failed to save document:', err);
      set({ isSaving: false });
      throw err;
    }
  },

  resetEditor: () => {
    set({
      currentDocId: null,
      documentTitle: 'Untitled Document',
      document: createDocument([createParagraph('')]),
      history: [],
      historyIndex: -1,
      isDirty: false,
      isSaving: false,
      isEditorReady: false,
    });
  },

  insertText: (blockId, offset, text) => {
    const { document, history, historyIndex, lastOperationTime } = get();
    const now = Date.now();
    const timeSinceLastOp = now - lastOperationTime;

    // Read sticky marks/attrs from the editor store. When set, they
    // represent toggled styles the user wants applied to new text.
    const editorState = useEditorStore.getState();
    const stickyMarks = editorState.stickyMarks;
    const stickyAttrs = editorState.stickyAttrs;
    const stickyBreakOut = editorState.stickyBreakOut;
    const hasStickyMarks = stickyMarks.length > 0 || Object.keys(stickyAttrs).length > 0;

    // Create a deep clone for immutable update
    const docClone = cloneDocument(document);

    // Create the operation
    const op: InsertTextOp = {
      type: 'insertText',
      blockId,
      offset,
      text,
    };

    // Apply the operation to the clone — pass sticky marks/attrs so
    // applyInsertText can create a properly styled run if needed.
    try {
      if (stickyBreakOut) {
        // User just toggled all sticky marks OFF. Force a plain run to
        // break out of the current run's inherited marks (e.g., cursor
        // is on bold text, user turned off bold, next char should be plain).
        applyInsertText(docClone, op, [], {});
        useEditorStore.getState().consumeStickyBreakOut();
      } else if (hasStickyMarks) {
        applyInsertText(
          docClone, op,
          stickyMarks,
          Object.keys(stickyAttrs).length > 0 ? stickyAttrs as StyleAttrs : undefined,
        );
      } else {
        applyInsertText(docClone, op);
      }
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

    // ── Capture pre-deletion state for undo ──────────────────────
    const { start, end } = getSelectionRange(selection, document);
    const allBlocks = getBlockNodes(document);
    const startBlockIdx = allBlocks.findIndex((b) => b.id === start.nodeId);
    const endBlockIdx = allBlocks.findIndex((b) => b.id === end.nodeId);

    let snapshotBlocks: BlockNode[] = [];
    let firstBlockId = '';
    let prevBlockId: string | null = null;

    if (startBlockIdx >= 0 && endBlockIdx >= 0) {
      const minIdx = Math.min(startBlockIdx, endBlockIdx);
      const maxIdx = Math.max(startBlockIdx, endBlockIdx);

      // Clone affected blocks while they still have their original content
      const docChildren = document.children;
      const childStartIdx = docChildren.findIndex((c) => c.id === allBlocks[minIdx].id);
      const childEndIdx = docChildren.findIndex((c) => c.id === allBlocks[maxIdx].id);
      if (childStartIdx >= 0 && childEndIdx >= 0) {
        const cMin = Math.min(childStartIdx, childEndIdx);
        const cMax = Math.max(childStartIdx, childEndIdx);
        snapshotBlocks = docChildren.slice(cMin, cMax + 1).map((b) => JSON.parse(JSON.stringify(b)));
        firstBlockId = snapshotBlocks[0].id;
        // Block immediately before the range, or null if at start
        prevBlockId = cMin > 0 ? docChildren[cMin - 1].id : null;
      }
    }

    // ── Apply deletion ──────────────────────────────────────────
    const result = deleteSelection(docClone, selection);

    // ── Store snapshot so undo can restore ──────────────────────
    const entry: HistoryEntry = {
      id: `h-${now}`,
      timestamp: now,
      forward: [],
      inverse: [],
      description: 'Delete selection',
      selectionDelete: snapshotBlocks.length > 0 ? {
        blocks: snapshotBlocks,
        firstBlockId,
        prevBlockId,
        anchor: { nodeId: selection.anchor.nodeId, offset: selection.anchor.offset },
        focus: { nodeId: selection.focus.nodeId, offset: selection.focus.offset },
      } : undefined,
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

  toggleMark: (blockId, startOffset, endOffset, mark, endBlockId?) => {
    const { document, history, historyIndex } = get();
    const docClone = cloneDocument(document);
    const now = Date.now();

    const blocks = getBlockNodes(docClone);
    const actualStart = Math.min(startOffset, endOffset);
    const actualEnd = Math.max(startOffset, endOffset);
    const targetEndId = endBlockId || blockId;

    const ops: Operation[] = [];
    let started = false;

    for (const b of blocks) {
      if (b.type !== 'paragraph' && b.type !== 'heading') continue;

      if (b.id === blockId && !started) {
        started = true;
        if (b.id === targetEndId) {
          ops.push({ type: 'toggleMark', blockId: b.id, mark, startOffset: actualStart, endOffset: actualEnd } as ToggleMarkOp);
          break;
        }
        const textLen = getBlockText(b as Paragraph | Heading);
        ops.push({ type: 'toggleMark', blockId: b.id, mark, startOffset: actualStart, endOffset: textLen } as ToggleMarkOp);
        continue;
      }

      if (started) {
        const textLen = getBlockText(b as Paragraph | Heading);
        if (b.id === targetEndId) {
          ops.push({ type: 'toggleMark', blockId: b.id, mark, startOffset: 0, endOffset: actualEnd } as ToggleMarkOp);
          break;
        }
        ops.push({ type: 'toggleMark', blockId: b.id, mark, startOffset: 0, endOffset: textLen } as ToggleMarkOp);
      }
    }

    if (ops.length === 0) {
      ops.push({ type: 'toggleMark', blockId, mark, startOffset: actualStart, endOffset: actualEnd } as ToggleMarkOp);
    }

    for (const op of ops) {
      applyToggleMark(docClone, op as ToggleMarkOp);
    }

    const entry: HistoryEntry = {
      id: `h-${now}`,
      timestamp: now,
      forward: ops,
      inverse: ops.map((op) => invertOperation(op)),
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

  setStyle: (blockId, startOffset, endOffset, key, value, endBlockId?) => {
    const { document, history, historyIndex } = get();
    const docClone = cloneDocument(document);
    const now = Date.now();

    const blocks = getBlockNodes(docClone);
    const actualStart = Math.min(startOffset, endOffset);
    const actualEnd = Math.max(startOffset, endOffset);
    const targetEndId = endBlockId || blockId;

    const ops: Operation[] = [];
    let started = false;

    for (const b of blocks) {
      if (b.type !== 'paragraph' && b.type !== 'heading') continue;

      if (b.id === blockId && !started) {
        started = true;
        if (b.id === targetEndId) {
          ops.push({ type: 'setStyle', blockId: b.id, key, value, startOffset: actualStart, endOffset: actualEnd } as SetStyleOp);
          break;
        }
        const textLen = getBlockText(b as Paragraph | Heading);
        ops.push({ type: 'setStyle', blockId: b.id, key, value, startOffset: actualStart, endOffset: textLen } as SetStyleOp);
        continue;
      }

      if (started) {
        const textLen = getBlockText(b as Paragraph | Heading);
        if (b.id === targetEndId) {
          ops.push({ type: 'setStyle', blockId: b.id, key, value, startOffset: 0, endOffset: actualEnd } as SetStyleOp);
          break;
        }
        ops.push({ type: 'setStyle', blockId: b.id, key, value, startOffset: 0, endOffset: textLen } as SetStyleOp);
      }
    }

    if (ops.length === 0) {
      ops.push({ type: 'setStyle', blockId, key, value, startOffset: actualStart, endOffset: actualEnd } as SetStyleOp);
    }

    for (const op of ops) {
      applySetStyle(docClone, op as SetStyleOp);
    }

    const entry: HistoryEntry = {
      id: `h-${now}`,
      timestamp: now,
      forward: ops,
      inverse: ops.map((op) => invertOperation(op)),
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

  clearFormatting: (blockId, startOffset, endOffset, endBlockId?) => {
    const { document, history, historyIndex } = get();
    const docClone = cloneDocument(document);
    const now = Date.now();
    const actualStart = Math.min(startOffset, endOffset);
    const actualEnd = Math.max(startOffset, endOffset);
    const targetEndId = endBlockId || blockId;

    const blocks = getBlockNodes(docClone);
    let started = false;

    for (const b of blocks) {
      if (b.type !== 'paragraph' && b.type !== 'heading') continue;
      if (b.id === blockId && !started) {
        started = true;
        if (b.id === targetEndId) {
          applyClearFormatting(docClone, b.id, actualStart, actualEnd);
          break;
        }
        const textLen = getBlockText(b as Paragraph | Heading);
        applyClearFormatting(docClone, b.id, actualStart, textLen);
        continue;
      }
      if (started) {
        const textLen = getBlockText(b as Paragraph | Heading);
        if (b.id === targetEndId) {
          applyClearFormatting(docClone, b.id, 0, actualEnd);
          break;
        }
        applyClearFormatting(docClone, b.id, 0, textLen);
      }
    }

    const entry: HistoryEntry = {
      id: `h-${now}`,
      timestamp: now,
      forward: [{ type: 'setStyle', blockId }] as any,
      inverse: [{ type: 'setStyle', blockId }] as any,
      description: 'Clear formatting',
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
  },

  setBlockAttrs: (blockId, attrs) => {
    const { document, history, historyIndex } = get();
    const docClone = cloneDocument(document);
    const now = Date.now();

    const block = findNode(docClone, blockId) as Paragraph | Heading | null;
    const prevAttrs = block?.attrs ?? {};

    const op: SetBlockAttrsOp = {
      type: 'setBlockAttrs',
      blockId,
      attrs,
      prevAttrs,
    };

    applySetBlockAttrs(docClone, op);

    const entry: HistoryEntry = {
      id: `h-${now}`,
      timestamp: now,
      forward: [op],
      inverse: [invertOperation(op)],
      description: attrs.textAlign ? `Align ${attrs.textAlign}` : 'Set block attrs',
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
  },

  setBlockAttrsRange: (startBlockId, endBlockId, attrs) => {
    const { document, history, historyIndex } = get();
    const docClone = cloneDocument(document);
    const now = Date.now();

    const blocks = getBlockNodes(docClone);
    const startIdx = blocks.findIndex((b) => b.id === startBlockId);
    const endIdx = blocks.findIndex((b) => b.id === endBlockId);
    if (startIdx < 0 || endIdx < 0) return;

    const minIdx = Math.min(startIdx, endIdx);
    const maxIdx = Math.max(startIdx, endIdx);
    const ops: Operation[] = [];

    for (let i = minIdx; i <= maxIdx; i++) {
      const b = blocks[i];
      if (b.type !== 'paragraph' && b.type !== 'heading') continue;
      const textBlock = b as Paragraph | Heading;
      const prevAttrs = textBlock.attrs ?? {};
      ops.push({
        type: 'setBlockAttrs',
        blockId: b.id,
        attrs,
        prevAttrs,
      } as SetBlockAttrsOp);
    }

    for (const op of ops) {
      applySetBlockAttrs(docClone, op as SetBlockAttrsOp);
    }

    const entry: HistoryEntry = {
      id: `h-${now}`,
      timestamp: now,
      forward: ops,
      inverse: ops.map((op) => invertOperation(op)),
      description: ops.length > 1 ? `Align ${attrs.textAlign} (${ops.length} blocks)` : `Align ${attrs.textAlign}`,
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

    applyInsertBlock(docClone, op);

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
    const blocks = getBlockNodes(docClone);
    const afterIndex = blocks.findIndex((b) => b.id === afterBlockId);
    return afterIndex >= 0 && afterIndex < blocks.length - 1
      ? blocks[afterIndex + 1].id
      : '';
  },

  convertBlock: (blockId, toType, attrs) => {
    const { document, history, historyIndex } = get();
    const docClone = cloneDocument(document);
    const now = Date.now();

    const block = findNode(docClone, blockId);
    if (!block) return;

    const op: ConvertBlockOp = {
      type: 'convertBlock',
      blockId,
      fromType: block.type,
      toType,
      attrs,
    };

    applyConvertBlock(docClone, op);

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

    applyInsertImage(docClone, op);

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
    const blocks = getBlockNodes(docClone);
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

    applyResizeImage(docClone, op);

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

    applyInsertTable(docClone, op);

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
    const blocks = getBlockNodes(docClone);
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

    applyAddTableRow(docClone, op);

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

    applyAddTableColumn(docClone, op);

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

    applyDeleteTableRow(docClone, op);

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

    applyDeleteTableColumn(docClone, op);

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

    applyMergeTableCells(docClone, op);

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
    let cursorPos = { nodeId: '', offset: 0 };

    // ── Selection-delete snapshot: restore original blocks ──────
    if (entry.selectionDelete) {
      const sd = entry.selectionDelete;
      const firstIdx = docClone.children.findIndex((c) => c.id === sd.firstBlockId);

      if (firstIdx >= 0) {
        // First block was truncated — replace it with all original blocks
        docClone.children.splice(firstIdx, 1, ...sd.blocks);
      } else if (sd.prevBlockId) {
        // First block was removed — insert after previous block
        const prevIdx = docClone.children.findIndex((c) => c.id === sd.prevBlockId);
        if (prevIdx >= 0) {
          docClone.children.splice(prevIdx + 1, 0, ...sd.blocks);
        } else {
          // Fallback: prepend
          docClone.children.unshift(...sd.blocks);
        }
      } else {
        // No prevBlockId and first block is gone — prepend
        docClone.children.unshift(...sd.blocks);
      }

      cursorPos = {
        nodeId: sd.anchor.nodeId,
        offset: sd.anchor.offset,
      };
    } else {
      // ── Operation-based undo ──────────────────────────────────
      for (let i = entry.inverse.length - 1; i >= 0; i--) {
        const op = entry.inverse[i];
        applyOperation(docClone, op);
      }

      const firstInverse = entry.inverse[0];
      if (firstInverse) {
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
      }
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
    let cursorPos = { nodeId: '', offset: 0 };

    // ── Selection-delete snapshot: re-delete the same range ─────
    if (entry.selectionDelete) {
      const sd = entry.selectionDelete;
      const selection: Selection = {
        anchor: { nodeId: sd.anchor.nodeId, offset: sd.anchor.offset },
        focus: { nodeId: sd.focus.nodeId, offset: sd.focus.offset },
      };
      const result = deleteSelection(docClone, selection);
      cursorPos = result.newCursorPosition;
    } else {
      // ── Operation-based redo ──────────────────────────────────
      for (const op of entry.forward) {
        applyOperation(docClone, op);
      }

      const firstForward = entry.forward[0];
      if (firstForward) {
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
      }
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
};
});
