import { useCallback, useEffect, useRef } from 'react';
import { useDocumentStore } from '../stores/document-store';
import { useEditorStore } from '../stores/editor-store';
import { useLayoutStore } from '../stores/layout-store';
import { usePageStore } from '../stores/page-store';
import { getBlockNodes, getPreviousBlock, getNextBlock, getBlockText, findNode, findListContext, findTableCellContext, cloneDocument } from '../core/document';
import {
  moveCursorRight,
  moveCursorLeft,
  moveCursorToLineStart,
  moveCursorToLineEnd,
  clampCursor,
} from '../core/cursor';
import { selectWord, selectParagraph, getSelectedText, getSelectionRange, isSelectionEmpty } from '../core/selection';
import { getOffsetFromPoint, getPointFromOffset, hitTest, nodeToLogicalPosition } from '../core/interaction';
import { DocumentView } from './DocumentView';
import { SelectionOverlay } from './SelectionOverlay';
import { Toolbar } from './Toolbar';
import type { Table, DocumentRoot, Paragraph as ParagraphType, Heading as HeadingType } from '../core/types';

/** Walk the document tree to find if a nodeId lives inside a table cell. */
function findTableContext(
  doc: DocumentRoot,
  nodeId: string,
): { table: Table; rowIndex: number; colIndex: number } | null {
  for (const child of doc.children) {
    if (child.type === 'table') {
      const table = child as Table;
      for (let ri = 0; ri < table.rows.length; ri++) {
        for (let ci = 0; ci < table.rows[ri].cells.length; ci++) {
          const cell = table.rows[ri].cells[ci];
          if (cell.children.some((p) => p.id === nodeId)) {
            return { table, rowIndex: ri, colIndex: ci };
          }
        }
      }
    }
  }
  return null;
}

interface EditorProps {
  onBack?: () => void;
}

