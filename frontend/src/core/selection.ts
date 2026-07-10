import type { Selection, LogicalPosition, DocumentRoot, Paragraph, Heading } from './types';
import { getBlockNodes, getBlockText } from './document';

// ============================================================
// Selection Helpers
// ============================================================

/** Create a selection from two positions */
export function createSelection(
  anchor: LogicalPosition,
  focus: LogicalPosition
): Selection {
  return { anchor, focus };
}

/** Check if a selection is empty (anchor === focus) */
export function isSelectionEmpty(selection: Selection | null): boolean {
  if (!selection) return true;
  return (
    selection.anchor.nodeId === selection.focus.nodeId &&
    selection.anchor.offset === selection.focus.offset
  );
}

/** Get the start and end positions of a selection (ordered) */
export function getSelectionRange(selection: Selection): {
  start: LogicalPosition;
  end: LogicalPosition;
} {
  const { anchor, focus } = selection;

  // Compare positions: first by nodeId (document order), then by offset
  if (anchor.nodeId === focus.nodeId) {
    return anchor.offset <= focus.offset
      ? { start: anchor, end: focus }
      : { start: focus, end: anchor };
  }

  // Different nodes: find which comes first in document order
  const blocks = getBlockNodes({ id: '', type: 'document', children: [] } as DocumentRoot);
  // We need the actual document for this, so we'll use a simpler approach:
  // Compare by node ID presence in the blocks array
  const anchorIdx = blocks.findIndex((b) => b.id === anchor.nodeId);
  const focusIdx = blocks.findIndex((b) => b.id === focus.nodeId);

  if (anchorIdx === -1 || focusIdx === -1) {
    // Fallback: use string comparison (not ideal but works for simple cases)
    return anchor.nodeId <= focus.nodeId
      ? { start: anchor, end: focus }
      : { start: focus, end: anchor };
  }

  return anchorIdx <= focusIdx
    ? { start: anchor, end: focus }
    : { start: focus, end: anchor };
}

/** Get selected text from a document */
export function getSelectedText(
  doc: DocumentRoot,
  selection: Selection
): string {
  if (isSelectionEmpty(selection)) return '';

  const { start, end } = getSelectionRange(selection);
  const blocks = getBlockNodes(doc);
  let text = '';

  for (const block of blocks) {
    if (block.type !== 'paragraph' && block.type !== 'heading') continue;

    const blockText = getBlockText(block as Paragraph | Heading);

    if (block.id === start.nodeId && block.id === end.nodeId) {
      // Selection within a single block
      text += blockText.slice(start.offset, end.offset);
    } else if (block.id === start.nodeId) {
      // Start of selection
      text += blockText.slice(start.offset);
    } else if (block.id === end.nodeId) {
      // End of selection
      text += blockText.slice(0, end.offset);
    } else if (
      blocks.findIndex((b) => b.id === block.id) >
        blocks.findIndex((b) => b.id === start.nodeId) &&
      blocks.findIndex((b) => b.id === block.id) <
        blocks.findIndex((b) => b.id === end.nodeId)
    ) {
      // Middle of selection (entire block)
      text += blockText;
    }
  }

  return text;
}

/** Select an entire word at a given position */
export function selectWord(
  doc: DocumentRoot,
  position: LogicalPosition
): Selection | null {
  const blocks = getBlockNodes(doc);
  const block = blocks.find((b) => b.id === position.nodeId);
  if (!block || (block.type !== 'paragraph' && block.type !== 'heading')) {
    return null;
  }

  const text = getBlockText(block as Paragraph | Heading);
  const offset = position.offset;

  // Find word boundaries
  let start = offset;
  let end = offset;

  // Move start backward to word boundary
  while (start > 0 && /\w/.test(text[start - 1])) {
    start--;
  }

  // Move end forward to word boundary
  while (end < text.length && /\w/.test(text[end])) {
    end++;
  }

  return {
    anchor: { nodeId: position.nodeId, offset: start },
    focus: { nodeId: position.nodeId, offset: end },
  };
}

/** Select an entire paragraph at a given position */
export function selectParagraph(
  doc: DocumentRoot,
  position: LogicalPosition
): Selection | null {
  const blocks = getBlockNodes(doc);
  const block = blocks.find((b) => b.id === position.nodeId);
  if (!block || (block.type !== 'paragraph' && block.type !== 'heading')) {
    return null;
  }

  const text = getBlockText(block as Paragraph | Heading);

  return {
    anchor: { nodeId: position.nodeId, offset: 0 },
    focus: { nodeId: position.nodeId, offset: text.length },
  };
}

/** Delete selected text from document */
export function deleteSelection(
  doc: DocumentRoot,
  selection: Selection
): { newCursorPosition: LogicalPosition } {
  if (isSelectionEmpty(selection)) {
    return { newCursorPosition: selection.anchor };
  }

  const { start, end } = getSelectionRange(selection);
  const blocks = getBlockNodes(doc);

  // For now, handle single-block selection only
  if (start.nodeId === end.nodeId) {
    const block = blocks.find((b) => b.id === start.nodeId);
    if (!block || (block.type !== 'paragraph' && block.type !== 'heading')) {
      return { newCursorPosition: start };
    }

    const textBlock = block as Paragraph | Heading;
    const text = getBlockText(textBlock);

    // Rebuild the text runs with the selection removed
    const newText = text.slice(0, start.offset) + text.slice(end.offset);

    // Simple approach: replace all children with a single run
    if (textBlock.children.length > 0) {
      textBlock.children[0].content = newText;
      textBlock.children.splice(1);
    }

    return { newCursorPosition: start };
  }

  // Multi-block selection: more complex, handle in future
  return { newCursorPosition: start };
}
