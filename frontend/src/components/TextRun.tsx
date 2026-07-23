import { useMemo } from 'react';
import type { TextRun as TextRunType, Selection } from '../core/types';
import type { Misspelling } from '../stores/spell-check-store';
import { useSpellCheckStore } from '../stores/spell-check-store';

// Stable empty array reference to avoid infinite re-render loops
const MISSING_NONE: Misspelling[] = [];

interface TextRunProps {
  run: TextRunType;
  selection: Selection | null;
  blockId: string;
  runGlobalOffset?: number;
}

/** Render the content inside a span, applying selection highlights and misspelling styling. */
function renderContent(
  run: TextRunType,
  style: React.CSSProperties,
  runId: string,
  isFullySelected: boolean,
  isPartiallySelected: boolean,
  selectionRange: { start: number; end: number } | null,
  runStart: number,
  runEnd: number,
  isMisspelled: boolean,
  misspelledRanges: Array<{ start: number; end: number }>,
  blockId: string,
) {
  const SEL_BG = 'rgba(0, 120, 215, 0.3)';
  const baseClassName = `text-run${isMisspelled ? ' spell-misspelled' : ''}`;

  /** Handle click on a misspelled word — show suggestion popover */
  const handleMisspelledClick = (e: React.MouseEvent, mStart: number, mEnd: number) => {
    e.preventDefault();
    e.stopPropagation();
    const store = useSpellCheckStore.getState();
    const misspellings = store.misspellings[blockId] ?? [];
    const misspelling = misspellings.find(
      (m) => m.start === mStart && m.end === mEnd
    );
    store.showPopover(
      {
        blockId,
        start: mStart,
        end: mEnd,
        suggestions: misspelling?.suggestions ?? [],
      },
      { x: e.clientX, y: e.clientY },
    );
  };

  // Check if specific character ranges within this run are misspelled
  if (misspelledRanges.length > 0) {
    // Build segments split by misspelling boundaries
    const boundaries = new Set<number>();
    boundaries.add(0);
    boundaries.add(run.content.length);

    for (const mr of misspelledRanges) {
      if (mr.start < runEnd && mr.end > runStart) {
        boundaries.add(Math.max(0, mr.start - runStart));
        boundaries.add(Math.min(run.content.length, mr.end - runStart));
      }
    }

    // Selection boundaries
    if (selectionRange) {
      if (runEnd > selectionRange.start && runStart < selectionRange.end) {
        boundaries.add(Math.max(0, selectionRange.start - runStart));
        boundaries.add(Math.min(run.content.length, selectionRange.end - runStart));
      }
    }

    const sortedBounds = Array.from(boundaries).sort((a, b) => a - b);
    const segments: Array<React.ReactNode> = [];

    for (let i = 0; i < sortedBounds.length - 1; i++) {
      const segStart = sortedBounds[i];
      const segEnd = sortedBounds[i + 1];
      if (segStart === segEnd) continue;

      const globalStart = runStart + segStart;
      const globalEnd = runStart + segEnd;
      const segText = run.content.slice(segStart, segEnd);

      const isSegMisspelled = misspelledRanges.some(
        (mr) => mr.start === globalStart && mr.end === globalEnd
      );

      const isSegSelected = selectionRange
        ? globalStart < selectionRange.end && globalEnd > selectionRange.start
        : false;

      const segClassName = `text-run${isSegMisspelled ? ' spell-misspelled' : ''}`;
      const segStyle: React.CSSProperties = isSegSelected
        ? { ...style, backgroundColor: SEL_BG }
        : { ...style };

      segments.push(
        <span
          key={`${runId}-${segStart}`}
          className={segClassName}
          style={segStyle}
          onClick={isSegMisspelled ? (e) => handleMisspelledClick(e, globalStart, globalEnd) : undefined}
        >
          {segText}
        </span>
      );
    }

    return <>{segments}</>;
  }

  if (isFullySelected) {
    style.backgroundColor = SEL_BG;
    return (
      <span className={baseClassName} data-run-id={runId} style={style} onClick={isMisspelled ? (e) => handleMisspelledClick(e, runStart, runEnd) : undefined}>
        {run.content}
      </span>
    );
  }

  if (isPartiallySelected) {
    const localStart = Math.max(0, selectionRange!.start - runStart);
    const localEnd = Math.min(run.content.length, selectionRange!.end - runStart);
    const before = run.content.slice(0, localStart);
    const selected = run.content.slice(localStart, localEnd);
    const after = run.content.slice(localEnd);

    return (
      <span className={baseClassName} data-run-id={runId} style={style} onClick={isMisspelled ? (e) => handleMisspelledClick(e, runStart, runEnd) : undefined}>
        {before}<span style={{ backgroundColor: SEL_BG }}>{selected}</span>{after}
      </span>
    );
  }

  return (
    <span className={baseClassName} data-run-id={runId} style={style} onClick={isMisspelled ? (e) => handleMisspelledClick(e, runStart, runEnd) : undefined}>
      {run.content}
    </span>
  );
}

