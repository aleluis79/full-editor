import { useRef, useEffect, useState, useCallback } from 'react';
import type { TextRun } from '../core/types';
import { resolveTokens } from '../core/header-footer-ops';
import { runsFromPlainText } from '../core/header-footer-ops';

// ============================================================
// InlineHeaderFooterEditor
// ============================================================

export interface InlineHeaderFooterEditorProps {
  target: 'header' | 'footer';
  runs: TextRun[];
  area: { x: number; y: number; width: number; height: number };
  isActive: boolean;
  pageNumber: number;
  totalPages: number;
  textAlign?: 'left' | 'center' | 'right';
  onActivate: () => void;
  onChange: (runs: TextRun[]) => void;
  onCursorChange?: (offset: number) => void;
}

/**
 * Inline WYSIWYG editor for header/footer content.
 * Uses hidden textarea + styled overlay pattern (consistent with main editor).
 */
export function InlineHeaderFooterEditor({
  target,
  runs,
  area,
  isActive,
  pageNumber,
  totalPages,
  textAlign = 'left',
  onActivate,
  onChange,
  onCursorChange,
}: InlineHeaderFooterEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localText, setLocalText] = useState(() => runsToText(runs));

  // Sync local text when runs change externally
  useEffect(() => {
    setLocalText(runsToText(runs));
  }, [runs]);

  // Focus textarea when becoming active
  useEffect(() => {
    if (isActive && textareaRef.current) {
      textareaRef.current.focus({ preventScroll: true });
    }
  }, [isActive]);

  const handleClick = useCallback(() => {
    if (!isActive) {
      onActivate();
    }
  }, [isActive, onActivate]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setLocalText(newText);
      // Convert plain text to runs and notify parent
      const newRuns = runsFromPlainText(newText);
      onChange(newRuns);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Prevent event bubbling to main editor
      e.stopPropagation();
    },
    [],
  );

  const handleSelect = useCallback(
    (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      if (onCursorChange) {
        onCursorChange(e.currentTarget.selectionStart ?? 0);
      }
    },
    [onCursorChange],
  );

  // Build overlay content with resolved tokens and marks
  // In edit mode, show literal text (don't resolve tokens) to avoid overlay/textarea misalignment
  const overlayContent = runs.length > 0 
    ? isActive 
      ? renderRunsOverlay(runs, null) // null context = don't resolve tokens
      : renderRunsOverlay(runs, { pageNumber, totalPages })
    : null;

  return (
    <div
      data-testid="inline-hf-editor"
      data-target={target}
      className={`inline-hf-editor ${isActive ? 'active' : ''}`}
      style={{
        position: 'absolute',
        left: area.x,
        top: area.y,
        width: area.width,
        height: area.height,
        border: isActive ? '1px dashed #999' : '1px solid transparent',
        boxSizing: 'border-box',
        cursor: isActive ? 'text' : 'pointer',
        overflow: 'hidden',
      }}
      onClick={handleClick}
    >
      {/* Styled overlay — always visible */}
      <div
        className="inline-hf-overlay"
        style={{
          position: 'absolute',
          inset: 0,
          padding: '4px 8px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          pointerEvents: 'none',
          fontSize: 12,
          lineHeight: `${area.height - 8}px`,
          textAlign: textAlign,
        }}
      >
        {overlayContent}
      </div>

      {/* Textarea — only visible when active, text is transparent to show overlay */}
      {isActive && (
        <textarea
          ref={textareaRef}
          className="inline-hf-textarea"
          value={localText}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            padding: '4px 8px',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            resize: 'none',
            fontSize: 12,
            lineHeight: `${area.height - 8}px`,
            fontFamily: 'inherit',
            textAlign: textAlign,
            color: 'transparent',
            caretColor: 'black',
          }}
        />
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────

function runsToText(runs: TextRun[]): string {
  return runs.map((r) => r.content).join('');
}

function renderRunsOverlay(
  runs: TextRun[],
  context: { pageNumber: number; totalPages: number } | null,
): React.ReactNode {
  return runs.map((run, idx) => {
    const resolved = context ? resolveTokens(run.content, context) : run.content;
    const style: React.CSSProperties = {};
    if (run.marks.includes('bold')) style.fontWeight = 'bold';
    if (run.marks.includes('italic')) style.fontStyle = 'italic';
    if (run.marks.includes('underline')) style.textDecoration = 'underline';
    if (run.marks.includes('strikethrough')) {
      style.textDecoration = style.textDecoration
        ? `${style.textDecoration} line-through`
        : 'line-through';
    }
    if (run.attrs?.fontFamily) style.fontFamily = run.attrs.fontFamily;
    if (run.attrs?.fontSize) style.fontSize = run.attrs.fontSize;
    if (run.attrs?.color) style.color = run.attrs.color;

    return (
      <span key={run.id || idx} style={style}>
        {resolved}
      </span>
    );
  });
}
