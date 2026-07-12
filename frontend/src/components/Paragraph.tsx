import type { Paragraph as ParagraphType, Heading as HeadingType } from '../core/types';
import { TextRun } from './TextRun';
import { useEditorStore } from '../stores/editor-store';
import { useDocumentStore } from '../stores/document-store';
import { useRef, useLayoutEffect, useState } from 'react';
import { getBlockNodes } from '../core/document';

type BlockClickHandler = (blockId: string, clientX: number, clientY: number) => void;
type BlockMouseDownHandler = (blockId: string, e: React.MouseEvent) => void;

interface ParagraphProps {
  block: ParagraphType | HeadingType;
  isActive: boolean;
  onBlockClick: BlockClickHandler;
  onDoubleClick: BlockClickHandler;
  onTripleClick: BlockClickHandler;
  onMouseDown?: BlockMouseDownHandler;
}

export function Paragraph({ block, isActive, onBlockClick, onDoubleClick, onTripleClick, onMouseDown }: ParagraphProps) {
  const selection = useEditorStore((s) => s.selection);
  const cursor = useEditorStore((s) => s.cursor);
  const focused = useEditorStore((s) => s.focused);
  const paraRef = useRef<HTMLElement>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number; h: number } | null>(null);

  const className = `paragraph ${isActive ? 'active' : ''} ${block.type === 'heading' ? `heading-${(block as HeadingType).level}` : ''}`;

  // Compute effective selection range for THIS block only.
  const blockLen = block.children.reduce((s, r) => s + r.content.length, 0);
  let effectiveSelection: typeof selection = null;

  if (selection) {
    const aIn = selection.anchor.nodeId === block.id;
    const fIn = selection.focus.nodeId === block.id;

    if (aIn && fIn) {
      // Both ends in this block — pass as-is (TextRun handles ordering)
      effectiveSelection = selection;
    } else if (aIn || fIn) {
      // One end in this block. Determine direction from document order
      // so backward selections (bottom→top) render the correct half.
      const doc = useDocumentStore.getState().document;
      const blocks = getBlockNodes(doc);
      const anchorIdx = blocks.findIndex((b) => b.id === selection.anchor.nodeId);
      const focusIdx = blocks.findIndex((b) => b.id === selection.focus.nodeId);
      const isForward = anchorIdx >= 0 && focusIdx >= 0 && anchorIdx <= focusIdx;

      if (aIn) {
        // Anchor in this block
        effectiveSelection = isForward
          ? { anchor: selection.anchor, focus: { nodeId: block.id, offset: blockLen } }
          : { anchor: { nodeId: block.id, offset: 0 }, focus: selection.anchor };
      } else {
        // Focus in this block
        effectiveSelection = isForward
          ? { anchor: { nodeId: block.id, offset: 0 }, focus: selection.focus }
          : { anchor: selection.focus, focus: { nodeId: block.id, offset: blockLen } };
      }
    } else {
      // Neither end in this block. Check if it's a middle block (between
      // anchor and focus in document order) or outside the selection.
      const doc = useDocumentStore.getState().document;
      const blocks = getBlockNodes(doc);
      const anchorIdx = blocks.findIndex((b) => b.id === selection.anchor.nodeId);
      const focusIdx = blocks.findIndex((b) => b.id === selection.focus.nodeId);
      const thisIdx = blocks.findIndex((b) => b.id === block.id);

      if (
        anchorIdx >= 0 && focusIdx >= 0 && thisIdx >= 0 &&
        thisIdx > Math.min(anchorIdx, focusIdx) &&
        thisIdx < Math.max(anchorIdx, focusIdx)
      ) {
        // Middle block in multi-block selection — entire block selected
        effectiveSelection = {
          anchor: { nodeId: block.id, offset: 0 },
          focus: { nodeId: block.id, offset: blockLen },
        };
      }
      // else: block is outside the selection — leave as null
    }
  }

  const hasSelection = effectiveSelection !== null;

  // Compute cursor screen position using the caret API when this block is active
  const showCursor = focused && !hasSelection && cursor.position.nodeId === block.id;
  useLayoutEffect(() => {
    if (!showCursor || !paraRef.current) {
      setCursorPos(null);
      return;
    }
    const el = paraRef.current;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let charIndex = 0;
    let textNode: Text | null;
    while ((textNode = walker.nextNode() as Text | null)) {
      const nodeLen = textNode.length;
      if (charIndex + nodeLen >= cursor.position.offset) {
        const localOffset = Math.min(cursor.position.offset - charIndex, nodeLen);
        const range = document.createRange();
        range.setStart(textNode, localOffset);
        range.collapse(true);
        const rect = range.getBoundingClientRect();
        const parentRect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height > 0) {
          setCursorPos({ x: rect.left - parentRect.left, y: rect.top - parentRect.top, h: rect.height });
        } else {
          // Fallback: use first character's position
          setCursorPos({ x: parentRect.left > 0 ? 0 : 0, y: 0, h: rect.height || 24 });
        }
        return;
      }
      charIndex += nodeLen;
    }
    // Past end of text — cursor at end
    const lastChild = el.lastChild;
    if (lastChild) {
      const range = document.createRange();
      range.setStartAfter(lastChild);
      range.collapse(true);
      const rect = range.getBoundingClientRect();
      const parentRect = el.getBoundingClientRect();
      setCursorPos({ x: Math.max(0, rect.left - parentRect.left), y: Math.max(0, rect.top - parentRect.top), h: rect.height || 24 });
    } else {
      setCursorPos({ x: 0, y: 0, h: 24 });
    }
  }, [showCursor, cursor.position.offset, cursor.position.nodeId, block.id]);

  const content = (
    <>
      {(() => {
        let globalOffset = 0;
        return block.children.map((run) => {
          const runLen = run.content.length;
          const runStart = globalOffset;
          const runEnd = runStart + runLen;
          globalOffset += runLen;
          return (
            <TextRun
              key={run.id}
              run={run}
              selection={effectiveSelection}
              blockId={block.id}
              runGlobalOffset={runStart}
            />
          );
        });
      })()}
      {block.children.length === 0 && <br />}
      {showCursor && cursorPos && (
        <span
          className="editor-cursor-inline"
          style={{
            position: 'absolute',
            left: cursorPos.x,
            top: cursorPos.y,
            height: cursorPos.h,
          }}
        />
      )}
    </>
  );

  if (block.type === 'heading') {
    const level = (block as HeadingType).level;
    const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    return (
      <Tag
        ref={paraRef}
        className={className}
        data-block-id={block.id}
        onMouseDown={(e) => onMouseDown?.(block.id, e)}
        onClick={(e) => onBlockClick(block.id, e.clientX, e.clientY)}
        onDoubleClick={(e) => onDoubleClick(block.id, e.clientX, e.clientY)}
        onMouseUp={(e) => {
          if (e.detail === 3) {
            onTripleClick(block.id, e.clientX, e.clientY);
          }
        }}
      >
        {content}
      </Tag>
    );
  }

  return (
    <p
      ref={paraRef}
      className={className}
      data-block-id={block.id}
      onMouseDown={(e) => onMouseDown?.(block.id, e)}
      onClick={(e) => onBlockClick(block.id, e.clientX, e.clientY)}
      onDoubleClick={(e) => onDoubleClick(block.id, e.clientX, e.clientY)}
      onMouseUp={(e) => {
        if (e.detail === 3) {
          onTripleClick(block.id, e.clientX, e.clientY);
        }
      }}
    >
      {content}
    </p>
  );
}
