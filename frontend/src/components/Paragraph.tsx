import type { Paragraph as ParagraphType, Heading as HeadingType } from '../core/types';
import { TextRun } from './TextRun';
import { useEditorStore } from '../stores/editor-store';

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

  const className = `paragraph ${isActive ? 'active' : ''} ${block.type === 'heading' ? `heading-${(block as HeadingType).level}` : ''}`;

  // Check if this block has selected text
  const hasSelection = selection && (
    selection.anchor.nodeId === block.id || selection.focus.nodeId === block.id
  );

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
    </>
  );

  if (block.type === 'heading') {
    const level = (block as HeadingType).level;
    const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    return (
      <Tag
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
