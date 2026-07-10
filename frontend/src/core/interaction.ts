// ============================================================
// Interaction Utilities
// ============================================================
// Maps between screen coordinates (clientX/clientY) and logical
// document positions (blockId + offset) using the DOM's native
// caret positioning APIs — the same approach used by ProseMirror,
// Quill, and other production rich-text editors.
// ============================================================

/**
 * Get the caret position (node + offset) from a viewport point.
 * Uses the standard `CaretPosition` API (Firefox) with a fallback
 * to the WebKit `caretRangeFromPoint` (Chrome, Safari, Edge).
 */
function getCaretPosition(
  x: number,
  y: number
): { node: Node; offset: number } | null {
  // Standard API (Firefox)
  if (
    typeof document !== 'undefined' &&
    'caretPositionFromPoint' in document
  ) {
    try {
      const pos = (document as any).caretPositionFromPoint(x, y);
      if (pos) return { node: pos.offsetNode, offset: pos.offset };
    } catch {
      // Silently fall through
    }
  }

  // Non-standard but widely supported (Chrome, Safari, Edge)
  if (
    typeof document !== 'undefined' &&
    'caretRangeFromPoint' in document
  ) {
    try {
      const range = (document as any).caretRangeFromPoint(x, y);
      if (range) return { node: range.startContainer, offset: range.startOffset };
    } catch {
      // Silently fall through
    }
  }

  return null;
}

/**
 * Walk up the DOM tree from a node to find the nearest element
 * with a `data-block-id` attribute.
 */
export function findBlockId(node: Node): string | null {
  let el: Element | null =
    node instanceof Element ? node : node.parentElement;

  while (el) {
    const blockId = el.getAttribute('data-block-id');
    if (blockId) return blockId;
    el = el.parentElement;
  }

  return null;
}

/**
 * Convert a viewport point (clientX, clientY) to a character offset
 * within the given block element.
 *
 * Returns 0 if the point is outside the block or the caret API is
 * unavailable.
 */
export function getOffsetFromPoint(
  blockEl: HTMLElement,
  clientX: number,
  clientY: number
): number {
  const caret = getCaretPosition(clientX, clientY);
  if (!caret || !blockEl.contains(caret.node)) {
    return 0;
  }

  // Walk text nodes inside the block to compute the concatenated offset
  let globalOffset = 0;
  const walker = document.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT);
  let node: Text | null;

  while ((node = walker.nextNode() as Text | null)) {
    if (node === caret.node) {
      return globalOffset + caret.offset;
    }
    globalOffset += node.length;
  }

  return globalOffset;
}

/**
 * Convert a character offset within a block element to its viewport
 * screen position { x, y, height }.
 *
 * Returns null if the block element has no text content or the
 * element is not mounted.
 */
export function getPointFromOffset(
  blockEl: HTMLElement,
  offset: number
): { x: number; y: number; height: number } | null {
  const walker = document.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT);
  let charIndex = 0;
  let textNode: Text | null;

  while ((textNode = walker.nextNode() as Text | null)) {
    const nodeLen = textNode.length;
    if (charIndex + nodeLen >= offset) {
      const localOffset = Math.min(offset - charIndex, nodeLen);
      const range = document.createRange();
      range.setStart(textNode, localOffset);
      range.collapse(true);

      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        return null;
      }
      return { x: rect.left, y: rect.top, height: rect.height };
    }
    charIndex += nodeLen;
  }

  // Offset past all text — use the position after the last child
  const lastChild = blockEl.lastChild;
  if (lastChild) {
    const range = document.createRange();
    range.setStartAfter(lastChild);
    range.collapse(true);
    const rect = range.getBoundingClientRect();
    return { x: rect.left, y: rect.top, height: rect.height || 24 };
  }

  return null;
}

/**
 * Convert a DOM node and character offset to a logical position
 * (nodeId + offset) within the document. Used to translate native
 * browser selection ranges to the editor's logical coordinate system.
 */
export function nodeToLogicalPosition(
  node: Node,
  offset: number
): { nodeId: string; offset: number } | null {
  const nodeId = findBlockId(node);
  if (!nodeId) return null;

  const blockEl = document.querySelector(
    `[data-block-id="${nodeId}"]`
  ) as HTMLElement | null;
  if (!blockEl) return null;

  // Walk text nodes inside the block to compute the concatenated offset
  let globalOffset = 0;
  const walker = document.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT);
  let textNode: Text | null;

  while ((textNode = walker.nextNode() as Text | null)) {
    if (textNode === node) {
      return { nodeId, offset: globalOffset + offset };
    }
    globalOffset += textNode.length;
  }

  // If the node is the block element itself or a non-text child,
  // use the block-relative position
  return { nodeId, offset: globalOffset };
}

/**
 * Given a viewport point, find the block element and character offset
 * in the document. Works across blocks — if the point lands in a
 * different block, returns that block's ID and offset.
 *
 * Uses a two-phase approach:
 *  1. `caretPositionFromPoint` (precise but can land on non-block content
 *     like page numbers, causing `findBlockId` to return null)
 *  2. `elementFromPoint` fallback (finds the VISIBLE element at (x, y),
 *     which reliably points to the block content underneath)
 *
 * Returns null if the point doesn't land on any block.
 */
export function hitTest(
  clientX: number,
  clientY: number
): { blockId: string; offset: number } | null {
  // Phase 1: try caretPositionFromPoint (precise offset, but may land on
  // non-block elements like page footers/numbers)
  const caret = getCaretPosition(clientX, clientY);
  if (caret) {
    const blockId = findBlockId(caret.node);
    if (blockId) {
      const blockEl = document.querySelector(
        `[data-block-id="${blockId}"]`
      ) as HTMLElement | null;
      if (blockEl) {
        const offset = getOffsetFromPoint(blockEl, clientX, clientY);
        return { blockId, offset };
      }
    }
  }

  // Phase 2: elementFromPoint fallback — if caretPositionFromPoint landed
  // on the page number, footer, or other non-block content,
  // elementFromPoint finds what's actually VISIBLE at this coordinate.
  const el = document.elementFromPoint(clientX, clientY);
  if (!el) return null;

  const elBlockId = findBlockId(el);
  if (!elBlockId) return null;

  const elBlockEl = document.querySelector(
    `[data-block-id="${elBlockId}"]`
  ) as HTMLElement | null;
  if (!elBlockEl) return null;

  const offset = getOffsetFromPoint(elBlockEl, clientX, clientY);
  return { blockId: elBlockId, offset };
}
