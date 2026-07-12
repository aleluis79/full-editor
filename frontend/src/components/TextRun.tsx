import type { TextRun as TextRunType, Selection } from '../core/types';

interface TextRunProps {
  run: TextRunType;
  selection: Selection | null;
  blockId: string;
  runGlobalOffset?: number;
}

export function TextRun({ run, selection, blockId, runGlobalOffset = 0 }: TextRunProps) {
  const style: React.CSSProperties = {};

  // Boolean marks
  if (run.marks.includes('bold')) style.fontWeight = 'bold';
  if (run.marks.includes('italic')) style.fontStyle = 'italic';
  if (run.marks.includes('underline')) style.textDecoration = 'underline';
  if (run.marks.includes('strikethrough')) style.textDecoration = 'line-through';

  // If both underline and strikethrough, combine
  if (run.marks.includes('underline') && run.marks.includes('strikethrough')) {
    style.textDecoration = 'underline line-through';
  }

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

  const SEL_BG = 'rgba(0, 120, 215, 0.3)';

  if (isFullySelected) {
    style.backgroundColor = SEL_BG;
    return (
      <span className="text-run" data-run-id={run.id} style={style}>
        {run.content}
      </span>
    );
  }

  if (isPartiallySelected) {
    // Compute local offsets within this run
    const localStart = Math.max(0, selectionRange.start - runStart);
    const localEnd = Math.min(run.content.length, selectionRange.end - runStart);
    const before = run.content.slice(0, localStart);
    const selected = run.content.slice(localStart, localEnd);
    const after = run.content.slice(localEnd);

    return (
      <span className="text-run" data-run-id={run.id} style={style}>
        {before}<span style={{ backgroundColor: SEL_BG }}>{selected}</span>{after}
      </span>
    );
  }

  return (
    <span className="text-run" data-run-id={run.id} style={style}>
      {run.content}
    </span>
  );
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