export function Editor({ onBack }: EditorProps) {
  const doc = useDocumentStore((s) => s.document);
  const saveDocument = useDocumentStore((s) => s.saveDocument);
  const insertBlock = useDocumentStore((s) => s.insertBlock);
  const insertText = useDocumentStore((s) => s.insertText);
  const deleteText = useDocumentStore((s) => s.deleteText);
  const splitBlock = useDocumentStore((s) => s.splitBlock);
  const deleteSelection = useDocumentStore((s) => s.deleteSelection);
  const replaceSelection = useDocumentStore((s) => s.replaceSelection);
  const toggleMark = useDocumentStore((s) => s.toggleMark);
  const setLink = useDocumentStore((s) => s.setLink);
  const removeLink = useDocumentStore((s) => s.removeLink);
  const undo = useDocumentStore((s) => s.undo);
  const redo = useDocumentStore((s) => s.redo);
  const uploadAndInsertImage = useDocumentStore((s) => s.uploadAndInsertImage);
  const mergeBlocks = useDocumentStore((s) => s.mergeBlocks);
  const removeListItem = useDocumentStore((s) => s.removeListItem);
  const exitList = useDocumentStore((s) => s.exitList);
  const convertBlock = useDocumentStore((s) => s.convertBlock);
  const appendBlockToList = useDocumentStore((s) => s.appendBlockToList);
  const prependListToBlock = useDocumentStore((s) => s.prependListToBlock);
  const deleteBlock = useDocumentStore((s) => s.deleteBlock);

  const cursor = useEditorStore((s) => s.cursor);
  const focused = useEditorStore((s) => s.focused);
  const selectedTableId = useEditorStore((s) => s.selectedTableId);
  const selection = useEditorStore((s) => s.selection);
  const setCursorPosition = useEditorStore((s) => s.setCursorPosition);
  const setSelection = useEditorStore((s) => s.setSelection);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const extendSelection = useEditorStore((s) => s.extendSelection);
  const setFocused = useEditorStore((s) => s.setFocused);
  const activateLinkPopup = useEditorStore((s) => s.activateLinkPopup);
  const deactivateLinkPopup = useEditorStore((s) => s.deactivateLinkPopup);

  const calculateLayout = useLayoutStore((s) => s.calculateLayout);
  const layout = useLayoutStore((s) => s.layout);
  const paginate = usePageStore((s) => s.paginate);

  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Tracks active IME composition (dead keys, CJK, etc.). During
  // composition, the keydown handler must NOT process keys so the
  // browser can compose the character naturally. compositionEnd
  // captures the final composed text.
  const isComposingRef = useRef(false);

  const blocks = getBlockNodes(doc);
  const activeBlockId = cursor.position.nodeId || blocks[0]?.id || null;

  // Track drag state for JS-based mouse selection. The browser's DOM
  // Selection API cannot select text in non-contentEditable elements
  // when a textarea has focus, so we implement selection entirely in
  // JavaScript using mousedown/mousemove/mouseup events.
  const dragState = useRef<{
    anchor: { nodeId: string; offset: number };
  } | null>(null);
  const justFinishedDrag = useRef(false);

  const handleBlockMouseDown = useCallback(
    (blockId: string, e: React.MouseEvent) => {
      const blockEl = document.querySelector(
        `[data-block-id="${blockId}"]`
      ) as HTMLElement | null;
      if (!blockEl) return;

      const offset = getOffsetFromPoint(blockEl, e.clientX, e.clientY);
      dragState.current = { anchor: { nodeId: blockId, offset } };
      setCursorPosition({ nodeId: blockId, offset });
      clearSelection();
    },
    [setCursorPosition, clearSelection]
  );

  // Track mousemove for drag selection — this runs on the document
  // level so it works even when the user drags across blocks.
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.current) return;

      // Clear native selection so only our custom JS selection is visible
      const nativeSel = window.getSelection();
      if (nativeSel && !nativeSel.isCollapsed) nativeSel.removeAllRanges();

      const hit = hitTest(e.clientX, e.clientY);
      if (!hit) return;
      setSelection({
        anchor: dragState.current.anchor,
        focus: { nodeId: hit.blockId, offset: hit.offset },
      });
      setCursorPosition({ nodeId: hit.blockId, offset: hit.offset });
    };
    const handleMouseUp = () => {
      if (!dragState.current) return;
      dragState.current = null;
      // Block the selectionchange handler from clearing our JS selection
      justFinishedDrag.current = true;
      setTimeout(() => {
        justFinishedDrag.current = false;
        // Re-focus the textarea so keyboard input works after drag-select
        textareaRef.current?.focus({ preventScroll: true });
      }, 50);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setSelection, setCursorPosition]);

  // Focus the hidden textarea when clicking on the editor, and position
  // the cursor at the exact clicked character.
  const handleBlockClick = useCallback(
    (blockId: string, clientX: number, clientY: number) => {
      // If the browser has a non-collapsed native selection, the user
      // just finished a drag-select. Don't steal the selection by
      // focusing the textarea.
      const nativeSel = window.getSelection();
      if (nativeSel && !nativeSel.isCollapsed) return;

      // If we have an active Zustand selection from our JS-based drag
      // handler, preserve it too (the browser's native selection might
      // already be collapsed by our mousemove cleanup).
      const currentSel = useEditorStore.getState().selection;
      if (currentSel && !isSelectionEmpty(currentSel)) return;

      const blockEl = document.querySelector(
        `[data-block-id="${blockId}"]`
      ) as HTMLElement | null;
      // Clicking on block content deselects any selected table
      useEditorStore.getState().selectTable(null);
      if (blockEl) {
        const offset = getOffsetFromPoint(blockEl, clientX, clientY);
        setCursorPosition({ nodeId: blockId, offset });
      } else {
        setCursorPosition({ nodeId: blockId, offset: 0 });
      }
      clearSelection();
      textareaRef.current?.focus({ preventScroll: true });
    },
    [setCursorPosition, clearSelection]
  );

  // Handle double click (select word at the clicked position)
  const handleDoubleClick = useCallback(
    (blockId: string, clientX: number, clientY: number) => {
      const blockEl = document.querySelector(
        `[data-block-id="${blockId}"]`
      ) as HTMLElement | null;
      const offset = blockEl ? getOffsetFromPoint(blockEl, clientX, clientY) : 0;
      const pos = { nodeId: blockId, offset };
      const wordSelection = selectWord(doc, pos);
      if (wordSelection) {
        setSelection(wordSelection);
        setCursorPosition(wordSelection.focus);
      }
    },
    [doc, setSelection, setCursorPosition]
  );

  // Handle triple click (select paragraph at the clicked position)
  const handleTripleClick = useCallback(
    (blockId: string, _clientX: number, _clientY: number) => {
      // Paragraph selection doesn't need offset — it selects the whole block
      const pos = { nodeId: blockId, offset: 0 };
      const paraSelection = selectParagraph(doc, pos);
      if (paraSelection) {
        setSelection(paraSelection);
        setCursorPosition(paraSelection.focus);
      }
    },
    [doc, setSelection, setCursorPosition]
  );

  /** Move cursor visually one line up or down using the caret API. */
  const moveCursorVisualLine = useCallback(
    (direction: 'up' | 'down') => {
      const { nodeId, offset } = cursor.position;
      if (!nodeId) return;

      const blockEl = document.querySelector(
        `[data-block-id="${nodeId}"]`
      ) as HTMLElement | null;
      if (!blockEl) return;

      const screenPos = getPointFromOffset(blockEl, offset);
      if (!screenPos) return;

      // Try multiple epsilons — the small one works for within-block
      // visual lines, the larger one skips past gaps (page numbers,
      // margins, footers) that block content sits behind.
      for (const eps of [1, 20]) {
        const newY =
          direction === 'up'
            ? screenPos.y - screenPos.height - eps
            : screenPos.y + screenPos.height + eps;

        const result = hitTest(screenPos.x, newY);
        // Only accept if the position actually changed — hitTest can return
        // the same block:offset when caretPositionFromPoint doesn't cross
        // the line boundary (stays within the same character's hit area).
        if (result && (result.blockId !== nodeId || result.offset !== offset)) {
          setCursorPosition({ nodeId: result.blockId, offset: result.offset });
          clearSelection();
          return;
        }
      }

      // Last-resort fallback: scan all data-block-id elements in the DOM
      // and jump to the nearest one in the pressed direction.
      const allBlocks = document.querySelectorAll('[data-block-id]');
      let bestId: string | null = null;
      let bestDist = Infinity;

      for (const block of allBlocks) {
        const rect = block.getBoundingClientRect();
        if (direction === 'down' && rect.top > screenPos.y + screenPos.height) {
          const dist = rect.top - (screenPos.y + screenPos.height);
          if (dist < bestDist) { bestDist = dist; bestId = block.getAttribute('data-block-id'); }
        }
        if (direction === 'up' && rect.bottom < screenPos.y) {
          const dist = screenPos.y - rect.bottom;
          if (dist < bestDist) { bestDist = dist; bestId = block.getAttribute('data-block-id'); }
        }
      }

      if (bestId) {
        setCursorPosition({ nodeId: bestId, offset: 0 });
        clearSelection();
      }
    },
    [cursor.position, setCursorPosition, clearSelection]
  );

  // Handle keyboard input
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const { nodeId, offset } = cursor.position;
      if (!nodeId) return;

      // During IME composition (dead keys, input methods), let the
      // browser handle key events naturally. We capture the final
      // composed text via onCompositionEnd.
      if (isComposingRef.current) return;

      const hasSelection = selection && !(
        selection.anchor.nodeId === selection.focus.nodeId &&
        selection.anchor.offset === selection.focus.offset
      );

      switch (e.key) {
        case 'ArrowRight': {
          e.preventDefault();
          if (e.shiftKey) {
            const newPos = moveCursorRight(doc, cursor);
            extendSelection(newPos.position);
            setCursorPosition(newPos.position);
          } else {
            const newPos = moveCursorRight(doc, cursor);
            setCursorPosition(newPos.position);
            clearSelection();
          }
          break;
        }

        case 'ArrowLeft': {
          e.preventDefault();
          if (e.shiftKey) {
            const newPos = moveCursorLeft(doc, cursor);
            extendSelection(newPos.position);
            setCursorPosition(newPos.position);
          } else {
            const newPos = moveCursorLeft(doc, cursor);
            setCursorPosition(newPos.position);
            clearSelection();
          }
          break;
        }

        case 'ArrowUp': {
          e.preventDefault();
          // ── Image block: move to previous block ──────────────
          const activeBlock = findNode(doc, cursor.position.nodeId);
          if (activeBlock?.type === 'image') {
            const prevBlock = getPreviousBlock(doc, cursor.position.nodeId);
            if (prevBlock) {
              const offset = (prevBlock.type === 'paragraph' || prevBlock.type === 'heading')
                ? getBlockText(prevBlock as any).length : 0;
              setCursorPosition({ nodeId: prevBlock.id, offset });
              clearSelection();
            }
            break;
          }
          if (e.shiftKey) {
            // Extend selection up
            const { nodeId, offset } = cursor.position;
            const blockEl = document.querySelector(
              `[data-block-id="${nodeId}"]`
            ) as HTMLElement | null;
            if (blockEl) {
              const screenPos = getPointFromOffset(blockEl, offset);
              if (screenPos) {
                for (const eps of [1, 20]) {
                  const newY = screenPos.y - screenPos.height - eps;
                  const result = hitTest(screenPos.x, newY);
                  if (result) {
                    extendSelection({ nodeId: result.blockId, offset: result.offset });
                    setCursorPosition({ nodeId: result.blockId, offset: result.offset });
                    break;
                  }
                }
              }
            }
          } else {
            moveCursorVisualLine('up');
          }
          break;
        }

        case 'ArrowDown': {
          e.preventDefault();
          // ── Image block: move to next block ──────────────────
          const activeBlockDown = findNode(doc, cursor.position.nodeId);
          if (activeBlockDown?.type === 'image') {
            const nextBlock = getNextBlock(doc, cursor.position.nodeId);
            if (nextBlock) {
              setCursorPosition({ nodeId: nextBlock.id, offset: 0 });
              clearSelection();
            }
            break;
          }
          if (e.shiftKey) {
            // Extend selection down
            const { nodeId, offset } = cursor.position;
            const blockEl = document.querySelector(
              `[data-block-id="${nodeId}"]`
            ) as HTMLElement | null;
            if (blockEl) {
              const screenPos = getPointFromOffset(blockEl, offset);
              if (screenPos) {
                for (const eps of [1, 20]) {
                  const newY = screenPos.y + screenPos.height + eps;
                  const result = hitTest(screenPos.x, newY);
                  if (result) {
                    extendSelection({ nodeId: result.blockId, offset: result.offset });
                    setCursorPosition({ nodeId: result.blockId, offset: result.offset });
                    break;
                  }
                }
              }
            }
          } else {
            const cursorBefore = { nodeId: cursor.position.nodeId, offset: cursor.position.offset };
            moveCursorVisualLine('down');
            // Check if we need to exit the table at the bottom
            const currentTableCtx = findTableCellContext(
              useDocumentStore.getState().document,
              cursorBefore.nodeId,
            );
            const newTableCtx = findTableCellContext(
              useDocumentStore.getState().document,
              cursor.position.nodeId,
            );
            if (currentTableCtx && currentTableCtx.rowIndex === currentTableCtx.table.rows.length - 1) {
              const stuckInTable = newTableCtx && newTableCtx.table.id === currentTableCtx.table.id
                && (cursor.position.nodeId === cursorBefore.nodeId
                    || newTableCtx.rowIndex <= currentTableCtx.rowIndex);
              const wentNowhere = cursor.position.nodeId === cursorBefore.nodeId
                && cursor.position.offset === cursorBefore.offset;
              if (stuckInTable || wentNowhere) {
                // Look for an existing paragraph after the table
                const doc = useDocumentStore.getState().document;
                const tableIdx = doc.children.findIndex((c) => c.id === currentTableCtx.table.id);
                let nextParaId: string | null = null;
                if (tableIdx >= 0 && tableIdx < doc.children.length - 1) {
                  const next = doc.children[tableIdx + 1];
                  if (next.type === 'paragraph' || next.type === 'heading') {
                    nextParaId = next.id;
                  }
                }
                if (nextParaId) {
                  setCursorPosition({ nodeId: nextParaId, offset: 0 });
                  clearSelection();
                } else {
                  const newParaId = insertBlock(currentTableCtx.table.id, 'paragraph');
                  if (newParaId) {
                    setCursorPosition({ nodeId: newParaId, offset: 0 });
                    clearSelection();
                  }
                }
              }
            }
          }
          break;
        }

        case 'PageDown': {
          e.preventDefault();
          const { nodeId: pdNodeId, offset: pdOffset } = cursor.position;
          const pdBlockEl = document.querySelector(
            `[data-block-id="${pdNodeId}"]`
          ) as HTMLElement | null;
          if (!pdBlockEl) break;

          const pdScreenPos = getPointFromOffset(pdBlockEl, pdOffset);
          if (!pdScreenPos) break;

          const pdPageSize = window.innerHeight * 0.9;
          // Try multiple epsilons to skip gaps (page numbers, margins, etc.)
          let pdResult: { blockId: string; offset: number } | null = null;
          for (const eps of [1, 20, 40]) {
            pdResult = hitTest(pdScreenPos.x, pdScreenPos.y + pdPageSize + eps);
            if (pdResult && (pdResult.blockId !== pdNodeId || pdResult.offset !== pdOffset)) break;
            pdResult = null;
          }

          if (pdResult) {
            if (e.shiftKey) {
              extendSelection({ nodeId: pdResult.blockId, offset: pdResult.offset });
            } else {
              clearSelection();
            }
            setCursorPosition({ nodeId: pdResult.blockId, offset: pdResult.offset });
          } else {
            // Fallback: go to last block
            const allBlocks = getBlockNodes(doc);
            if (allBlocks.length > 0) {
              const last = allBlocks[allBlocks.length - 1];
              const lastText = useDocumentStore.getState().getBlockText(last.id);
              if (e.shiftKey) {
                extendSelection({ nodeId: last.id, offset: lastText.length });
              } else {
                clearSelection();
              }
              setCursorPosition({ nodeId: last.id, offset: lastText.length });
            }
          }
          break;
        }

        case 'PageUp': {
          e.preventDefault();
          const { nodeId: puNodeId, offset: puOffset } = cursor.position;
          const puBlockEl = document.querySelector(
            `[data-block-id="${puNodeId}"]`
          ) as HTMLElement | null;
          if (!puBlockEl) break;

          const puScreenPos = getPointFromOffset(puBlockEl, puOffset);
          if (!puScreenPos) break;

          const puPageSize = window.innerHeight * 0.9;
          let puResult: { blockId: string; offset: number } | null = null;
          for (const eps of [1, 20, 40]) {
            puResult = hitTest(puScreenPos.x, puScreenPos.y - puPageSize - eps);
            if (puResult && (puResult.blockId !== puNodeId || puResult.offset !== puOffset)) break;
            puResult = null;
          }

          if (puResult) {
            if (e.shiftKey) {
              extendSelection({ nodeId: puResult.blockId, offset: puResult.offset });
            } else {
              clearSelection();
            }
            setCursorPosition({ nodeId: puResult.blockId, offset: puResult.offset });
          } else {
            // Fallback: go to first block
            const allBlocks = getBlockNodes(doc);
            if (allBlocks.length > 0) {
              const first = allBlocks[0];
              if (e.shiftKey) {
                extendSelection({ nodeId: first.id, offset: 0 });
              } else {
                clearSelection();
              }
              setCursorPosition({ nodeId: first.id, offset: 0 });
            }
          }
          break;
        }

        case 'Home': {
          e.preventDefault();
          if (e.shiftKey) {
            const newPos = moveCursorToLineStart(doc, cursor);
            extendSelection(newPos.position);
            setCursorPosition(newPos.position);
          } else {
            const newPos = moveCursorToLineStart(doc, cursor);
            setCursorPosition(newPos.position);
            clearSelection();
          }
          break;
        }

        case 'End': {
          e.preventDefault();
          if (e.shiftKey) {
            const newPos = moveCursorToLineEnd(doc, cursor);
            extendSelection(newPos.position);
            setCursorPosition(newPos.position);
          } else {
            const newPos = moveCursorToLineEnd(doc, cursor);
            setCursorPosition(newPos.position);
            clearSelection();
          }
          break;
        }

        case 'Backspace':
        case 'Delete': {
          e.preventDefault();

          if (hasSelection) {
            const result = deleteSelection(selection!);
            setCursorPosition(result.newCursorPosition);
            clearSelection();
            break;
          }

          // ── Image block: delete it ────────────────────────────
          const currentBlock = findNode(doc, nodeId);
          if (currentBlock?.type === 'image') {
            const prevBlock = getPreviousBlock(doc, nodeId);
            const nextBlock = getNextBlock(doc, nodeId);
            deleteBlock(nodeId);
            if (e.key === 'Backspace' && prevBlock) {
              const prevOffset = (prevBlock.type === 'paragraph' || prevBlock.type === 'heading')
                ? getBlockText(prevBlock as any).length : 0;
              setCursorPosition({ nodeId: prevBlock.id, offset: prevOffset });
            } else if (nextBlock) {
              setCursorPosition({ nodeId: nextBlock.id, offset: 0 });
            } else if (prevBlock) {
              const prevOffset = (prevBlock.type === 'paragraph' || prevBlock.type === 'heading')
                ? getBlockText(prevBlock as any).length : 0;
              setCursorPosition({ nodeId: prevBlock.id, offset: prevOffset });
            }
            clearSelection();
            break;
          }

          if (e.key === 'Delete') {
            // Original Delete key logic
            const block = findNode(doc, nodeId);
            const blockEnd = block && (block.type === 'paragraph' || block.type === 'heading')
              ? getBlockText(block).length : 0;
            if (offset >= blockEnd) {
              const result = mergeBlocks(nodeId);
              if (result) {
                setCursorPosition(result.newCursorPosition);
                clearSelection();
              } else {
                const nextBlock = getNextBlock(doc, nodeId);
                if (nextBlock) {
                  if (nextBlock.type === 'list') {
                    prependListToBlock(nodeId, nextBlock.id);
                  } else {
                    const nextListCtx = findListContext(doc, nextBlock.id);
                    if (nextListCtx) {
                      prependListToBlock(nodeId, nextListCtx.list.id);
                    }
                  }
                }
              }
            } else {
              deleteText(nodeId, offset, 'forward');
            }
            break;
          }

          // Backspace key logic
          if (offset === 0) {
            // Check if we're at the start of a paragraph inside a table cell
            const tableCtx = findTableCellContext(doc, nodeId);
            if (tableCtx) {
              if (tableCtx.paraIndex > 0) {
                // Check if current paragraph is empty → remove it
                const currText = getBlockText(tableCtx.cell.children[tableCtx.paraIndex] as Paragraph);
                if (currText === '') {
                  // Remove the empty paragraph and move cursor to end of previous
                  const fresh = cloneDocument(useDocumentStore.getState().document);
                  const ctx = findTableCellContext(fresh, nodeId);
                  if (ctx) {
                    ctx.cell.children.splice(ctx.paraIndex, 1);
                  }
                  useDocumentStore.setState({ document: fresh, isDirty: true });
                }
                const prevPara = tableCtx.cell.children[tableCtx.paraIndex - 1];
                const prevText = getBlockText(prevPara);
                setCursorPosition({ nodeId: prevPara.id, offset: prevText.length });
                clearSelection();
                break;
              } else if (tableCtx.colIndex > 0 || tableCtx.rowIndex > 0) {
                // First paragraph in cell → go to previous cell's last paragraph
                let prevRow = tableCtx.rowIndex;
                let prevCol = tableCtx.colIndex - 1;
                if (prevCol < 0) {
                  prevRow = tableCtx.rowIndex - 1;
                  prevCol = tableCtx.table.rows[prevRow].cells.length - 1;
                }
                const prevCell = tableCtx.table.rows[prevRow].cells[prevCol];
                const lastPara = prevCell.children[prevCell.children.length - 1];
                if (lastPara) {
                  const lastText = getBlockText(lastPara);
                  setCursorPosition({ nodeId: lastPara.id, offset: lastText.length });
                  clearSelection();
                  break;
                }
              }
              // First cell, first paragraph → do nothing
              break;
            }

            // Check if we're at the start of a paragraph inside a list
            const listCtx = findListContext(doc, nodeId);
            if (listCtx) {
              const block = findNode(doc, nodeId);
              const text = block && (block.type === 'paragraph' || block.type === 'heading')
                ? getBlockText(block as any) : '';
              const isEmpty = text === '' || text === '\u200B';

              if (isEmpty) {
                // Empty list item → remove it (or exit list if last item)
                if (listCtx.list.children.length <= 1) {
                  // Only item in list → convert list to paragraph
                  convertBlock(listCtx.list.id, 'paragraph');
                } else {
                  removeListItem(listCtx.list.id, listCtx.itemIndex);
                }
              } else if (listCtx.itemIndex > 0) {
                // Non-empty, not first item → merge with previous item
                const prevItem = listCtx.list.children[listCtx.itemIndex - 1];
                const prevPara = prevItem.children.find(
                  (c) => c.type === 'paragraph'
                ) as Paragraph | undefined;
                if (prevPara) {
                  // Move content to previous item, remove this item
                  const content = getBlockText(block as any);
                  const prevText = getBlockText(prevPara);
                  prevPara.children[0].content = prevText + content;
                  prevPara.children.splice(1);
                  removeListItem(listCtx.list.id, listCtx.itemIndex);
                  setCursorPosition({
                    nodeId: prevPara.id,
                    offset: prevText.length,
                  });
                  clearSelection();
                }
              } else {
                // First item with content → promote to paragraph (keeps content)
                convertBlock(listCtx.list.id, 'paragraph');
              }
            } else {
              // Check if previous block is the last paragraph inside a list
              const prevBlock = getPreviousBlock(doc, nodeId);
              if (prevBlock) {
                const prevListCtx = findListContext(doc, prevBlock.id);
                if (prevListCtx) {
                  // Previous block is inside a list — append this block to the list
                  appendBlockToList(nodeId, prevListCtx.list.id);
                } else if (prevBlock.type === 'paragraph' || prevBlock.type === 'heading') {
                  const result = mergeBlocks(prevBlock.id);
                  if (result) {
                    setCursorPosition(result.newCursorPosition);
                    clearSelection();
                  }
                }
              }
            }
          } else {
            deleteText(nodeId, offset, 'backward');
            // After backward delete, cursor must move back by 1
            const newOffset = offset - 1;
            const newDoc = useDocumentStore.getState().document;
            const clamped = clampCursor(newDoc, {
              position: { nodeId, offset: newOffset },
            });
            setCursorPosition(clamped.position);
          }
          break;
        }

        case 'Enter': {
          e.preventDefault();
          if (hasSelection) {
            const result = replaceSelection(selection!, '\n');
            setCursorPosition(result.newCursorPosition);
            clearSelection();
          } else {
            // Use fresh document from store to avoid stale closure
            const freshDoc = useDocumentStore.getState().document;
            const block = findNode(freshDoc, nodeId);
            const text = block && (block.type === 'paragraph' || block.type === 'heading')
              ? getBlockText(block as any) : '';

            // ── Image block: insert paragraph after ────────────
            if (block?.type === 'image') {
              const newParaId = insertBlock(nodeId, 'paragraph');
              if (newParaId) {
                setCursorPosition({ nodeId: newParaId, offset: 0 });
                clearSelection();
              }
              break;
            }

            // Check if cursor is on a paragraph inside a list
            const listCtx = findListContext(freshDoc, nodeId);
            const isEmpty = text === '' || text === '\u200B';

            if (listCtx && isEmpty) {
              // Empty item → exit the list (pass context directly so
              // exitList doesn't need to re-discover it from the clone)
              exitList(nodeId, listCtx.list.id, listCtx.itemIndex);
              // Ensure textarea stays focused so InlineCursor is visible
              // and keyboard input works after DOM mutation.
              if (document.activeElement !== textareaRef.current) {
                textareaRef.current?.focus({ preventScroll: true });
              }
              break;
            }
            const newBlockId = splitBlock(nodeId, offset);
            if (newBlockId) {
              setCursorPosition({ nodeId: newBlockId, offset: 0 });
            }
          }
          break;
        }

        case 'a': {
          if ((e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            const allBlocks = getBlockNodes(doc);
            if (allBlocks.length > 0) {
              const firstBlock = allBlocks[0];
              const lastBlock = allBlocks[allBlocks.length - 1];
              const lastText = useDocumentStore.getState().getBlockText(lastBlock.id);
              setSelection({
                anchor: { nodeId: firstBlock.id, offset: 0 },
                focus: { nodeId: lastBlock.id, offset: lastText.length },
              });
            }
          } else {
            e.preventDefault();
            if (hasSelection) {
              const result = replaceSelection(selection!, e.key);
              setCursorPosition(result.newCursorPosition);
              clearSelection();
            } else {
              insertText(nodeId, offset, e.key);
              setCursorPosition({ nodeId, offset: offset + 1 });
            }
          }
          break;
        }

        case 'c': {
          if ((e.ctrlKey || e.metaKey) && hasSelection) {
            e.preventDefault();
            const text = getSelectedText(doc, selection!);
            navigator.clipboard.writeText(text);
          } else {
            e.preventDefault();
            if (hasSelection) {
              const result = replaceSelection(selection!, e.key);
              setCursorPosition(result.newCursorPosition);
              clearSelection();
            } else {
              insertText(nodeId, offset, e.key);
              setCursorPosition({ nodeId, offset: offset + 1 });
            }
          }
          break;
        }

        case 'x': {
          if ((e.ctrlKey || e.metaKey) && hasSelection) {
            e.preventDefault();
            const text = getSelectedText(doc, selection!);
            navigator.clipboard.writeText(text);
            const result = deleteSelection(selection!);
            setCursorPosition(result.newCursorPosition);
            clearSelection();
          } else {
            e.preventDefault();
            if (hasSelection) {
              const result = replaceSelection(selection!, e.key);
              setCursorPosition(result.newCursorPosition);
              clearSelection();
            } else {
              insertText(nodeId, offset, e.key);
              setCursorPosition({ nodeId, offset: offset + 1 });
            }
          }
          break;
        }

        case 'v': {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            navigator.clipboard.readText().then((text) => {
              if (text) {
                if (hasSelection) {
                  const result = replaceSelection(selection!, text);
                  setCursorPosition(result.newCursorPosition);
                  clearSelection();
                } else {
                  insertText(nodeId, offset, text);
                  setCursorPosition({ nodeId, offset: offset + text.length });
                }
              }
            });
          } else {
            e.preventDefault();
            if (hasSelection) {
              const result = replaceSelection(selection!, e.key);
              setCursorPosition(result.newCursorPosition);
              clearSelection();
            } else {
              insertText(nodeId, offset, e.key);
              setCursorPosition({ nodeId, offset: offset + 1 });
            }
          }
          break;
        }

        case 'z': {
          if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
            e.preventDefault();
            const result = undo();
            if (result) {
              setCursorPosition(result.newCursorPosition);
              clearSelection();
            }
          } else if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
            e.preventDefault();
            const result = redo();
            if (result) {
              setCursorPosition(result.newCursorPosition);
              clearSelection();
            }
          } else {
            e.preventDefault();
            if (hasSelection) {
              const result = replaceSelection(selection!, e.key);
              setCursorPosition(result.newCursorPosition);
              clearSelection();
            } else {
              insertText(nodeId, offset, e.key);
              setCursorPosition({ nodeId, offset: offset + 1 });
            }
          }
          break;
        }

        case 'b': {
          if ((e.ctrlKey || e.metaKey) && hasSelection) {
            e.preventDefault();
            const { start, end } = getSelectionRange(selection!, doc);
            toggleMark(start.nodeId, start.offset, end.offset, 'bold', end.nodeId);
            clearSelection();
            setCursorPosition(end);
          } else {
            e.preventDefault();
            if (hasSelection) {
              const result = replaceSelection(selection!, e.key);
              setCursorPosition(result.newCursorPosition);
              clearSelection();
            } else {
              insertText(nodeId, offset, e.key);
              setCursorPosition({ nodeId, offset: offset + 1 });
            }
          }
          break;
        }

        case 'i': {
          if ((e.ctrlKey || e.metaKey) && hasSelection) {
            e.preventDefault();
            const { start, end } = getSelectionRange(selection!, doc);
            toggleMark(start.nodeId, start.offset, end.offset, 'italic', end.nodeId);
            clearSelection();
            setCursorPosition(end);
          } else {
            e.preventDefault();
            if (hasSelection) {
              const result = replaceSelection(selection!, e.key);
              setCursorPosition(result.newCursorPosition);
              clearSelection();
            } else {
              insertText(nodeId, offset, e.key);
              setCursorPosition({ nodeId, offset: offset + 1 });
            }
          }
          break;
        }

        case 'k': {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (hasSelection) {
              // Open link popup with the selection range
              const { start, end } = getSelectionRange(selection!, doc);
              activateLinkPopup({
                blockId: start.nodeId,
                startOffset: start.offset,
                endOffset: end.offset,
              });
            } else {
              // No selection — check if cursor is inside a link
              const block = findNode(doc, nodeId);
              if (block && (block.type === 'paragraph' || block.type === 'heading')) {
                const textBlock = block as ParagraphType | HeadingType;
                let accumulated = 0;
                for (const run of textBlock.children) {
                  if (offset < accumulated + run.content.length) {
                    // Cursor is inside this run
                    if (run.href && run.marks.includes('link')) {
                      // Remove the link
                      removeLink(block.id, accumulated, accumulated + run.content.length);
                    }
                    break;
                  }
                  accumulated += run.content.length;
                }
              }
            }
          } else {
            e.preventDefault();
            if (hasSelection) {
              const result = replaceSelection(selection!, e.key);
              setCursorPosition(result.newCursorPosition);
              clearSelection();
            } else {
              insertText(nodeId, offset, e.key);
              setCursorPosition({ nodeId, offset: offset + 1 });
            }
          }
          break;
        }

        case 'u': {
          if ((e.ctrlKey || e.metaKey) && hasSelection) {
            e.preventDefault();
            const { start, end } = getSelectionRange(selection!, doc);
            toggleMark(start.nodeId, start.offset, end.offset, 'underline', end.nodeId);
            clearSelection();
            setCursorPosition(end);
          } else {
            e.preventDefault();
            if (hasSelection) {
              const result = replaceSelection(selection!, e.key);
              setCursorPosition(result.newCursorPosition);
              clearSelection();
            } else {
              insertText(nodeId, offset, e.key);
              setCursorPosition({ nodeId, offset: offset + 1 });
            }
          }
          break;
        }

        case 's': {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            saveDocument().catch(() => {});
          } else {
            e.preventDefault();
            if (hasSelection) {
              const result = replaceSelection(selection!, e.key);
              setCursorPosition(result.newCursorPosition);
              clearSelection();
            } else {
              insertText(nodeId, offset, e.key);
              setCursorPosition({ nodeId, offset: offset + 1 });
            }
          }
          break;
        }

        case 'Tab': {
          e.preventDefault();

          // Check if cursor is inside a table cell → navigate cells
          const freshDoc = useDocumentStore.getState().document;
          const tableCtx = findTableContext(freshDoc, nodeId);
          if (tableCtx) {
            const { table, rowIndex, colIndex } = tableCtx;
            let nextRow = rowIndex;
            let nextCol = colIndex;

            if (e.shiftKey) {
              // Shift+Tab: previous cell
              if (colIndex > 0) {
                nextCol = colIndex - 1;
              } else if (rowIndex > 0) {
                nextRow = rowIndex - 1;
                nextCol = table.rows[nextRow].cells.length - 1;
              } else {
                break; // First cell, do nothing
              }
            } else {
              // Tab: next cell
              if (colIndex < table.rows[rowIndex].cells.length - 1) {
                nextCol = colIndex + 1;
              } else if (rowIndex < table.rows.length - 1) {
                nextRow = rowIndex + 1;
                nextCol = 0;
              } else {
                // Last cell → exit table by inserting a new paragraph after it
                const newParaId = insertBlock(table.id, 'paragraph');
                if (newParaId) {
                  setCursorPosition({ nodeId: newParaId, offset: 0 });
                  clearSelection();
                }
                break;
              }
            }

            const targetCell = table.rows[nextRow].cells[nextCol];
            const firstPara = targetCell.children[0];
            if (firstPara) {
              setCursorPosition({ nodeId: firstPara.id, offset: 0 });
              clearSelection();
            }
            break;
          }

          // Not in a table: insert 4 spaces
          const indent = '    ';
          if (hasSelection) {
            const result = replaceSelection(selection!, indent);
            setCursorPosition(result.newCursorPosition);
            clearSelection();
          } else {
            insertText(nodeId, offset, indent);
            setCursorPosition({ nodeId, offset: offset + indent.length });
          }
          break;
        }

        default: {
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            if (hasSelection) {
              const result = replaceSelection(selection!, e.key);
              setCursorPosition(result.newCursorPosition);
              clearSelection();
            } else {
              insertText(nodeId, offset, e.key);
              setCursorPosition({ nodeId, offset: offset + 1 });
            }
          }
          break;
        }
      }
    },
    [
      cursor, doc, selection,
      saveDocument, insertBlock, deleteBlock, insertText, deleteText, splitBlock, mergeBlocks,
      deleteSelection, replaceSelection, toggleMark, setLink, removeLink,
      undo, redo, activateLinkPopup, deactivateLinkPopup,
      setCursorPosition, setSelection, clearSelection, extendSelection,
      moveCursorVisualLine,
    ]
  );

  // Set initial cursor position
  useEffect(() => {
    if (blocks.length > 0 && !cursor.position.nodeId) {
      setCursorPosition({ nodeId: blocks[0].id, offset: 0 });
    }
  }, [blocks, cursor.position.nodeId, setCursorPosition]);

  // When a table is selected, listen for Delete/Backspace on the document
  // to delete the entire table, regardless of textarea focus.
  useEffect(() => {
    if (!selectedTableId) return;

    const handleTableDelete = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        // Capture surrounding blocks BEFORE deleting
        const doc = useDocumentStore.getState().document;
        const nextBlock = getNextBlock(doc, selectedTableId);
        const prevBlock = getPreviousBlock(doc, selectedTableId);

        useEditorStore.getState().selectTable(null);
        useDocumentStore.getState().deleteBlock(selectedTableId);

        // Move cursor to the next or previous block
        if (nextBlock) {
          useEditorStore.getState().setCursorPosition({ nodeId: nextBlock.id, offset: 0 });
        } else if (prevBlock) {
          const prevOffset = (prevBlock.type === 'paragraph' || prevBlock.type === 'heading')
            ? getBlockText(prevBlock as any).length : 0;
          useEditorStore.getState().setCursorPosition({ nodeId: prevBlock.id, offset: prevOffset });
        }
        useEditorStore.getState().clearSelection();
        // Re-focus the textarea so keyboard events (Ctrl+Z, etc.) work
        textareaRef.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', handleTableDelete, true);
    return () => document.removeEventListener('keydown', handleTableDelete, true);
  }, [selectedTableId]);

  // Calculate layout when document changes (main thread for reliability)
  useEffect(() => {
    try {
      calculateLayout(doc);
    } catch (e) {
      console.error('Layout error:', e);
    }
  }, [doc, calculateLayout]);

  // Calculate pagination when layout changes
  useEffect(() => {
    if (layout) {
      paginate(layout);
    }
  }, [layout, paginate]);

  // Auto-scroll to keep cursor visible — when the cursor moves to a block
  // that's outside the viewport, scroll it into view. Uses rAF to wait for
  // layout after state changes without forcing a synchronous reflow.
  useEffect(() => {
    const { nodeId } = cursor.position;
    if (!nodeId || !focused) return;

    const raf = requestAnimationFrame(() => {
      const blockEl = document.querySelector(
        `[data-block-id="${nodeId}"]`
      ) as HTMLElement | null;
      if (!blockEl) return;

      const rect = blockEl.getBoundingClientRect();
      // Only scroll if the block is mostly outside the viewport
      if (rect.top > window.innerHeight - 20 || rect.bottom < 20) {
        blockEl.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      }
    });

    return () => cancelAnimationFrame(raf);
  }, [cursor.position, focused]);

  // Sync browser native selection to editor state — without this, text
  // selected by mouse drag is invisible to the toolbar and keyboard
  // shortcuts (Ctrl+B, etc.), because the editor's `selection` in
  // Zustand never gets updated for mouse interactions.
  // NOTE: When dragState.current is set, we're handling selection via
  // our own mousemove handler — ignore browser selectionchange events
  // to avoid interference between the two.
  useEffect(() => {
    const handler = () => {
      if (dragState.current || justFinishedDrag.current) return;
      const sel = window.getSelection();
      if (!sel) return;

      const anchorPos = sel.anchorNode
        ? nodeToLogicalPosition(sel.anchorNode, sel.anchorOffset)
        : null;
      if (!anchorPos) return;

      const doc = useDocumentStore.getState().document;
      const clampedAnchor = clampCursor(doc, { position: anchorPos }).position;

      if (sel.isCollapsed) {
        setCursorPosition(clampedAnchor);
        clearSelection();
      } else {
        const focusPos = sel.focusNode
          ? nodeToLogicalPosition(sel.focusNode, sel.focusOffset)
          : null;
        if (!focusPos) return;

        const clampedFocus = clampCursor(doc, { position: focusPos }).position;
        setSelection({ anchor: clampedAnchor, focus: clampedFocus });
        setCursorPosition(clampedFocus);

        sel.removeAllRanges();
      }
    };

    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, [setCursorPosition, setSelection, clearSelection]);

  return (
    <div
      className="editor"
      ref={containerRef}
      onMouseDown={() => useEditorStore.getState().selectTable(null)}
    >
      <Toolbar onBack={onBack} />

      {/* Hidden textarea for keyboard input */}
      <textarea
        ref={textareaRef}
        className="hidden-textarea"
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPaste={(e) => {
          const items = e.clipboardData?.items;
          const files = e.clipboardData?.files;

          // Check clipboardData.files for images
          if (files && files.length > 0) {
            const imgFile = Array.from(files).find((f) => f.type.startsWith('image/'));
            if (imgFile) {
              e.preventDefault();
              uploadAndInsertImage(imgFile).catch((err: Error) => alert(err.message));
              return;
            }
          }

          // Check clipboardData.items (Chromium) for images
          if (items && items.length > 0) {
            for (const item of Array.from(items)) {
              if (item.type.startsWith('image/')) {
                e.preventDefault();
                const blob = item.getAsFile();
                if (blob) {
                  uploadAndInsertImage(blob).catch((err: Error) => alert(err.message));
                  return;
                }
              }
            }
          }
          // Fall through — the keydown Ctrl+V handler will handle text paste
        }}
        onCompositionStart={() => { isComposingRef.current = true; }}
        onCompositionEnd={(e) => {
          isComposingRef.current = false;
          const text = e.data;
          if (!text || !cursor.position.nodeId) return;

          const { nodeId, offset } = cursor.position;
          const hasSel = selection && !isSelectionEmpty(selection);
          if (hasSel) {
            const result = replaceSelection(selection!, text);
            setCursorPosition(result.newCursorPosition);
            clearSelection();
          } else {
            insertText(nodeId, offset, text);
            setCursorPosition({ nodeId, offset: offset + text.length });
          }
        }}
        autoFocus
      />

      <DocumentView
        blocks={blocks}
        activeBlockId={activeBlockId}
        onBlockMouseDown={handleBlockMouseDown}
        onBlockClick={handleBlockClick}
        onDoubleClick={handleDoubleClick}
        onTripleClick={handleTripleClick}
      />

      <SelectionOverlay />
    </div>
  );
}
