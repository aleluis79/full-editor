/**
 * ShareDialog — modal for managing document sharing.
 *
 * Allows the document owner to:
 * - Search for users by name/email
 * - Add users with read or write permission
 * - See existing shares
 * - Revoke shares
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  listShares,
  createShare,
  revokeShare,
  searchUsers,
  type ShareData,
  type UserSearchResult,
} from '../api/client';

interface ShareDialogProps {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareDialog({ documentId, isOpen, onClose }: ShareDialogProps) {
  const [shares, setShares] = useState<ShareData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedPermission, setSelectedPermission] = useState<'read' | 'write'>('read');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const loadShares = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listShares(documentId);
      setShares(data);
    } catch {
      setError('Failed to load shares');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (isOpen) {
      loadShares();
      setSearchQuery('');
      setSearchResults([]);
      setError(null);
      // Focus search input after modal opens
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [isOpen, loadShares]);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await searchUsers(searchQuery);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddShare = async (userId: string) => {
    try {
      await createShare(documentId, userId, selectedPermission);
      await loadShares();
      setSearchQuery('');
      setSearchResults([]);
      searchRef.current?.focus();
    } catch (err: any) {
      setError(err.message || 'Failed to share');
    }
  };

  const handleRevoke = async (shareId: string) => {
    try {
      await revokeShare(shareId);
      await loadShares();
    } catch {
      setError('Failed to revoke share');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="share-overlay" onClick={onClose}>
      <div className="share-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="share-dialog-header">
          <h2>Share document</h2>
          <button className="share-close-btn" onClick={onClose}>×</button>
        </div>

        {error && <div className="share-error">{error}</div>}

        {/* Search & add user */}
        <div className="share-add-section">
          <div className="share-search-row">
            <input
              ref={searchRef}
              type="text"
              className="share-search-input"
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className="share-permission-select"
              value={selectedPermission}
              onChange={(e) => setSelectedPermission(e.target.value as 'read' | 'write')}
            >
              <option value="read">Can read</option>
              <option value="write">Can edit</option>
            </select>
          </div>

          {searchResults.length > 0 && (
            <div className="share-search-results">
              {searchResults.map((u) => (
                <div
                  key={u.id}
                  className="share-search-item"
                  onClick={() => handleAddShare(u.id)}
                >
                  <div className="share-search-avatar">
                    {u.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="share-search-info">
                    <span className="share-search-name">{u.display_name}</span>
                    <span className="share-search-email">{u.email}</span>
                  </div>
                  <button className="share-add-btn">Add</button>
                </div>
              ))}
            </div>
          )}

          {searchQuery.length >= 2 && searchResults.length === 0 && (
            <div className="share-no-results">No users found</div>
          )}
        </div>

        {/* Existing shares */}
        <div className="share-list-section">
          <h3>People with access</h3>
          {loading ? (
            <div className="share-loading">Loading...</div>
          ) : shares.length === 0 ? (
            <div className="share-empty">No shares yet. Search for a user above.</div>
          ) : (
            <div className="share-list">
              {shares.map((s) => (
                <div key={s.id} className="share-item">
                  <div className="share-item-avatar">
                    {(s.shared_with_display_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="share-item-info">
                    <span className="share-item-name">
                      {s.shared_with_display_name || 'Unknown'}
                    </span>
                    <span className="share-item-email">{s.shared_with_email}</span>
                  </div>
                  <span className={`share-item-permission ${s.permission}`}>
                    {s.permission === 'read' ? 'Can read' : 'Can edit'}
                  </span>
                  <button
                    className="share-revoke-btn"
                    onClick={() => handleRevoke(s.id)}
                    title="Remove access"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
