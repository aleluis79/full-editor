import { useEffect, useMemo, useState } from 'react';
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
  const createComment = useCommentStore((s) => s.createComment);
  const toggleVisibility = useCommentStore((s) => s.toggleVisibility);
  const setActiveBlock = useCommentStore((s) => s.setActiveBlock);
  const [newCommentText, setNewCommentText] = useState('');

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
        {/* New comment form — always visible so users can start a thread */}
        {currentDocId && (
          <div className="comment-new-form">
            {activeBlockId ? (
              <>
                <textarea
                  className="comment-new-textarea"
                  placeholder="Write a comment…"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  rows={3}
                />
                <button
                  className="comment-new-submit"
                  disabled={!newCommentText.trim()}
                  onClick={async () => {
                    try {
                      await createComment(currentDocId, activeBlockId, newCommentText.trim());
                      setNewCommentText('');
                    } catch {
                      // error handled by store
                    }
                  }}
                >
                  Comment
                </button>
              </>
            ) : (
              <p className="comment-new-hint">
                Click on a paragraph in the document to select it, then write a comment.
              </p>
            )}
          </div>
        )}

        {loading && comments.length === 0 && (
          <div className="comment-loading">Loading comments...</div>
        )}

        {error && (
          <div className="comment-error">{error}</div>
        )}

        {!loading && !error && comments.length === 0 && (
          <div className="comment-empty">
            <p>No comments yet.</p>
          </div>
        )}

        {/* When filtering by a specific block, show a back link */}
        {activeBlockId && (
          <button
            className="comment-filter-back"
            onClick={() => setActiveBlock(null)}
          >
            ← All comments
          </button>
        )}

        {Object.entries(grouped)
          .filter(([blockId]) => !activeBlockId || blockId === activeBlockId)
          .map(([blockId, blockComments]) => (
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
