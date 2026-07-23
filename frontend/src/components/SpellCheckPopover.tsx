import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSpellCheckStore } from '../stores/spell-check-store';
import type { PopoverState } from '../stores/spell-check-store';

interface SpellCheckPopoverProps {
  /** Position of the popover relative to the viewport */
  position: { x: number; y: number };
  popover: PopoverState;
  onSelect: (blockId: string, start: number, end: number, replacement: string) => void;
  onAddToDictionary: (word: string) => void;
  onClose: () => void;
}

/**
 * Suggestion popover shown when clicking a misspelled word.
 * Follows the existing link popup pattern: absolute-positioned div
 * with outside-click dismiss.
 */
export function SpellCheckPopover({
  position,
  popover,
  onSelect,
  onAddToDictionary,
  onClose,
}: SpellCheckPopoverProps) {
  const { t } = useTranslation('toolbar');
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Close on Escape
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Use mousedown for responsive dismiss (matches link popup pattern)
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleSuggestionClick = (suggestion: string) => {
    onSelect(popover.blockId, popover.start, popover.end, suggestion);
    onClose();
  };

  const handleAddToDictionary = () => {
    // The word is the original misspelled word
    const word = popover.suggestions.length > 0
      ? document.querySelector('.spell-misspelled')?.textContent ?? ''
      : '';
    // Fallback: use the word from the popover context
    // In practice, the word is determined by the click handler
    onAddToDictionary(word);
    onClose();
  };

  return (
    <div
      ref={ref}
      className="spell-check-popover"
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex: 1000,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        padding: 'var(--space-1)',
        minWidth: 160,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {popover.suggestions.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {popover.suggestions.slice(0, 6).map((suggestion, i) => (
            <button
              key={i}
              className="spell-check-suggestion"
              onClick={() => handleSuggestionClick(suggestion)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px var(--space-2)',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontFamily: 'var(--font-family)',
                color: 'var(--color-text)',
                borderRadius: 'var(--radius-sm)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
              }}
            >
              {suggestion}
            </button>
          ))}
          <div style={{ borderTop: '1px solid var(--color-border)', margin: '4px 0' }} />
          <button
            className="spell-check-add-dict"
            onClick={handleAddToDictionary}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '6px var(--space-2)',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'var(--font-ui)',
              color: 'var(--color-text-secondary)',
              borderRadius: 'var(--radius-sm)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
            }}
          >
            {t('addToDictionary')}
          </button>
        </div>
      ) : (
        <div style={{ padding: '6px var(--space-2)', fontSize: 13, color: 'var(--color-text-secondary)' }}>
          {t('noSuggestions')}
        </div>
      )}
    </div>
  );
}
