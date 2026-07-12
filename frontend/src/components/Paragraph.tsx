import type { Paragraph as ParagraphType, Heading as HeadingType } from '../core/types';
import { TextRun } from './TextRun';
import { useEditorStore } from '../stores/editor-store';
import { useRef, useLayoutEffect, useState } from 'react';

type BlockClickHandler = (blockId: string, clientX: number, clientY: number) => void;

interface ParagraphProps {
  block: ParagraphType | HeadingType;
  isActive: boolean;
  onBlockClick: BlockClickHandler;
  onDoubleClick: BlockClickHandler;
  onTripleClick: BlockClickHandler;
}

export function Paragraph({ block, isActive, onBlockClick, onDoubleClick, onTripleClick }: ParagraphProps) {
  const selection = useEditorStore((s) => s.selection);
  const cursor = useEditorStore((s) => s.cursor);
  const focused = useEditorStore((s) => s.focused);
  const paraRef = useRef<HTMLElement>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number; h: number } | null>(null);

  const className = `paragraph ${isActive ? 'active' : ''} ${block.type === 'heading' ? `heading-${(block as HeadingType).level}` : ''}`;

  // Check if this block has selected text
  const hasSelection = selection && (
    selection.anchor.nodeId === block.id || selection.focus.nodeId === block.id
  );

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
      {block.children.map((run) => (
        <TextRun
          key={run.id}
          run={run}
          selection={hasSelection ? selection : null}
          blockId={block.id}
        />
      ))}
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
