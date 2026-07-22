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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('share');
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
      setError('ERROR_LIST_SHARES');
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
      setError(err.message || 'ERROR_CREATE_SHARE');
    }
  };

  const handleRevoke = async (shareId: string) => {
    try {
      await revokeShare(shareId);
      await loadShares();
    } catch {
      setError('ERROR_REVOKE_SHARE');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="share-overlay" onClick={onClose}>
      <div className="share-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="share-dialog-header">
          <h2>{t('shareDocument')}</h2>
          <button className="share-close-btn" onClick={onClose}>×</button>
        </div>

        {error && <div className="share-error">{t(`errors:${error}`, { defaultValue: error })}</div>}

        {/* Search & add user */}
        <div className="share-add-section">
          <div className="share-search-row">
            <input
              ref={searchRef}
              type="text"
              className="share-search-input"
              placeholder={t('searchUsersPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className="share-permission-select"
              value={selectedPermission}
              onChange={(e) => setSelectedPermission(e.target.value as 'read' | 'write')}
            >
              <option value="read">{t('canRead')}</option>
              <option value="write">{t('canEdit')}</option>
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
                  <button className="share-add-btn">{t('add')}</button>
                </div>
              ))}
            </div>
          )}

          {searchQuery.length >= 2 && searchResults.length === 0 && (
            <div className="share-no-results">{t('noUsersFound')}</div>
          )}
        </div>

        {/* Existing shares */}
        <div className="share-list-section">
          <h3>{t('peopleWithAccess')}</h3>
          {loading ? (
            <div className="share-loading">{t('loading')}</div>
          ) : shares.length === 0 ? (
            <div className="share-empty">{t('noSharesYet')}</div>
          ) : (
            <div className="share-list">
              {shares.map((s) => (
                <div key={s.id} className="share-item">
                  <div className="share-item-avatar">
                    {(s.shared_with_display_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="share-item-info">
                    <span className="share-item-name">
                      {s.shared_with_display_name || t('unknown')}
                    </span>
                    <span className="share-item-email">{s.shared_with_email}</span>
                  </div>
                  <span className={`share-item-permission ${s.permission}`}>
                    {s.permission === 'read' ? t('canRead') : t('canEdit')}
                  </span>
                  <button
                    className="share-revoke-btn"
                    onClick={() => handleRevoke(s.id)}
                    title={t('removeAccess')}
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
