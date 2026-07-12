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
export function getSelectionRange(
  selection: Selection,
  doc?: DocumentRoot
): {
  start: LogicalPosition;
  end: LogicalPosition;
} {
  const { anchor, focus } = selection;

  // Same block: compare by offset
  if (anchor.nodeId === focus.nodeId) {
    return anchor.offset <= focus.offset
      ? { start: anchor, end: focus }
      : { start: focus, end: anchor };
  }

  // Different nodes: determine document order from actual blocks
  const blocks = doc
    ? getBlockNodes(doc)
    : getBlockNodes({ id: '', type: 'document', children: [] } as DocumentRoot);

  const anchorIdx = blocks.findIndex((b) => b.id === anchor.nodeId);
  const focusIdx = blocks.findIndex((b) => b.id === focus.nodeId);

  if (anchorIdx === -1 || focusIdx === -1) {
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

  const { start, end } = getSelectionRange(selection, doc);
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

/** Delete selected text from document, removing empty blocks */
export function deleteSelection(
  doc: DocumentRoot,
  selection: Selection
): { newCursorPosition: LogicalPosition } {
  if (isSelectionEmpty(selection)) {
    return { newCursorPosition: selection.anchor };
  }

  const { start, end } = getSelectionRange(selection, doc);
  const blocks = getBlockNodes(doc);

  const startBlock = blocks.find((b) => b.id === start.nodeId);
  const endBlock = blocks.find((b) => b.id === end.nodeId);

  if (!startBlock || (startBlock.type !== 'paragraph' && startBlock.type !== 'heading')) {
    return { newCursorPosition: start };
  }

  // ---- Multi-block: delete across blocks ----
  const isMultiBlock = start.nodeId !== end.nodeId;

  if (isMultiBlock) {
    // Find indices to delete from doc.children
    const children = doc.children;
    const childStartIdx = children.findIndex((c) => c.id === start.nodeId);
    const childEndIdx = children.findIndex((c) => c.id === end.nodeId);
    if (childStartIdx < 0 || childEndIdx < 0) return { newCursorPosition: start };

    const minIdx = Math.min(childStartIdx, childEndIdx);
    const maxIdx = Math.max(childStartIdx, childEndIdx);

    // Keep text before start.offset in the first block
    const firstBlock = children[minIdx] as Paragraph | Heading;
    const firstText = getBlockText(firstBlock);
    const newFirstText = firstText.slice(0, start.offset);

    // Keep text after end.offset in the last block (same as single-block does)
    const lastBlock = children[maxIdx] as Paragraph | Heading;
    const lastText = getBlockText(lastBlock);
    const newLastText = lastText.slice(end.offset);

    // Merge both remaining fragments into the first block
    const merged = newFirstText + newLastText;
    if (merged.length > 0) {
      firstBlock.children[0].content = merged;
      firstBlock.children.splice(1);
    }

    // Remove intermediate blocks and the last block (its trailing text
    // was already merged into the first block above — the block itself
    // is now redundant and must be removed).
    const removeStart = merged.length === 0 ? minIdx : minIdx + 1;
    const removeEnd = maxIdx;
    if (removeStart <= removeEnd) {
      children.splice(removeStart, removeEnd - removeStart + 1);
    }

    // Determine cursor position
    if (merged.length > 0) {
      // Cursor goes after the first-fragment text (before any merged trailing text)
      return { newCursorPosition: { nodeId: firstBlock.id, offset: newFirstText.length } };
    }
    // Everything was removed — cursor at previous block end or document start
    if (children.length > 0 && minIdx > 0) {
      const prevBlock = children[minIdx - 1];
      const prevText = (prevBlock.type === 'paragraph' || prevBlock.type === 'heading')
        ? getBlockText(prevBlock as Paragraph | Heading)
        : 0;
      return { newCursorPosition: { nodeId: prevBlock.id, offset: prevText } };
    }
    if (children.length > 0) {
      return { newCursorPosition: { nodeId: children[0].id, offset: 0 } };
    }
    return { newCursorPosition: { nodeId: '', offset: 0 } };
  }

  // ---- Single-block: delete within same block ----
  const block = startBlock as Paragraph | Heading;
  const text = getBlockText(block);

  // Rebuild the text runs with the selection removed
  const newText = text.slice(0, start.offset) + text.slice(end.offset);

  if (newText.length === 0) {
    // Block is now empty — remove it
    const children = doc.children;
    const idx = children.findIndex((c) => c.id === block.id);
    if (idx >= 0) {
      children.splice(idx, 1);
    }
    // Cursor at previous block end, or first block, or nowhere
    if (children.length > 0 && idx > 0) {
      const prevBlock = children[idx - 1];
      const prevText = (prevBlock.type === 'paragraph' || prevBlock.type === 'heading')
        ? getBlockText(prevBlock as Paragraph | Heading)
        : 0;
      return { newCursorPosition: { nodeId: prevBlock.id, offset: prevText } };
    }
    if (children.length > 0) {
      return { newCursorPosition: { nodeId: children[0].id, offset: 0 } };
    }
    return { newCursorPosition: { nodeId: '', offset: 0 } };
  }

  // Simple approach: replace all children with a single run
  if (block.children.length > 0) {
    block.children[0].content = newText;
    block.children.splice(1);
  }

  return { newCursorPosition: start };
}
