import type { Cursor, Paragraph, Heading, DocumentRoot } from './types';
import { getBlockText, getBlockNodes, getNextBlock, getPreviousBlock } from './document';

// ============================================================
// Cursor Helpers
// ============================================================

/** Create a cursor at the beginning of a block */
export function createCursorAtStart(blockId: string): Cursor {
  return {
    position: { nodeId: blockId, offset: 0 },
  };
}

/** Create a cursor at the end of a block */
export function createCursorAtEnd(block: Paragraph | Heading): Cursor {
  const text = getBlockText(block);
  return {
    position: { nodeId: block.id, offset: text.length },
  };
}

/** Move cursor right by one character */
export function moveCursorRight(
  doc: DocumentRoot,
  cursor: Cursor
): Cursor {
  const { nodeId, offset } = cursor.position;
  const blocks = getBlockNodes(doc);
  const currentBlock = blocks.find((b) => b.id === nodeId);

  if (!currentBlock || (currentBlock.type !== 'paragraph' && currentBlock.type !== 'heading')) {
    return cursor;
  }

  const text = getBlockText(currentBlock as Paragraph | Heading);

  if (offset < text.length) {
    // Move within the block
    return { position: { nodeId, offset: offset + 1 } };
  }

  // Move to next block
  const nextBlock = getNextBlock(doc, nodeId);
  if (nextBlock && (nextBlock.type === 'paragraph' || nextBlock.type === 'heading')) {
    return { position: { nodeId: nextBlock.id, offset: 0 } };
  }

  return cursor; // Already at end of document
}

/** Move cursor left by one character */
export function moveCursorLeft(
  doc: DocumentRoot,
  cursor: Cursor
): Cursor {
  const { nodeId, offset } = cursor.position;

  if (offset > 0) {
    return { position: { nodeId, offset: offset - 1 } };
  }

  // Move to end of previous block
  const prevBlock = getPreviousBlock(doc, nodeId);
  if (prevBlock && (prevBlock.type === 'paragraph' || prevBlock.type === 'heading')) {
    const text = getBlockText(prevBlock as Paragraph | Heading);
    return { position: { nodeId: prevBlock.id, offset: text.length } };
  }

  return cursor; // Already at beginning of document
}

/** Move cursor to beginning of current line (simplified: beginning of block) */
export function moveCursorToLineStart(
  _doc: DocumentRoot,
  cursor: Cursor
): Cursor {
  return { position: { nodeId: cursor.position.nodeId, offset: 0 } };
}

/** Move cursor to end of current line (simplified: end of block) */
export function moveCursorToLineEnd(
  doc: DocumentRoot,
  cursor: Cursor
): Cursor {
  const blocks = getBlockNodes(doc);
  const currentBlock = blocks.find((b) => b.id === cursor.position.nodeId);

  if (!currentBlock || (currentBlock.type !== 'paragraph' && currentBlock.type !== 'heading')) {
    return cursor;
  }

  const text = getBlockText(currentBlock as Paragraph | Heading);
  return { position: { nodeId: cursor.position.nodeId, offset: text.length } };
}

/** Clamp cursor position to valid range */
export function clampCursor(
  doc: DocumentRoot,
  cursor: Cursor
): Cursor {
  const blocks = getBlockNodes(doc);
  const currentBlock = blocks.find((b) => b.id === cursor.position.nodeId);

  if (!currentBlock) {
    // Block not found, move to first block
    const firstBlock = blocks[0];
    if (firstBlock) {
      return { position: { nodeId: firstBlock.id, offset: 0 } };
    }
    return cursor;
  }

  if (currentBlock.type !== 'paragraph' && currentBlock.type !== 'heading') {
    return cursor;
  }

  const text = getBlockText(currentBlock as Paragraph | Heading);
  const maxOffset = text.length;

  return {
    position: {
      nodeId: cursor.position.nodeId,
      offset: Math.max(0, Math.min(cursor.position.offset, maxOffset)),
    },
  };
}
