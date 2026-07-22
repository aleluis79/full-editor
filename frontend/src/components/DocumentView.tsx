import { useRef, useEffect, useState, useCallback } from 'react';
import type { BlockNode, Paragraph, Heading, List, Blockquote, HorizontalRule, Image, Table, ListItem } from '../core/types';
import type { BlockLayout } from '../core/layout/types';
import type { Page as PageType, HeaderFooterConfig } from '../core/pagination/types';
import { useDocumentStore } from '../stores/document-store';
import { useLayoutStore } from '../stores/layout-store';
import { usePageStore } from '../stores/page-store';
import { useEditorStore } from '../stores/editor-store';
import { getBlockNodes } from '../core/document';
import { isSelectionEmpty } from '../core/selection';
import { ListBlock } from './ListBlock';
import { BlockquoteBlock } from './BlockquoteBlock';
import { HorizontalRuleBlock } from './HorizontalRuleBlock';
import { ImageBlock } from './ImageBlock';
import { TableBlock } from './TableBlock';
import { CommentIndicator } from './CommentIndicator';
import { useCommentStore } from '../stores/comment-store';

interface DocumentViewProps {
  blocks: BlockNode[];
  activeBlockId: string | null;
  onBlockMouseDown: (blockId: string, e: React.MouseEvent) => void;
  onBlockClick: (blockId: string, clientX: number, clientY: number) => void;
  onDoubleClick: (blockId: string, clientX: number, clientY: number) => void;
  onTripleClick: (blockId: string, clientX: number, clientY: number) => void;
}