export function TextRun({ run, selection, blockId, runGlobalOffset = 0 }: TextRunProps) {
  const style: React.CSSProperties = {};

  // Boolean marks
  if (run.marks.includes('bold')) style.fontWeight = 'bold';
  if (run.marks.includes('italic')) style.fontStyle = 'italic';
  if (run.marks.includes('superscript')) { style.verticalAlign = 'super'; style.fontSize = 'smaller'; }
  if (run.marks.includes('subscript')) { style.verticalAlign = 'sub'; style.fontSize = 'smaller'; }

  // Combine text-decoration for underline + strikethrough
  const textDecorations: string[] = [];
  if (run.marks.includes('underline')) textDecorations.push('underline');
  if (run.marks.includes('strikethrough')) textDecorations.push('line-through');
  if (textDecorations.length > 0) style.textDecoration = textDecorations.join(' ');

  // Style attributes
  if (run.attrs?.fontFamily) style.fontFamily = run.attrs.fontFamily;
  if (run.attrs?.fontSize) style.fontSize = run.attrs.fontSize;
  if (run.attrs?.color) style.color = run.attrs.color;
  if (run.attrs?.backgroundColor) style.backgroundColor = run.attrs.backgroundColor;

  // Check if this run has selected text
  const selectionRange = selection ? getSelectionRangeInBlock(selection, blockId) : null;
  const runStart = runGlobalOffset;
  const runEnd = runStart + run.content.length;

  // Determine overlap between selection range and this run
  const isSelected = selectionRange !== null;
  const isFullySelected = isSelected &&
    selectionRange.start <= runStart && selectionRange.end >= runEnd;
  const isPartiallySelected = isSelected && !isFullySelected &&
    selectionRange.start < runEnd && selectionRange.end > runStart;

  // ── Spell check support ────────────────────────────────────
  const spellCheckEnabled = useSpellCheckStore((s) => s.enabled);
  // Use the full misspellings map and memoize per-block lookups to
  // avoid creating new array references that cause infinite re-render loops
  const allMisspellings = useSpellCheckStore((s) => s.misspellings);

  const blockMisspellings = useMemo(
    () => (spellCheckEnabled && allMisspellings[blockId] ? allMisspellings[blockId] : MISSING_NONE),
    [spellCheckEnabled, allMisspellings, blockId],
  );

  const isMisspelled = useMemo(() => {
    if (!spellCheckEnabled || blockMisspellings.length === 0) return false;
    return blockMisspellings.some((m) => m.start >= runStart && m.end <= runEnd);
  }, [spellCheckEnabled, blockMisspellings, runStart, runEnd]);

  // Get misspelled ranges overlapping this run for segment splitting
  const misspelledRanges = useMemo(() => {
    if (!spellCheckEnabled || blockMisspellings.length === 0) return MISSING_NONE;
    return blockMisspellings.filter(
      (m) => m.start < runEnd && m.end > runStart
    ).map((m) => ({ start: m.start, end: m.end }));
  }, [spellCheckEnabled, blockMisspellings, runStart, runEnd]);

  const content = renderContent(
    run, style, run.id,
    isFullySelected, isPartiallySelected,
    selectionRange, runStart, runEnd,
    isMisspelled, misspelledRanges, blockId,
  );

  // Render as <a> when href is set
  if (run.href) {
    const linkStyle: React.CSSProperties = {
      color: 'blue',
      textDecoration: 'underline',
      cursor: 'pointer',
    };
    const handleLinkClick = (e: React.MouseEvent) => {
      // Ctrl+Click / Meta+Click → let browser navigate
      // Single click → prevent, let editor handle cursor position
      if (!e.ctrlKey && !e.metaKey && e.button === 0) {
        e.preventDefault();
      }
    };
    return (
      <a href={run.href} target="_blank" rel="noopener noreferrer" onClick={handleLinkClick} style={linkStyle}>
        {content}
      </a>
    );
  }

  return content;
}

/** Get the start and end offsets of a selection within a specific block */
export function getSelectionRangeInBlock(
  selection: Selection,
  blockId: string
): { start: number; end: number } | null {
  if (selection.anchor.nodeId !== blockId && selection.focus.nodeId !== blockId) {
    return null;
  }

  let start = 0;
  let end = Infinity;

  if (selection.anchor.nodeId === blockId) {
    start = selection.anchor.offset;
  }
  if (selection.focus.nodeId === blockId) {
    end = selection.focus.offset;
  }

  // When both are in the same block, order correctly
  if (selection.anchor.nodeId === blockId && selection.focus.nodeId === blockId) {
    start = Math.min(selection.anchor.offset, selection.focus.offset);
    end = Math.max(selection.anchor.offset, selection.focus.offset);
  }

  return { start, end };
}
