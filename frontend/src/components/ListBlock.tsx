import type { List as ListType, ListItem as ListItemType, Paragraph } from '../core/types';
import { Paragraph as ParagraphComponent } from './Paragraph';

type BlockClickHandler = (blockId: string, clientX: number, clientY: number) => void;

interface ListProps {
  block: ListType;
  activeBlockId: string | null;
  onBlockClick: BlockClickHandler;
  onDoubleClick: BlockClickHandler;
  onTripleClick: BlockClickHandler;
}

export function ListBlock({ block, activeBlockId, onBlockClick, onDoubleClick, onTripleClick }: ListProps) {
  const Tag = block.ordered ? 'ol' : 'ul';

  return (
    <Tag className="list-block" data-block-id={block.id}>
      {block.children.map((item) => (
        <ListItemBlock
          key={item.id}
          item={item}
          activeBlockId={activeBlockId}
          onBlockClick={onBlockClick}
          onDoubleClick={onDoubleClick}
          onTripleClick={onTripleClick}
        />
      ))}
    </Tag>
  );
}

interface ListItemBlockProps {
  item: ListItemType;
  activeBlockId: string | null;
  onBlockClick: BlockClickHandler;
  onDoubleClick: BlockClickHandler;
  onTripleClick: BlockClickHandler;
}

function ListItemBlock({ item, activeBlockId, onBlockClick, onDoubleClick, onTripleClick }: ListItemBlockProps) {
  return (
    <li className="list-item" data-block-id={item.id}>
      {item.children.map((child) => {
        if (child.type === 'paragraph') {
          return (
            <ParagraphComponent
              key={child.id}
              block={child as Paragraph}
              isActive={child.id === activeBlockId}
              onBlockClick={onBlockClick}
              onDoubleClick={onDoubleClick}
              onTripleClick={onTripleClick}
            />
          );
        }
        if (child.type === 'list') {
          return (
            <ListBlock
              key={child.id}
              block={child as ListType}
              activeBlockId={activeBlockId}
              onBlockClick={onBlockClick}
              onDoubleClick={onDoubleClick}
              onTripleClick={onTripleClick}
            />
          );
        }
        return null;
      })}
    </li>
  );
}
