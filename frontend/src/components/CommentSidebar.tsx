import { useEffect, useMemo } from 'react';
import { useCommentStore } from '../stores/comment-store';
import { CommentThread } from './CommentThread';

/**
 * Groups comments by block_id for display in the sidebar.
 */
function groupByBlock(comments: import('../api/client').CommentData[]) {
  const groups: Record<string, import('../api/client').CommentData[]> = {};
  for (const c of comments) {
    if (!groups[c.block_id]) {
      groups[c.block_id] = [];
    }
    groups[c.block_id].push(c);
  }
  return groups;
}

export function CommentSidebar() {
  const comments = useCommentStore((s) => s.comments);
  const visible = useCommentStore((s) => s.visible);
  const loading = useCommentStore((s) => s.loading);
  const error = useCommentStore((s) => s.error);
  const activeBlockId = useCommentStore((s) => s.activeBlockId);
  const currentDocId = useCommentStore((s) => s.currentDocId);
  const fetchComments = useCommentStore((s) => s.fetchComments);
  const toggleVisibility = useCommentStore((s) => s.toggleVisibility);
  const setActiveBlock = useCommentStore((s) => s.setActiveBlock);

  // Fetch comments on mount for the current document
  useEffect(() => {
    if (currentDocId) {
      fetchComments(currentDocId);
    }
  }, [currentDocId, fetchComments]);

  const grouped = useMemo(() => groupByBlock(comments), [comments]);

  // Scroll active block into view
  useEffect(() => {
    if (activeBlockId) {
      const el = document.querySelector(`[data-thread-block-id="${activeBlockId}"]`);
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [activeBlockId]);

  if (!visible) return null;

  return (
    <div className="comment-sidebar">
      <div className="comment-sidebar-header">
        <h3 className="comment-sidebar-title">Comments</h3>
        <button className="comment-sidebar-close" onClick={toggleVisibility} title="Close comments">
          ×
        </button>
      </div>

      <div className="comment-sidebar-content">
        {loading && comments.length === 0 && (
          <div className="comment-loading">Loading comments...</div>
        )}

        {error && (
          <div className="comment-error">{error}</div>
        )}

        {!loading && !error && comments.length === 0 && (
          <div className="comment-empty">
            <p>No comments yet.</p>
            <p className="comment-empty-hint">Click on a comment indicator in the document gutter to add one.</p>
          </div>
        )}

        {Object.entries(grouped).map(([blockId, blockComments]) => (
          <div
            key={blockId}
            data-thread-block-id={blockId}
            className="comment-block-group"
          >
            <div className="comment-block-id">Block: {blockId.slice(0, 8)}...</div>
            <CommentThread
              comments={blockComments}
              docId={currentDocId || ''}
              activeBlockId={activeBlockId}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
