import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSpellCheckStore } from '../stores/spell-check-store';
import { deleteCustomWord, fetchCustomWords } from '../api/client';

interface ManageDictionaryPopupProps {
  onClose: () => void;
}

interface WordEntry {
  id: string;
  word: string;
  lang: string;
}

export function ManageDictionaryPopup({ onClose }: ManageDictionaryPopupProps) {
  const { t } = useTranslation('toolbar');
  const popupRef = useRef<HTMLDivElement>(null);
  const customWords = useSpellCheckStore((s) => s.customWords);
  const [words, setWords] = useState<WordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load words from API on mount
  useEffect(() => {
    fetchCustomWords()
      .then((data) => {
        setWords(data as WordEntry[]);
        setLoading(false);
      })
      .catch(() => {
        // Fallback: use store words without IDs (delete not available)
        setWords(customWords.map((w) => ({ id: '', word: w, lang: '' })));
        setLoading(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleDelete = async (wordId: string, word: string) => {
    if (!wordId) return;
    try {
      await deleteCustomWord(wordId);
      setWords((prev) => prev.filter((w) => w.id !== wordId));
      // Also remove from store
      const store = useSpellCheckStore.getState();
      store.setCustomWords(store.customWords.filter((w) => w !== word));
    } catch {
      setError('Failed to delete word');
    }
  };

  return (
    <div
      className="manage-dict-popover"
      ref={popupRef}
      onMouseDown={(e) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return;
        e.preventDefault();
      }}
    >
      <div className="manage-dict-header">
        <span>{t('manageDictionary')}</span>
        <button className="toolbar-btn manage-dict-close" onClick={onClose}>×</button>
      </div>

      {error && <div className="manage-dict-error">{error}</div>}

      {loading ? (
        <div className="manage-dict-loading">{t('loading')}</div>
      ) : words.length === 0 ? (
        <div className="manage-dict-empty">{t('dictionaryEmpty')}</div>
      ) : (
        <div className="manage-dict-list">
          {words.map((entry) => (
            <div key={entry.id || entry.word} className="manage-dict-item">
              <span className="manage-dict-word">
                {entry.word}
                <span className="manage-dict-lang">{entry.lang === 'es' ? 'ES' : 'EN'}</span>
              </span>
              <button
                className="manage-dict-delete-btn"
                onClick={() => handleDelete(entry.id, entry.word)}
                title={t('removeFromDictionary')}
                disabled={!entry.id}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
