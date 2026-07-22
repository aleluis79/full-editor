import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CommentData, CommentUpdateData } from '../api/client';
import { useCommentStore } from '../stores/comment-store';
import { useAuthStore } from '../stores/auth-store';

interface CommentThreadProps {
  comments: CommentData[];
  docId: string;
  activeBlockId: string | null;
}

function relativeTime(dateStr: string, t: (key: string, options?: any) => string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return t('justNow');
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t('minutesAgo', { count: diffMin });
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return t('hoursAgo', { count: diffHour });
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return t('daysAgo', { count: diffDay });
  return dateStr.slice(0, 10);
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

interface CommentItemProps {
  comment: CommentData;
  docId: string;
  isTopLevel: boolean;
  threadResolved?: boolean;
}

function CommentItem({ comment, docId, isTopLevel, threadResolved }: CommentItemProps) {
  const { t } = useTranslation('comments');
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const store = useCommentStore();

  const isActive = comment.id === store.activeBlockId;

  const handleUpdate = async () => {
    if (!editContent.trim()) return;
    const data: CommentUpdateData = { content: editContent.trim() };
    await store.updateComment(docId, comment.id, data);
    setEditing(false);
  };

  const handleDelete = async () => {
    await store.deleteComment(docId, comment.id);
  };

  const handleResolve = async () => {
    await store.toggleResolved(docId, comment.id);
  };

  const handleReply = async () => {
    if (!replyContent.trim()) return;
    await store.createReply(docId, comment.id, comment.block_id, replyContent.trim());
    setReplyContent('');
    setShowReplyForm(false);
  };

  const currentUserId = useAuthStore((s) => s.user?.id ?? '');
  const isAuthor = comment.author_id === currentUserId;

  return (
    <div className={`comment-item ${isActive ? 'comment-item--active' : ''} ${comment.resolved ? 'comment-item--resolved' : ''}`}>
      <div className="comment-item-avatar">
        {getInitials(comment.author_display_name)}
      </div>
      <div className="comment-item-body">
        <div className="comment-item-meta">
          <span className="comment-item-name">{comment.author_display_name}</span>
          <span className="comment-item-time">{relativeTime(comment.created_at, t)}</span>
          {comment.resolved && <span className="comment-item-resolved-badge">{t('resolved')}</span>}
        </div>

        {editing ? (
          <div className="comment-reply-form">
            <textarea
              className="comment-reply-textarea"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              autoFocus
            />
            <div className="comment-reply-actions">
              <button className="comment-btn comment-btn-primary" onClick={handleUpdate}>
                {t('save')}
              </button>
              <button className="comment-btn" onClick={() => setEditing(false)}>
                {t('cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div className="comment-item-content">{comment.content}</div>
        )}

        <div className="comment-item-actions">
          {!editing && (
            <>
              {(comment.resolved || threadResolved) ? (
                /* Resolved thread: only show Unresolve on the top-level comment */
                isAuthor && isTopLevel && (
                  <button className="comment-action-btn" onClick={handleResolve}>
                    {t('unresolve')}
                  </button>
                )
              ) : (
                /* Not resolved: show all actions */
                <>
                  <button className="comment-action-btn" onClick={() => setShowReplyForm(!showReplyForm)}>
                    {t('reply')}
                  </button>
                  {isAuthor && (
                    <button className="comment-action-btn" onClick={() => { setEditContent(comment.content); setEditing(true); }}>
                      {t('edit')}
                    </button>
                  )}
                  {isAuthor && (
                    <button className="comment-action-btn comment-action-btn--danger" onClick={handleDelete}>
                      {t('delete')}
                    </button>
                  )}
                  {isAuthor && isTopLevel && (
                    <button className="comment-action-btn" onClick={handleResolve}>
                      {t('resolve')}
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {showReplyForm && (
          <div className="comment-reply-form">
            <textarea
              className="comment-reply-textarea"
              placeholder={t('writeReply')}
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              autoFocus
            />
            <div className="comment-reply-actions">
              <button className="comment-btn comment-btn-primary" onClick={handleReply}>
                {t('reply')}
              </button>
              <button className="comment-btn" onClick={() => setShowReplyForm(false)}>
                {t('cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function CommentThread({ comments, docId, activeBlockId }: CommentThreadProps) {
  // Filter to only top-level comments
  const topLevel = comments.filter((c) => !c.parent_id);

  if (topLevel.length === 0) return null;

  return (
    <div className="comment-thread">
      {topLevel.map((comment) => (
        <div
          key={comment.id}
          className={`comment-thread-entry ${comment.id === activeBlockId ? 'comment-thread--active' : ''}`}
        >
          <CommentItem comment={comment} docId={docId} isTopLevel />

          {/* Nested replies — pass threadResolved so replies hide actions when resolved */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="comment-replies">
              {comment.replies.map((reply) => (
                <CommentItem key={reply.id} comment={reply} docId={docId} isTopLevel={false} threadResolved={comment.resolved} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
