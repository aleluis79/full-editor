import { useRef, useEffect, useState, useCallback } from 'react';
import type { BlockNode, Paragraph, Heading, List, Blockquote, HorizontalRule, Image, Table } from '../core/types';
import type { BlockLayout } from '../core/layout/types';
import type { Page as PageType, HeaderFooterConfig } from '../core/pagination/types';
import { useDocumentStore } from '../stores/document-store';
import { useLayoutStore } from '../stores/layout-store';
import { usePageStore } from '../stores/page-store';
import { useEditorStore } from '../stores/editor-store';
import { getBlockNodes } from '../core/document';
import { ListBlock } from './ListBlock';
import { BlockquoteBlock } from './BlockquoteBlock';
import { HorizontalRuleBlock } from './HorizontalRuleBlock';
import { ImageBlock } from './ImageBlock';
import { TableBlock } from './TableBlock';

interface DocumentViewProps {
  blocks: BlockNode[];
  activeBlockId: string | null;
  onBlockClick: (blockId: string, clientX: number, clientY: number) => void;
  onDoubleClick: (blockId: string, clientX: number, clientY: number) => void;
  onTripleClick: (blockId: string, clientX: number, clientY: number) => void;
}

export function DocumentView({ blocks: _blocks, activeBlockId, onBlockClick, onDoubleClick, onTripleClick }: DocumentViewProps) {
  // Subscribe directly to document store for reactivity
  const doc = useDocumentStore((s) => s.document);
  const blocks = getBlockNodes(doc);
  const pages = usePageStore((s) => s.pages);
  const config = usePageStore((s) => s.config);
  const getBlockLayout = useLayoutStore((s) => s.getBlockLayout);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 10 });

  // Handle scroll for virtualization
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop, clientHeight } = containerRef.current;
    const pageHeight = pages[0]?.height ?? 841.89;
    const gap = 20; // Gap between pages in pixels

    const startPage = Math.max(0, Math.floor(scrollTop / (pageHeight + gap)) - 1);
    const endPage = Math.min(
      pages.length,
      Math.ceil((scrollTop + clientHeight) / (pageHeight + gap)) + 1
    );

    setVisibleRange({ start: startPage, end: endPage });
  }, [pages]);

  useEffect(() => {
    handleScroll();
  }, [handleScroll, pages]);

  // If no pages, render blocks directly (fallback)
  if (pages.length === 0) {
    return (
      <div className="document-view" ref={containerRef}>
        <div className="page" style={{ position: 'relative' }}>
          <div className="page-content" style={{ position: 'relative' }}>
            {blocks.map((block) => renderBlock(block, activeBlockId, onBlockClick, onDoubleClick, onTripleClick, getBlockLayout))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="document-view" ref={containerRef} onScroll={handleScroll}>
      {pages.map((page, pageIndex) => (
        <PageRenderer
          key={pageIndex}
          page={page}
          blocks={blocks}
          activeBlockId={activeBlockId}
          onBlockClick={onBlockClick}
          onDoubleClick={onDoubleClick}
          onTripleClick={onTripleClick}
          getBlockLayout={getBlockLayout}
          headerFooter={config.headerFooter}
          isVirtualized={pageIndex < visibleRange.start || pageIndex >= visibleRange.end}
        />
      ))}
    </div>
  );
}

interface PageRendererProps {
  page: PageType;
  blocks: BlockNode[];
  activeBlockId: string | null;
  onBlockClick: BlockClickHandler;
  onDoubleClick: BlockClickHandler;
  onTripleClick: BlockClickHandler;
  getBlockLayout: (blockId: string) => BlockLayout | undefined;
  headerFooter: HeaderFooterConfig;
  isVirtualized: boolean;
}

function PageRenderer({ page, blocks, activeBlockId, onBlockClick, onDoubleClick, onTripleClick, getBlockLayout: _getBlockLayout, headerFooter, isVirtualized }: PageRendererProps) {
  if (isVirtualized) {
    // Render placeholder with correct height
    return (
      <div
        className="page page-virtualized"
        style={{
          width: page.width,
          height: page.height,
          marginBottom: 20,
        }}
      />
    );
  }

  return (
    <div
      className="page"
      style={{
        width: page.width,
        height: page.height,
        position: 'relative',
        marginBottom: 20,
        background: 'white',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Header */}
      {headerFooter.enabled && page.headerArea && !(headerFooter.firstPageDifferent && page.index === 0) && (
        <div
          className="page-header"
          style={{
            position: 'absolute',
            top: page.headerArea.y,
            left: page.headerArea.x,
            width: page.headerArea.width,
            height: page.headerArea.height,
            borderBottom: '1px solid #eee',
            fontSize: 12,
            color: '#666',
          }}
        >
          {renderHeaderFooterContent(headerFooter.header.runs)}
        </div>
      )}

      {/* Content */}
      <div
        className="page-content"
        style={{
          position: 'absolute',
          top: page.contentArea.y,
          left: page.contentArea.x,
          width: page.contentArea.width,
          height: page.contentArea.height,
        }}
      >
        {page.blocks.map((blockLayout) => {
          const block = blocks.find((b) => b.id === blockLayout.blockId);
          if (!block) return null;

          return (
            <div
              key={block.id}
              style={{
                position: 'absolute',
                top: blockLayout.y,
                left: blockLayout.x,
                width: blockLayout.width,
                height: blockLayout.height,
              }}
            >
              {renderBlockContent(block, blockLayout, activeBlockId, onBlockClick, onDoubleClick, onTripleClick)}
            </div>
          );
        })}
      </div>

      {/* Footer with page number */}
      {page.footerArea && (
        <div
          className="page-footer"
          style={{
            position: 'absolute',
            top: page.footerArea.y,
            left: page.footerArea.x,
            width: page.footerArea.width,
            height: page.footerArea.height,
            borderTop: '1px solid #eee',
            display: 'flex',
            alignItems: 'center',
            fontSize: 12,
            color: '#666',
          }}
        >
          {renderPageNumber(page.pageNumber, headerFooter.pageNumberPosition)}
        </div>
      )}

      {/* Page number (when no footer) */}
      {!page.footerArea && (
        <div
          className="page-number"
          style={{
            position: 'absolute',
            bottom: 20,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: 12,
            color: '#666',
          }}
        >
          {page.pageNumber}
        </div>
      )}
    </div>
  );
}

function renderBlock(
  block: BlockNode,
  activeBlockId: string | null,
  onBlockClick: BlockClickHandler,
  onDoubleClick: BlockClickHandler,
  onTripleClick: BlockClickHandler,
  getBlockLayout: (blockId: string) => BlockLayout | undefined
) {
  const blockLayout = getBlockLayout(block.id);

  if (block.type === 'paragraph' || block.type === 'heading') {
    return (
      <LayoutParagraph
        key={block.id}
        block={block as Paragraph | Heading}
        layout={blockLayout}
        isActive={block.id === activeBlockId}
        onClick={onBlockClick}
        onDoubleClick={onDoubleClick}
        onTripleClick={onTripleClick}
      />
    );
  }

  if (block.type === 'list') {
    return (
      <ListBlock
        key={block.id}
        block={block as List}
        activeBlockId={activeBlockId}
        onBlockClick={onBlockClick}
        onDoubleClick={onDoubleClick}
        onTripleClick={onTripleClick}
      />
    );
  }

  if (block.type === 'blockquote') {
    return (
      <BlockquoteBlock
        key={block.id}
        block={block as Blockquote}
        activeBlockId={activeBlockId}
        onBlockClick={onBlockClick}
        onDoubleClick={onDoubleClick}
        onTripleClick={onTripleClick}
      />
    );
  }

  if (block.type === 'horizontalRule') {
    return (
      <HorizontalRuleBlock
        key={block.id}
        block={block as HorizontalRule}
      />
    );
  }

  if (block.type === 'image') {
    return (
      <ImageBlock
        key={block.id}
        block={block as Image}
        isActive={block.id === activeBlockId}
        onClick={() => onBlockClick(block.id, 0, 0)}
      />
    );
  }

  if (block.type === 'table') {
    return (
      <TableBlock
        key={block.id}
        block={block as Table}
        activeBlockId={activeBlockId}
        onBlockClick={onBlockClick}
        onDoubleClick={onDoubleClick}
        onTripleClick={onTripleClick}
      />
    );
  }

  return null;
}

function renderBlockContent(
  block: BlockNode,
  blockLayout: BlockLayout,
  activeBlockId: string | null,
  onBlockClick: BlockClickHandler,
  onDoubleClick: BlockClickHandler,
  onTripleClick: BlockClickHandler
) {
  if (block.type === 'paragraph' || block.type === 'heading') {
    return (
      <LayoutParagraph
        block={block as Paragraph | Heading}
        layout={blockLayout}
        isActive={block.id === activeBlockId}
        onClick={onBlockClick}
        onDoubleClick={onDoubleClick}
        onTripleClick={onTripleClick}
      />
    );
  }

  // For other block types, render with layout positions
  return (
    <div style={{ width: blockLayout.width, height: blockLayout.height }}>
      {renderBlock(block, activeBlockId, onBlockClick, onDoubleClick, onTripleClick, () => blockLayout)}
    </div>
  );
}

type BlockClickHandler = (blockId: string, clientX: number, clientY: number) => void;

interface LayoutParagraphProps {
  block: Paragraph | Heading;
  layout: BlockLayout | undefined;
  isActive: boolean;
  onClick: BlockClickHandler;
  onDoubleClick: BlockClickHandler;
  onTripleClick: BlockClickHandler;
}

function LayoutParagraph({ block, layout: _layout, isActive, onClick: onBlockClick, onDoubleClick, onTripleClick }: LayoutParagraphProps) {
  const className = `paragraph ${isActive ? 'active' : ''} ${block.type === 'heading' ? `heading-${(block as Heading).level}` : ''}`;
  const cursor = useEditorStore((s) => s.cursor);
  const focused = useEditorStore((s) => s.focused);
  const paraRef = useRef<HTMLDivElement>(null);
  const [cursorRect, setCursorRect] = useState<{ x: number; y: number; height: number } | null>(null);

  // Measure cursor position via Range API on actual rendered text nodes.
  // This runs after React commits DOM updates, giving pixel-perfect positioning
  // that respects font, styling, marks (bold/italic), custom attrs, and wrapping.
  useEffect(() => {
    if (!isActive || cursor.position.nodeId !== block.id || !paraRef.current || !focused) {
      setCursorRect(null);
      return;
    }

    const el = paraRef.current;
    const offset = cursor.position.offset;

    // Walk all text nodes inside the paragraph in document order
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let charIndex = 0;
    let textNode: Text | null;

    while ((textNode = walker.nextNode() as Text | null)) {
      const nodeLen = textNode.length;
      if (charIndex + nodeLen >= offset) {
        // Found the text node containing the cursor offset
        const localOffset = offset - charIndex;

        // Clamp to valid range (edge case: offset at end of this node)
        const clampedOffset = Math.min(localOffset, nodeLen);

        const range = document.createRange();
        range.setStart(textNode, clampedOffset);
        range.collapse(true);

        const rect = range.getBoundingClientRect();
        const parentRect = el.getBoundingClientRect();

        if (rect.width === 0 && rect.height === 0) {
          // Collapsed range at end of an empty/whitespace-only node;
          // synthesize a position
          setCursorRect({ x: 0, y: 0, height: 24 });
        } else {
          setCursorRect({
            x: rect.left - parentRect.left,
            y: rect.top - parentRect.top,
            height: rect.height,
          });
        }
        return;
      }
      charIndex += nodeLen;
    }

    // Offset beyond all text — cursor at end of last child
    const lastChild = el.lastChild;
    if (lastChild) {
      const range = document.createRange();
      range.setStartAfter(lastChild);
      range.collapse(true);
      const rect = range.getBoundingClientRect();
      const parentRect = el.getBoundingClientRect();
      setCursorRect({
        x: rect.left - parentRect.left,
        y: rect.top - parentRect.top,
        height: rect.height || 24,
      });
    } else {
      setCursorRect({ x: 0, y: 0, height: 24 });
    }
  }, [cursor.position.offset, cursor.position.nodeId, block.id, isActive, focused]);

  // Render text directly from block children (always works, no layout dependency)
  const renderTextContent = () => {
    if (!block.children || block.children.length === 0) {
      return <br />;
    }

    return block.children.map((run, index) => {
      const style: React.CSSProperties = {};
      if (run.marks.includes('bold')) style.fontWeight = 'bold';
      if (run.marks.includes('italic')) style.fontStyle = 'italic';
      if (run.marks.includes('underline')) style.textDecoration = 'underline';
      if (run.marks.includes('strikethrough')) style.textDecoration = 'line-through';
      if (run.attrs?.fontFamily) style.fontFamily = run.attrs.fontFamily as string;
      if (run.attrs?.fontSize) style.fontSize = run.attrs.fontSize as number;
      if (run.attrs?.color) style.color = run.attrs.color as string;

      return (
        <span key={run.id || index} className="text-run" style={style}>
          {run.content}
        </span>
      );
    });
  };

  return (
    <div
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
      style={{
        position: 'relative',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {renderTextContent()}

      {/* Cursor at correct position via Range API measurement */}
      {cursorRect && isActive && cursor.position.nodeId === block.id && (
        <span
          className="editor-cursor-inline"
          style={{
            position: 'absolute',
            left: cursorRect.x,
            top: cursorRect.y,
            height: cursorRect.height,
          }}
        />
      )}
    </div>
  );
}

function renderHeaderFooterContent(runs: import('../core/types').TextRun[]) {
  if (runs.length === 0) return null;

  return (
    <span>
      {runs.map((run) => (
        <span
          key={run.id}
          style={{
            fontWeight: run.marks.includes('bold') ? 'bold' : 'normal',
            fontStyle: run.marks.includes('italic') ? 'italic' : 'normal',
            fontFamily: run.attrs?.fontFamily,
            fontSize: run.attrs?.fontSize,
            color: run.attrs?.color,
          }}
        >
          {run.content}
        </span>
      ))}
    </span>
  );
}

function renderPageNumber(pageNumber: number, position: string) {
  const style: React.CSSProperties = {
    fontSize: 12,
    color: '#666',
  };

  if (position.includes('left')) {
    style.textAlign = 'left';
  } else if (position.includes('right')) {
    style.textAlign = 'right';
  } else {
    style.textAlign = 'center';
  }

  return <span style={style}>{pageNumber}</span>;
}
