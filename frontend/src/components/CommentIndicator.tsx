import type { CommentData } from '../api/client';

interface CommentIndicatorProps {
  blockId: string;
  comments: CommentData[];
  activeBlockId: string | null;
  onClick: (blockId: string) => void;
}

export function CommentIndicator({ blockId, comments, activeBlockId, onClick }: CommentIndicatorProps) {
  const count = comments.length;
  const hasResolved = comments.every((c) => c.resolved);
  const isActive = activeBlockId === blockId;

  // Count unresolved
  const unresolvedCount = comments.filter((c) => !c.resolved).length;

  const className = [
    'comment-indicator',
    isActive ? 'comment-indicator--active' : '',
    hasResolved ? 'comment-indicator--resolved' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      title={`${count} comment${count !== 1 ? 's' : ''}${unresolvedCount > 0 ? ` (${unresolvedCount} unresolved)` : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick(blockId);
      }}
    >
      <span className="comment-indicator-count">{count}</span>
    </div>
  );
}
