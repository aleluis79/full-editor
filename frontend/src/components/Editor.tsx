import { useCallback, useEffect, useRef } from 'react';
import { useDocumentStore } from '../stores/document-store';
import { useEditorStore } from '../stores/editor-store';
import { useLayoutStore } from '../stores/layout-store';
import { usePageStore } from '../stores/page-store';
import { getBlockNodes, getPreviousBlock, getBlockText, findNode } from '../core/document';
import {
  moveCursorRight,
  moveCursorLeft,
  moveCursorToLineStart,
  moveCursorToLineEnd,
  clampCursor,
} from '../core/cursor';
import { selectWord, selectParagraph, getSelectedText, getSelectionRange } from '../core/selection';
import { getOffsetFromPoint, getPointFromOffset, hitTest, nodeToLogicalPosition } from '../core/interaction';
import { DocumentView } from './DocumentView';
import { CursorOverlay } from './Cursor';
import { SelectionOverlay } from './SelectionOverlay';
import { Toolbar } from './Toolbar';

export function Editor() {
  const doc = useDocumentStore((s) => s.document);
  const insertText = useDocumentStore((s) => s.insertText);
  const deleteText = useDocumentStore((s) => s.deleteText);
  const splitBlock = useDocumentStore((s) => s.splitBlock);
  const deleteSelection = useDocumentStore((s) => s.deleteSelection);
  const replaceSelection = useDocumentStore((s) => s.replaceSelection);
  const toggleMark = useDocumentStore((s) => s.toggleMark);
  const undo = useDocumentStore((s) => s.undo);
  const redo = useDocumentStore((s) => s.redo);
  const mergeBlocks = useDocumentStore((s) => s.mergeBlocks);

  const cursor = useEditorStore((s) => s.cursor);
  const selection = useEditorStore((s) => s.selection);
  const setCursorPosition = useEditorStore((s) => s.setCursorPosition);
  const setSelection = useEditorStore((s) => s.setSelection);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const extendSelection = useEditorStore((s) => s.extendSelection);
  const setFocused = useEditorStore((s) => s.setFocused);

  const calculateLayout = useLayoutStore((s) => s.calculateLayout);
  const layout = useLayoutStore((s) => s.layout);
  const paginate = usePageStore((s) => s.paginate);

  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const blocks = getBlockNodes(doc);
  const activeBlockId = cursor.position.nodeId || blocks[0]?.id || null;

  // Focus the hidden textarea when clicking on the editor, and position
  // the cursor at the exact clicked character.
  const handleBlockClick = useCallback(
    (blockId: string, clientX: number, clientY: number) => {
      // If the browser has a non-collapsed native selection, the user
      // just finished a drag-select. Don't steal the selection by
      // focusing the textarea — the blue highlight would disappear.
      const nativeSel = window.getSelection();
      if (nativeSel && !nativeSel.isCollapsed) return;

      const blockEl = document.querySelector(
        `[data-block-id="${blockId}"]`
      ) as HTMLElement | null;
      if (blockEl) {
        const offset = getOffsetFromPoint(blockEl, clientX, clientY);
        setCursorPosition({ nodeId: blockId, offset });
      } else {
        setCursorPosition({ nodeId: blockId, offset: 0 });
      }
      clearSelection();
      textareaRef.current?.focus();
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
            moveCursorVisualLine('down');
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

        case 'Backspace': {
          e.preventDefault();
          if (hasSelection) {
            const result = deleteSelection(selection!);
            setCursorPosition(result.newCursorPosition);
            clearSelection();
          } else if (offset === 0) {
            // At start of block → merge with previous block
            const prevBlock = getPreviousBlock(doc, nodeId);
            if (prevBlock && (prevBlock.type === 'paragraph' || prevBlock.type === 'heading')) {
              const result = mergeBlocks(prevBlock.id);
              if (result) {
                setCursorPosition(result.newCursorPosition);
                clearSelection();
              }
            }
          } else {
            deleteText(nodeId, offset, 'backward');
            // After backward delete, cursor must move back by 1: the
            // character at offset-1 was removed, so the cursor goes
            // to the deleted character's position. clampCursor does
            // NOT shift the offset — it only caps it to text length,
            // which keeps the cursor one position too far right.
            const newOffset = offset - 1;
            const newDoc = useDocumentStore.getState().document;
            const clamped = clampCursor(newDoc, {
              position: { nodeId, offset: newOffset },
            });
            setCursorPosition(clamped.position);
          }
          break;
        }

        case 'Delete': {
          e.preventDefault();
          if (hasSelection) {
            const result = deleteSelection(selection!);
            setCursorPosition(result.newCursorPosition);
            clearSelection();
          } else {
            const block = findNode(doc, nodeId);
            const blockEnd = block && (block.type === 'paragraph' || block.type === 'heading')
              ? getBlockText(block).length : 0;
            if (offset >= blockEnd) {
              // At end of block → merge with next block
              const result = mergeBlocks(nodeId);
              if (result) {
                setCursorPosition(result.newCursorPosition);
                clearSelection();
              }
            } else {
              deleteText(nodeId, offset, 'forward');
            }
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
            const { start, end } = getSelectionRange(selection!);
            toggleMark(start.nodeId, start.offset, end.offset, 'bold');
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
            const { start, end } = getSelectionRange(selection!);
            toggleMark(start.nodeId, start.offset, end.offset, 'italic');
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
            const { start, end } = getSelectionRange(selection!);
            toggleMark(start.nodeId, start.offset, end.offset, 'underline');
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
      insertText, deleteText, splitBlock, mergeBlocks,
      deleteSelection, replaceSelection, toggleMark,
      undo, redo,
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

  // Sync browser native selection to editor state — without this, text
  // selected by mouse drag is invisible to the toolbar and keyboard
  // shortcuts (Ctrl+B, etc.), because the editor's `selection` in
  // Zustand never gets updated for mouse interactions.
  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection();
      if (!sel) return;

      // Ignore selections outside the editor blocks
      const anchorPos = sel.anchorNode
        ? nodeToLogicalPosition(sel.anchorNode, sel.anchorOffset)
        : null;
      if (!anchorPos) return;

      // Clamp to document model — the DOM may have \u200B placeholders
      // that inflate offsets beyond the actual text content.
      const doc = useDocumentStore.getState().document;
      const clampedAnchor = clampCursor(doc, { position: anchorPos }).position;

      if (sel.isCollapsed) {
        // Pure cursor movement — update cursor position only
        setCursorPosition(clampedAnchor);
        clearSelection();
      } else {
        // Real selection — update both cursor and selection
        const focusPos = sel.focusNode
          ? nodeToLogicalPosition(sel.focusNode, sel.focusOffset)
          : null;
        if (!focusPos) return;

        const clampedFocus = clampCursor(doc, { position: focusPos }).position;
        setSelection({ anchor: clampedAnchor, focus: clampedFocus });
        setCursorPosition(clampedFocus);
      }
    };

    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, [setCursorPosition, setSelection, clearSelection]);

  return (
    <div className="editor" ref={containerRef}>
      <Toolbar />

      {/* Hidden textarea for keyboard input */}
      <textarea
        ref={textareaRef}
        className="hidden-textarea"
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus
      />

      <DocumentView
        blocks={blocks}
        activeBlockId={activeBlockId}
        onBlockClick={handleBlockClick}
        onDoubleClick={handleDoubleClick}
        onTripleClick={handleTripleClick}
      />

      <CursorOverlay />
      <SelectionOverlay />
    </div>
  );
}
