import type { Blockquote as BlockquoteType, Paragraph, Heading } from '../core/types';
import { Paragraph as ParagraphComponent } from './Paragraph';

type BlockClickHandler = (blockId: string, clientX: number, clientY: number) => void;

interface BlockquoteProps {
  block: BlockquoteType;
  activeBlockId: string | null;
  onBlockClick: BlockClickHandler;
  onDoubleClick: BlockClickHandler;
  onTripleClick: BlockClickHandler;
}

export function BlockquoteBlock({ block, activeBlockId, onBlockClick, onDoubleClick, onTripleClick }: BlockquoteProps) {
  return (
    <blockquote className="blockquote-block" data-block-id={block.id}>
      {block.children.map((child) => (
        <ParagraphComponent
          key={child.id}
          block={child as Paragraph | Heading}
          isActive={child.id === activeBlockId}
          onBlockClick={onBlockClick}
          onDoubleClick={onDoubleClick}
          onTripleClick={onTripleClick}
        />
      ))}
    </blockquote>
  );
}
