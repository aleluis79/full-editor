import type { BlockNode, Paragraph, Heading, List, Blockquote, HorizontalRule } from '../core/types';
import type { BlockLayout } from '../core/layout/types';
import { useLayoutStore } from '../stores/layout-store';
import { ListBlock } from './ListBlock';
import { BlockquoteBlock } from './BlockquoteBlock';
import { HorizontalRuleBlock } from './HorizontalRuleBlock';

interface PageProps {
  blocks: BlockNode[];
  activeBlockId: string | null;
  onBlockClick: (blockId: string) => void;
  onDoubleClick: (blockId: string) => void;
  onTripleClick: (blockId: string) => void;
}

export function Page({ blocks, activeBlockId, onBlockClick, onDoubleClick, onTripleClick }: PageProps) {
  const getBlockLayout = useLayoutStore((s) => s.getBlockLayout);

  return (
    <div className="page" style={{ position: 'relative' }}>
      <div className="page-content" style={{ position: 'relative' }}>
        {blocks.map((block) => {
          const blockLayout = getBlockLayout(block.id);

          if (block.type === 'paragraph' || block.type === 'heading') {
            return (
              <LayoutParagraph
                key={block.id}
                block={block as Paragraph | Heading}
                layout={blockLayout}
                isActive={block.id === activeBlockId}
                onClick={() => onBlockClick(block.id)}
                onDoubleClick={() => onDoubleClick(block.id)}
                onTripleClick={() => onTripleClick(block.id)}
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

          return null;
        })}
      </div>
    </div>
  );
}

interface LayoutParagraphProps {
  block: Paragraph | Heading;
  layout: BlockLayout | undefined;
  isActive: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onTripleClick: () => void;
}

function LayoutParagraph({ block, layout, isActive, onClick, onDoubleClick, onTripleClick }: LayoutParagraphProps) {
  const className = `paragraph ${isActive ? 'active' : ''} ${block.type === 'heading' ? `heading-${(block as Heading).level}` : ''}`;

  // Use layout positions if available, otherwise fall back to DOM flow
  if (layout) {
    return (
      <div
        className={className}
        data-block-id={block.id}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onMouseUp={(e) => {
          if (e.detail === 3) {
            onTripleClick();
          }
        }}
        style={{
          position: 'absolute',
          top: layout.y,
          left: layout.x,
          width: layout.width,
          height: layout.height,
        }}
      >
        {layout.lines.map((line, lineIndex) => (
          <div
            key={lineIndex}
            className="layout-line"
            style={{
              position: 'absolute',
              top: line.y,
              left: 0,
              width: line.width,
              height: line.height,
            }}
          >
            {line.runs.map((run, runIndex) => (
              <span
                key={runIndex}
                className="text-run"
                style={{
                  position: 'absolute',
                  left: run.x,
                  top: run.y,
                  fontFamily: run.fontFamily,
                  fontSize: run.fontSize,
                  fontWeight: run.bold ? 'bold' : 'normal',
                  fontStyle: run.italic ? 'italic' : 'normal',
                  textDecoration: [
                    run.underline ? 'underline' : '',
                    run.strikethrough ? 'line-through' : '',
                  ].filter(Boolean).join(' ') || 'none',
                  color: run.color,
                }}
              >
                {run.text}
              </span>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Fallback: render without layout (DOM flow)
  return (
    <div
      className={className}
      data-block-id={block.id}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseUp={(e) => {
        if (e.detail === 3) {
          onTripleClick();
        }
      }}
    >
      {block.children.map((run) => (
        <span
          key={run.id}
          className="text-run"
          style={{
            fontWeight: run.marks.includes('bold') ? 'bold' : 'normal',
            fontStyle: run.marks.includes('italic') ? 'italic' : 'normal',
            textDecoration: [
              run.marks.includes('underline') ? 'underline' : '',
              run.marks.includes('strikethrough') ? 'line-through' : '',
            ].filter(Boolean).join(' ') || 'none',
            fontFamily: run.attrs?.fontFamily,
            fontSize: run.attrs?.fontSize,
            color: run.attrs?.color,
          }}
        >
          {run.content}
        </span>
      ))}
      {block.children.length === 0 && <br />}
    </div>
  );
}