export function DocumentView({ blocks: _blocks, activeBlockId, onBlockMouseDown, onBlockClick, onDoubleClick, onTripleClick }: DocumentViewProps) {
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
        <div className="page">
          <div className="page-content">
            {blocks.map((block) => renderBlock(block, activeBlockId, onBlockMouseDown, onBlockClick, onDoubleClick, onTripleClick, getBlockLayout))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="document-view" ref={containerRef} onScroll={handleScroll}>
      {pages.length > 0 && (
        <PageRuler
          pageWidth={pages[0].width}
          contentArea={pages[0].contentArea}
        />
      )}
      {pages.map((page, pageIndex) => (
        <PageRenderer
          key={pageIndex}
          page={page}
          blocks={blocks}
          activeBlockId={activeBlockId}
          onBlockMouseDown={onBlockMouseDown}
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
  onBlockMouseDown: (blockId: string, e: React.MouseEvent) => void;
  onBlockClick: BlockClickHandler;
  onDoubleClick: BlockClickHandler;
  onTripleClick: BlockClickHandler;
  getBlockLayout: (blockId: string) => BlockLayout | undefined;
  headerFooter: HeaderFooterConfig;
  isVirtualized: boolean;
}

function PageRenderer({ page, blocks, activeBlockId, onBlockMouseDown, onBlockClick, onDoubleClick, onTripleClick, getBlockLayout: _getBlockLayout, headerFooter, isVirtualized }: PageRendererProps) {
  // Comment indicators
  const commentVisible = useCommentStore((s) => s.visible);
  const commentData = useCommentStore((s) => s.comments);
  const commentActiveBlock = useCommentStore((s) => s.activeBlockId);
  const setActiveBlock = useCommentStore((s) => s.setActiveBlock);

  // Build a map of block_id → comments
  const commentsByBlock = new Map<string, typeof commentData>();
  for (const c of commentData) {
    const existing = commentsByBlock.get(c.block_id);
    if (existing) {
      existing.push(c);
    } else {
      commentsByBlock.set(c.block_id, [c]);
    }
  }

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
        position: 'relative',
        width: page.width,
        height: page.height,
        marginBottom: 20,
      }}
    >
      {/* Header */}
      {headerFooter.enabled && page.headerArea && !(headerFooter.firstPageDifferent && page.index === 0) && (
        <div
          className="page-header"
          style={{
            top: page.headerArea.y,
            left: page.headerArea.x,
            width: page.headerArea.width,
            height: page.headerArea.height,
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
          padding: 0,
          minHeight: 0,
        }}
      >
        {page.blocks.map((blockLayout) => {
          const block = blocks.find((b) => b.id === blockLayout.blockId);
          if (!block) return null;

          // Skip blocks that are inside containers (list, blockquote, table) — those
          // containers render their own children via DOM flow. Including them here
          // would duplicate the content (double cursor, double rendering).
          if (block.type !== 'list' && block.type !== 'blockquote' && block.type !== 'table') {
            // Check if this block is a child of a container
            const isInsideContainer = blocks.some((b) =>
              (b.type === 'list' || b.type === 'blockquote') &&
              'children' in b &&
              (b as any).children?.some((item: any) =>
                item.id === block.id ||
                (item.children && (item as any).children?.some((c: any) => c.id === block.id))
              )
            );
            if (isInsideContainer) return null;
          }

          // Skip blocks inside table cells — TableBlock renders its own children
          const doc = useDocumentStore.getState().document;
          const isInsideTable = doc.children.some((top) => {
            if (top.type !== 'table') return false;
            const table = top as any;
            return table.rows?.some((row: any) =>
              row.cells?.some((cell: any) =>
                cell.children?.some((p: any) => p.id === block.id),
              ),
            );
          });
          if (isInsideTable) return null;

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
              {renderBlockContent(block, blockLayout, activeBlockId, onBlockMouseDown, onBlockClick, onDoubleClick, onTripleClick)}
            </div>
          );
        })}

      </div>

      {/* Comment indicators in right gutter */}
      {commentVisible && (
        <div
          className="comment-gutter"
          style={{
            position: 'absolute',
            top: page.contentArea.y,
            left: page.contentArea.x + page.contentArea.width + 4,
            width: 28,
            height: page.contentArea.height,
          }}
        >
          {Array.from(commentsByBlock.entries()).map(([blockId, blockComments]) => {
            const bl = page.blocks.find((b) => b.blockId === blockId);
            if (!bl) return null;
            return (
              <div
                key={blockId}
                style={{
                  position: 'absolute',
                  top: bl.y,
                  left: 0,
                  width: 28,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CommentIndicator
                  blockId={blockId}
                  comments={blockComments}
                  activeBlockId={commentActiveBlock}
                  onClick={setActiveBlock}
                />
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* Footer with page number */}
      {page.footerArea && (
        <div
          className="page-footer"
          style={{
            top: page.footerArea.y,
            left: page.footerArea.x,
            width: page.footerArea.width,
            height: page.footerArea.height,
          }}
        >
          {renderPageNumber(page.pageNumber, headerFooter.pageNumberPosition)}
        </div>
      )}

      {/* Page number (when no footer) */}
      {!page.footerArea && (
        <div className="page-number">
          {page.pageNumber}
        </div>
      )}
    </div>
  );
}

function renderBlock(
  block: BlockNode,
  activeBlockId: string | null,
  onBlockMouseDown: (blockId: string, e: React.MouseEvent) => void,
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
        onMouseDown={onBlockMouseDown}
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
        onBlockMouseDown={onBlockMouseDown}
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
    const imgBlock = block as Image;
    return (
      <div
        key={block.id}
        className="image-block-wrapper"
        style={{
          textAlign: imgBlock.attrs?.textAlign ?? 'left',
        }}
      >
        <ImageBlock
          block={imgBlock}
          isActive={block.id === activeBlockId}
          onClick={onBlockClick}
          onMouseDown={onBlockMouseDown}
        />
      </div>
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
        onBlockMouseDown={onBlockMouseDown}
      />
    );
  }

  return null;
}

function renderBlockContent(
  block: BlockNode,
  blockLayout: BlockLayout,
  activeBlockId: string | null,
  onBlockMouseDown: (blockId: string, e: React.MouseEvent) => void,
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
        onMouseDown={onBlockMouseDown}
        onClick={onBlockClick}
        onDoubleClick={onDoubleClick}
        onTripleClick={onTripleClick}
      />
    );
  }

  // Container blocks (list, listItem, blockquote) are rendered by their own
  // component (ListBlock, BlockquoteBlock) which already renders children.
  // Skip individual list-related blocks to avoid double-rendering.
  if (block.type === 'listItem') {
    return null;
  }

  // For other block types, render with layout positions
  return (
    <div style={{ width: blockLayout.width, height: blockLayout.height }}>
      {renderBlock(block, activeBlockId, onBlockMouseDown, onBlockClick, onDoubleClick, onTripleClick, () => blockLayout)}
    </div>
  );
}

type BlockClickHandler = (blockId: string, clientX: number, clientY: number) => void;

interface LayoutParagraphProps {
  block: Paragraph | Heading;
  layout: BlockLayout | undefined;
  isActive: boolean;
  onMouseDown: (blockId: string, e: React.MouseEvent) => void;
  onClick: BlockClickHandler;
  onDoubleClick: BlockClickHandler;
  onTripleClick: BlockClickHandler;
}

function LayoutParagraph({ block, layout: _layout, isActive, onMouseDown, onClick: onBlockClick, onDoubleClick, onTripleClick }: LayoutParagraphProps) {
  const className = `paragraph ${isActive ? 'active' : ''} ${block.type === 'heading' ? `heading-${(block as Heading).level}` : ''}`;
  const cursor = useEditorStore((s) => s.cursor);
  const selection = useEditorStore((s) => s.selection);
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

  // Compute selection range within this block (global offsets)
  const getBlockSelRange = (): [number, number] | null => {
    if (!selection || isSelectionEmpty(selection)) return null;
    const inBlock = (id: string) => id === block.id;
    const aIn = inBlock(selection.anchor.nodeId);
    const fIn = inBlock(selection.focus.nodeId);
    const blockLen = block.children.reduce((s, r) => s + r.content.length, 0);

    if (aIn && fIn) {
      const s = Math.min(selection.anchor.offset, selection.focus.offset);
      const e = Math.max(selection.anchor.offset, selection.focus.offset);
      return [s, e];
    }

    // Determine document order to handle backward selections (bottom→top).
    // When anchor is AFTER focus in document order, the selection is backward
    // and anchor/focus roles for partial blocks invert.
    const doc = useDocumentStore.getState().document;
    const allBlocks = getBlockNodes(doc);
    const anchorIdx = allBlocks.findIndex((b) => b.id === selection.anchor.nodeId);
    const focusIdx = allBlocks.findIndex((b) => b.id === selection.focus.nodeId);
    const isForward = anchorIdx >= 0 && focusIdx >= 0 && anchorIdx <= focusIdx;

    if (aIn) {
      // Anchor is the FIRST block in forward selection → from offset to end.
      // Anchor is the LAST block in backward selection → from start to offset.
      return isForward
        ? [selection.anchor.offset, blockLen]
        : [0, selection.anchor.offset];
    }
    if (fIn) {
      // Focus is the LAST block in forward selection → from start to offset.
      // Focus is the FIRST block in backward selection → from offset to end.
      return isForward
        ? [0, selection.focus.offset]
        : [selection.focus.offset, blockLen];
    }

    // Middle block in multi-block selection — entire block is selected
    // Verify this block is actually between anchor and focus blocks
    const thisIdx = allBlocks.findIndex((b) => b.id === block.id);
    if (
      anchorIdx >= 0 && focusIdx >= 0 && thisIdx >= 0 &&
      thisIdx > Math.min(anchorIdx, focusIdx) &&
      thisIdx < Math.max(anchorIdx, focusIdx)
    ) {
      return [0, blockLen];
    }
    return null;
  };

  // Render text directly from block children (always works, no layout dependency)
  const renderTextContent = () => {
    if (!block.children || block.children.length === 0) {
      return <span className="text-run" data-empty="true">{'\u200B'}</span>;
    }

    const selRange = getBlockSelRange();
    const SEL_BG = 'rgba(0, 120, 215, 0.3)';

    const parts: React.ReactNode[] = [];
    let globalOffset = 0;

    block.children.forEach((run, index) => {
      const runLen = run.content.length;
      const runStart = globalOffset;
      const runEnd = runStart + runLen;

      const baseStyle: React.CSSProperties = {};
      if (run.marks.includes('bold')) baseStyle.fontWeight = 'bold';
      if (run.marks.includes('italic')) baseStyle.fontStyle = 'italic';
      if (run.marks.includes('superscript')) { baseStyle.verticalAlign = 'super'; baseStyle.fontSize = 'smaller'; }
      if (run.marks.includes('subscript')) { baseStyle.verticalAlign = 'sub'; baseStyle.fontSize = 'smaller'; }
      // Combine text-decoration for underline + strikethrough
      const textDecorations: string[] = [];
      if (run.marks.includes('underline')) textDecorations.push('underline');
      if (run.marks.includes('strikethrough')) textDecorations.push('line-through');
      if (textDecorations.length > 0) baseStyle.textDecoration = textDecorations.join(' ');
      if (run.attrs?.fontFamily) baseStyle.fontFamily = run.attrs.fontFamily as string;
      if (run.attrs?.fontSize && !run.marks.includes('superscript') && !run.marks.includes('subscript')) baseStyle.fontSize = run.attrs.fontSize as number;
      if (run.attrs?.color) baseStyle.color = run.attrs.color as string;
      if (run.attrs?.backgroundColor) baseStyle.backgroundColor = run.attrs.backgroundColor as string;

      const content = run.content || '\u200B';

      const handleLinkClick = (e: React.MouseEvent) => {
        // Ctrl+Click or Meta+Click → let browser navigate (open in new tab)
        // Regular click → prevent navigation, let editor handle it
        if (!e.ctrlKey && !e.metaKey && e.button === 0) {
          e.preventDefault();
        }
      };

      if (!selRange || runEnd <= selRange[0] || runStart >= selRange[1]) {
        // Entire run outside selection — single span
        parts.push(
          run.href ? (
            <a
              key={run.id || index}
              href={run.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-run"
              onClick={handleLinkClick}
              style={{ ...baseStyle, color: 'blue', textDecoration: 'underline', cursor: 'pointer' }}
            >
              {content}
            </a>
          ) : (
            <span key={run.id || index} className="text-run" style={baseStyle}>
              {content}
            </span>
          )
        );
      } else {
        // Run overlaps selection — split into up to 3 parts
        const selStart = Math.max(0, selRange[0] - runStart);
        const selEnd = Math.min(runLen, selRange[1] - runStart);
        const linkStyle: React.CSSProperties = run.href ? { color: 'blue', textDecoration: 'underline', cursor: 'pointer' } : {};
        const wrapEl = (key: string, text: string, extraStyle?: React.CSSProperties) => {
          const mergedStyle = { ...baseStyle, ...linkStyle, ...extraStyle };
          if (run.href) {
            return (
              <a key={key} href={run.href} target="_blank" rel="noopener noreferrer" className="text-run" onClick={handleLinkClick} style={mergedStyle}>
                {text}
              </a>
            );
          }
          return <span key={key} className="text-run" style={mergedStyle}>{text}</span>;
        };

        if (selStart > 0) {
          parts.push(wrapEl(`${run.id || index}-pre`, content.slice(0, selStart)));
        }
        parts.push(
          wrapEl(`${run.id || index}-sel`, content.slice(selStart, selEnd), { backgroundColor: SEL_BG })
        );
        if (selEnd < runLen) {
          parts.push(wrapEl(`${run.id || index}-post`, content.slice(selEnd)));
        }
      }

      globalOffset += runLen;
    });

    return <>{parts}</>;
  };

  return (
    <div
      ref={paraRef}
      className={className}
      data-block-id={block.id}
      onMouseDown={(e) => onMouseDown(block.id, e)}
      onClick={(e) => onBlockClick(block.id, e.clientX, e.clientY)}
      onDoubleClick={(e) => {
        // Double-click on a link → open the URL
        const linkEl = (e.target as HTMLElement).closest('a');
        if (linkEl?.href) {
          window.open(linkEl.href, '_blank', 'noopener,noreferrer');
        } else {
          onDoubleClick(block.id, e.clientX, e.clientY);
        }
      }}
      onMouseUp={(e) => {
        if (e.detail === 3) {
          onTripleClick(block.id, e.clientX, e.clientY);
        }
      }}
      style={{
        position: 'relative',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        textAlign: block.attrs?.textAlign ?? 'left',
        lineHeight: block.attrs?.lineHeight ?? undefined,
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
            backgroundColor: run.attrs?.backgroundColor,
          }}
        >
          {run.content}
        </span>
      ))}
    </span>
  );
}

// ── Page Ruler ────────────────────────────────────────────

interface PageRulerProps {
  pageWidth: number;
  contentArea: { x: number; width: number };
}

function PageRuler({ pageWidth, contentArea }: PageRulerProps) {
  const updateMargins = usePageStore((s) => s.updateMargins);
  const margins = usePageStore((s) => s.config.margins);
  const [dragging, setDragging] = useState<'left' | 'right' | null>(null);

  const ticks: { pos: number; label: string; major: boolean }[] = [];
  for (let px = 0; px <= pageWidth; px += 10) {
    if (px % 50 === 0) {
      ticks.push({ pos: px, label: px % 100 === 0 ? String(px / 10) : '', major: true });
    } else {
      ticks.push({ pos: px, label: '', major: false });
    }
  }

  // Track drag on document level for smooth movement outside the ruler
  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // e.clientX is relative to the viewport; we need position relative to the ruler
      const rulerEl = document.querySelector('.page-ruler');
      if (!rulerEl) return;
      const rulerRect = rulerEl.getBoundingClientRect();
      const px = e.clientX - rulerRect.left;
      // Clamp to [0, pageWidth]
      const clampedPx = Math.max(0, Math.min(pageWidth, px));

      if (dragging === 'left') {
        // Left margin: the pixel position directly is the margin width in CSS px
        const newLeft = Math.round(clampedPx);
        updateMargins({ left: newLeft });
        useDocumentStore.getState().markDirty();
      } else {
        // Right margin: pixel from left edge → right margin = pageWidth - px
        const newRight = Math.round(pageWidth - clampedPx);
        updateMargins({ right: newRight });
        useDocumentStore.getState().markDirty();
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, pageWidth, updateMargins, margins]);

  const handleMarginMouseDown = (side: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(side);
  };

  const leftWidth = contentArea.x;
  const rightLeft = contentArea.x + contentArea.width;
  const rightWidth = pageWidth - rightLeft;

  return (
    <div className="page-ruler" style={{ width: pageWidth }}>
      <div className="page-ruler-track">
        {ticks.map((t, i) => (
          <div
            key={i}
            className={`page-ruler-tick ${t.major ? 'major' : 'minor'}`}
            style={{ left: t.pos }}
          >
            {t.label && <span className="page-ruler-label">{t.label}</span>}
          </div>
        ))}
      </div>
      {/* Left margin — draggable */}
      <div
        className="page-ruler-margin page-ruler-margin-left"
        style={{ width: leftWidth, cursor: 'ew-resize' }}
        onMouseDown={handleMarginMouseDown('left')}
      >
        <div className="page-ruler-drag-handle" style={{ position: 'absolute', right: -3, width: 6, height: '100%', cursor: 'ew-resize' }} />
      </div>
      {/* Right margin — draggable */}
      <div
        className="page-ruler-margin page-ruler-margin-right"
        style={{ left: rightLeft, width: rightWidth, cursor: 'ew-resize' }}
        onMouseDown={handleMarginMouseDown('right')}
      >
        <div className="page-ruler-drag-handle" style={{ position: 'absolute', left: -3, width: 6, height: '100%', cursor: 'ew-resize' }} />
      </div>
      {/* Drag indicator line shown while dragging */}
      {dragging === 'left' && (
        <div style={{ position: 'absolute', left: leftWidth, top: 0, width: 1, height: '100%', background: 'var(--color-accent)', zIndex: 10, pointerEvents: 'none' }} />
      )}
      {dragging === 'right' && (
        <div style={{ position: 'absolute', left: rightLeft, top: 0, width: 1, height: '100%', background: 'var(--color-accent)', zIndex: 10, pointerEvents: 'none' }} />
      )}
    </div>
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
