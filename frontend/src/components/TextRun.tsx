import type { TextRun as TextRunType, Selection } from '../core/types';

interface TextRunProps {
  run: TextRunType;
  selection: Selection | null;
  blockId: string;
}

export function TextRun({ run, selection, blockId }: TextRunProps) {
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
  const isFullySelected = selection && isRunFullySelected(run, blockId, selection);
  const hasPartialSelection = selection && !isFullySelected && isRunPartiallySelected(run, blockId, selection);

  if (isFullySelected) {
    style.backgroundColor = 'rgba(0, 120, 215, 0.3)';
  } else if (hasPartialSelection) {
    // For partial selection, we'll use a wrapper approach
    // This is simplified — full implementation would split the run
    style.backgroundColor = 'rgba(0, 120, 215, 0.3)';
  }

  return (
    <span className="text-run" data-run-id={run.id} style={style}>
      {run.content}
    </span>
  );
}

/** Check if a run is fully within the selection */
function isRunFullySelected(
  run: TextRunType,
  blockId: string,
  selection: Selection
): boolean {
  if (selection.anchor.nodeId !== blockId && selection.focus.nodeId !== blockId) {
    return false;
  }

  if (selection.anchor.nodeId === blockId && selection.focus.nodeId === blockId) {
    // Single block selection
    const start = Math.min(selection.anchor.offset, selection.focus.offset);
    const end = Math.max(selection.anchor.offset, selection.focus.offset);

    // Calculate run position within block
    // This is simplified — we assume runs are in order
    return start === 0 && end >= run.content.length;
  }

  return false;
}

/** Check if a run is partially within the selection */
function isRunPartiallySelected(
  _run: TextRunType,
  blockId: string,
  selection: Selection
): boolean {
  if (selection.anchor.nodeId !== blockId && selection.focus.nodeId !== blockId) {
    return false;
  }

  // Simplified check
  return selection.anchor.nodeId === blockId || selection.focus.nodeId === blockId;
}
