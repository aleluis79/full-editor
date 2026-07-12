import type {
  DocumentRoot,
  Paragraph,
  Heading,
  Blockquote,
  List,
  Table,
  TextRun,
  BlockNode,
  NodeId,
  MarkType,
  StyleAttrs,
  InsertTextOp,
  DeleteTextOp,
  SplitBlockOp,
  MergeBlocksOp,
  ToggleMarkOp,
  SetStyleOp,
  SetBlockAttrsOp,
  InsertBlockOp,
  ConvertBlockOp,
  DeleteBlockOp,
  InsertImageOp,
  ResizeImageOp,
  InsertTableOp,
  AddTableRowOp,
  AddTableColumnOp,
  DeleteTableRowOp,
  DeleteTableColumnOp,
  MergeTableCellsOp,
  Operation,
} from './types';
import {
  createId,
  createTextRun,
  createParagraph,
  createHeading,
  createList,
  createListItem,
  createBlockquote,
  createHorizontalRule,
  createImage,
  createTable,
  createTableCell,
  createTableRow,
  getBlockText,
  findNode,
  getBlockNodes,
} from './document';

// ============================================================
// InsertText Operation
// ============================================================

export function createInsertTextOp(
  blockId: NodeId,
  offset: number,
  text: string
): InsertTextOp {
  return {
    type: 'insertText',
    blockId,
    offset,
    text,
  };
}

export function applyInsertText(
  doc: DocumentRoot,
  op: InsertTextOp,
  marks?: MarkType[],
  attrs?: StyleAttrs,
): void {
  const block = findNode(doc, op.blockId);

  if (!block || (block.type !== 'paragraph' && block.type !== 'heading')) {
    throw new Error(`Block ${op.blockId} not found or is not a text block`);
  }

  const textBlock = block as Paragraph | Heading;

  const { runIndex, localOffset } = findRunAtOffset(textBlock, op.offset);

  const run = textBlock.children[runIndex];
  if (!run) {
    console.error('Run not found at index:', runIndex);
    return;
  }

  // Check if sticky marks/attrs differ from the current run's marks.
  // If they do, split the run and insert a new run with the given marks/attrs.
  const marksDiffer = marks && (marks.length !== run.marks.length ||
    marks.some((m, i) => m !== run.marks[i]));
  const attrsDefined = attrs && Object.keys(attrs).length > 0;
  const attrsDiffer = attrsDefined && JSON.stringify(attrs) !== JSON.stringify(run.attrs ?? {});

  if ((marksDiffer || attrsDiffer) && textBlock.children.length > 0) {
    // Split existing run at insertion point
    const beforeContent = run.content.slice(0, localOffset);
    const afterContent = run.content.slice(localOffset);

    const newRun: TextRun = {
      id: createId(),
      type: 'text',
      content: op.text,
      marks: marks ?? [],
      attrs: attrs ?? run.attrs,
    };

    const replacement = [run, run]; // placeholder — replace below
    // Build the replacement runs
    const newRuns: TextRun[] = [];

    if (beforeContent) {
      newRuns.push({ ...run, content: beforeContent });
    }
    newRuns.push(newRun);
    if (afterContent) {
      newRuns.push({ ...run, content: afterContent });
      // If the after-run is empty in its current state (run had only before+text),
      // keep it as a placeholder for cursor positioning
    }

    textBlock.children.splice(runIndex, 1, ...newRuns);
  } else {
    // Same marks/attrs or no overrides — insert into existing run
    run.content =
      run.content.slice(0, localOffset) + op.text + run.content.slice(localOffset);
  }
}

export function invertInsertText(op: InsertTextOp): DeleteTextOp {
  return {
    type: 'deleteText',
    blockId: op.blockId,
    offset: op.offset,
    text: op.text,
  };
}

// ============================================================
// DeleteText Operation
// ============================================================

export function createDeleteTextOp(
  blockId: NodeId,
  offset: number,
  direction: 'backward' | 'forward' = 'backward'
): DeleteTextOp | null {
  // We need the document to know what text to delete
  // This is handled by the store which has access to the document
  return {
    type: 'deleteText',
    blockId,
    offset: direction === 'backward' ? offset - 1 : offset,
    text: '', // Will be filled by the store
  };
}

export function applyDeleteText(doc: DocumentRoot, op: DeleteTextOp): void {
  const block = findNode(doc, op.blockId);
  if (!block || (block.type !== 'paragraph' && block.type !== 'heading')) {
    throw new Error(`Block ${op.blockId} not found or is not a text block`);
  }

  const textBlock = block as Paragraph | Heading;
  const blockText = getBlockText(textBlock);

  // Cannot delete at boundaries
  if (op.offset < 0 || op.offset >= blockText.length) return;

  // Delete `op.text.length` characters starting at `op.offset`.
  // This handles batched insertText undo where multiple characters
  // were merged into a single history entry.
  // After each deletion the subsequent characters shift left, so we
  // always delete at the SAME offset (op.offset) — NOT offset + i.
  const charsToDelete = op.text.length || 1;

  for (let i = 0; i < charsToDelete; i++) {
    if (op.offset >= getBlockText(textBlock).length) break;

    const { runIndex, localOffset } = findRunAtOffset(textBlock, op.offset);
    const run = textBlock.children[runIndex];
    run.content =
      run.content.slice(0, localOffset) + run.content.slice(localOffset + 1);

    // If run is now empty, remove it (but keep at least one run)
    if (run.content === '' && textBlock.children.length > 1) {
      textBlock.children.splice(runIndex, 1);
    }
  }
}

export function invertDeleteText(op: DeleteTextOp): InsertTextOp {
  return {
    type: 'insertText',
    blockId: op.blockId,
    offset: op.offset,
    text: op.text,
  };
}

// ============================================================
// SplitBlock Operation
// ============================================================

export function createSplitBlockOp(
  blockId: NodeId,
  offset: number
): SplitBlockOp {
  return {
    type: 'splitBlock',
    blockId,
    offset,
    newBlockId: '', // Will be filled after execution
  };
}

export function applySplitBlock(doc: DocumentRoot, op: SplitBlockOp): NodeId {
  const block = findNode(doc, op.blockId);
  if (!block || block.type !== 'paragraph') {
    throw new Error(`Block ${op.blockId} not found or is not a paragraph`);
  }

  const paragraph = block as Paragraph;
  const { runIndex, localOffset } = findRunAtOffset(paragraph, op.offset);

  // Split the run at the offset
  const run = paragraph.children[runIndex];
  const textBefore = run.content.slice(0, localOffset);
  const textAfter = run.content.slice(localOffset);

  // Update the original run with text before
  run.content = textBefore;

  // Create new paragraph with text after
  const newChildren: TextRun[] = [];
  if (textAfter) {
    newChildren.push(createTextRun(textAfter, [...run.marks]));
  } else {
    newChildren.push(createTextRun(''));
  }

  // Add remaining runs from original paragraph to new paragraph
  for (let i = runIndex + 1; i < paragraph.children.length; i++) {
    newChildren.push({ ...paragraph.children[i], id: paragraph.children[i].id });
  }

  // Remove moved runs from original
  paragraph.children.splice(runIndex + 1);

  // If original paragraph has no children left, add empty run
  if (paragraph.children.length === 0) {
    paragraph.children.push(createTextRun(''));
  }

  const newParagraph = createParagraph('');
  newParagraph.children = newChildren;

  // Check if paragraph is inside a list item — if so, create a new list item instead
  // of a top-level paragraph, and insert it in the list.
  for (const top of doc.children) {
    if (top.type === 'list') {
      const list = top as List;
      for (let i = 0; i < list.children.length; i++) {
        const item = list.children[i];
        // Check if the split block is inside this list item (the paragraph itself
        // or any nested list's paragraphs).
        const found = item.id === op.blockId ||
          item.children.some((c) => c.id === op.blockId ||
            (c.type === 'list' && findNode(c, op.blockId)));
        if (found) {
          // Create a new list item with the overflow paragraph
          const newItem = createListItem([newParagraph]);
          list.children.splice(i + 1, 0, newItem);
          return newParagraph.id;
        }
        // Check nested lists
        if (item.children.some((c) => c.type === 'list')) {
          for (const child of item.children) {
            if (child.type === 'list') {
              const nestedList = child as List;
              for (let j = 0; j < nestedList.children.length; j++) {
                const nestedItem = nestedList.children[j];
                if (nestedItem.children.some((c) => c.id === op.blockId)) {
                  const newNestedItem = createListItem([newParagraph]);
                  nestedList.children.splice(j + 1, 0, newNestedItem);
                  return newParagraph.id;
                }
              }
            }
          }
        }
      }
    }
  }

  // Not inside a list — insert as top-level paragraph
  const childIndex = doc.children.findIndex((c) => c.id === op.blockId);
  if (childIndex >= 0) {
    doc.children.splice(childIndex + 1, 0, newParagraph);
  }

  return newParagraph.id;
}

export function invertSplitBlock(op: SplitBlockOp): MergeBlocksOp {
  return {
    type: 'mergeBlocks',
    blockId: op.blockId,
    previousBlockId: op.blockId,
    offset: op.offset,
  };
}

// ============================================================
// MergeBlocks Operation (inverse of split)
// ============================================================

export function applyMergeBlocks(doc: DocumentRoot, op: MergeBlocksOp): void {
  const block = findNode(doc, op.previousBlockId);
  if (!block || (block.type !== 'paragraph' && block.type !== 'heading')) {
    return;
  }

  const paragraph = block as Paragraph;
  const childIndex = doc.children.findIndex((c) => c.id === op.previousBlockId);

  if (childIndex < 0 || childIndex >= doc.children.length - 1) {
    return; // No next block to merge with
  }

  const nextBlock = doc.children[childIndex + 1];
  if (!nextBlock || (nextBlock.type !== 'paragraph' && nextBlock.type !== 'heading')) {
    return;
  }

  const nextParagraph = nextBlock as Paragraph;

  // Preserve formatting: push all children (text runs with marks/styles) from the next block
  paragraph.children.push(...nextParagraph.children);

  // Clean up empty runs without marks or attrs — they accumulate after
  // repeated split/merge cycles and can affect line-height rendering
  // when empty spans inherit font-size from sibling runs.
  paragraph.children = paragraph.children.filter(
    (run) => run.content !== '' || run.marks.length > 0 || (run.attrs && Object.keys(run.attrs).length > 0)
  );

  // Ensure at least one run remains
  if (paragraph.children.length === 0) {
    paragraph.children.push(createTextRun(''));
  }

  // Remove the next block
  doc.children.splice(childIndex + 1, 1);
}

export function invertMergeBlocks(op: MergeBlocksOp): SplitBlockOp {
  return {
    type: 'splitBlock',
    blockId: op.previousBlockId,
    offset: op.offset,
    newBlockId: '',
  };
}

// ============================================================
// Apply any operation
// ============================================================

export function applyOperation(doc: DocumentRoot, op: Operation): NodeId | null {
  switch (op.type) {
    case 'insertText':
      applyInsertText(doc, op);
      return null;

    case 'deleteText':
      applyDeleteText(doc, op);
      return null;

    case 'splitBlock': {
      const newId = applySplitBlock(doc, op);
      return newId;
    }

    case 'mergeBlocks':
      applyMergeBlocks(doc, op);
      return null;

    case 'toggleMark':
      applyToggleMark(doc, op);
      return null;

    case 'setStyle':
      applySetStyle(doc, op);
      return null;

    case 'setBlockAttrs':
      applySetBlockAttrs(doc, op);
      return null;

    case 'insertBlock':
      applyInsertBlock(doc, op);
      return null;

    case 'convertBlock':
      applyConvertBlock(doc, op);
      return null;

    case 'deleteBlock':
      applyDeleteBlock(doc, op);
      return null;

    case 'insertImage':
      applyInsertImage(doc, op);
      return null;

    case 'resizeImage':
      applyResizeImage(doc, op);
      return null;

    case 'insertTable':
      applyInsertTable(doc, op);
      return null;

    case 'addTableRow':
      applyAddTableRow(doc, op);
      return null;

    case 'addTableColumn':
      applyAddTableColumn(doc, op);
      return null;

    case 'deleteTableRow':
      applyDeleteTableRow(doc, op);
      return null;

    case 'deleteTableColumn':
      applyDeleteTableColumn(doc, op);
      return null;

    case 'mergeTableCells':
      applyMergeTableCells(doc, op);
      return null;

    default:
      return null;
  }
}

// ============================================================
// Invert any operation
// ============================================================

export function invertOperation(op: Operation): Operation {
  switch (op.type) {
    case 'insertText':
      return invertInsertText(op);

    case 'deleteText':
      return invertDeleteText(op);

    case 'splitBlock':
      return invertSplitBlock(op);

    case 'mergeBlocks':
      return invertMergeBlocks(op);

    case 'toggleMark':
      return invertToggleMark(op);

    case 'setStyle':
      return invertSetStyle(op);

    case 'setBlockAttrs':
      return invertSetBlockAttrs(op);

    case 'insertBlock':
      return invertInsertBlock(op);

    case 'convertBlock':
      return invertConvertBlock(op);

    case 'deleteBlock':
      return invertDeleteBlock(op);

    case 'insertImage':
      return invertInsertImage(op);

    case 'resizeImage':
      return invertResizeImage(op);

    case 'insertTable':
      return invertInsertTable(op);

    case 'addTableRow':
      return invertAddTableRow(op);

    case 'addTableColumn':
      return invertAddTableColumn(op);

    case 'deleteTableRow':
      return invertDeleteTableRow(op);

    case 'deleteTableColumn':
      return invertDeleteTableColumn(op);

    case 'mergeTableCells':
      return invertMergeTableCells(op);

    default:
      return op;
  }
}

// ============================================================
// ToggleMark Operation
// ============================================================

/**
 * Split runs at the selection boundaries so that the selected range
 * aligns exactly with run boundaries. Returns the (start, end) run
 * indices for the range that should receive the mark.
 *
 * Splits from RIGHT to LEFT so earlier indices don't shift.
 */
function splitRunsAtRange(
  block: Paragraph | Heading,
  startOffset: number,
  endOffset: number
): { startRunIndex: number; endRunIndex: number } {
  if (startOffset === endOffset) {
    // No selection — nothing to split
    return { startRunIndex: -1, endRunIndex: -1 };
  }

  let start = findRunAtOffset(block, startOffset);
  let end = findRunAtOffset(block, endOffset);

  // Bail if both point into the same run without needing a split
  // (both at run boundaries)
  if (start.runIndex === end.runIndex && start.localOffset === 0 &&
      end.localOffset === block.children[end.runIndex].content.length) {
    return { startRunIndex: start.runIndex, endRunIndex: end.runIndex };
  }

  // Step 1: split the END run first (right side) — this does not
  // affect any indices to the left.
  // Only split in the MIDDLE of a run — splitting at the boundary
  // (localOffset=0 or localOffset=run.content.length) would create
  // empty runs that get rendered as \u200B, inflating DOM offsets.
  if (end.localOffset > 0 && end.localOffset < block.children[end.runIndex].content.length) {
    const run = block.children[end.runIndex];
    const before = createTextRun(
      run.content.slice(0, end.localOffset),
      [...run.marks]
    );
    before.attrs = run.attrs ? { ...run.attrs } : undefined;
    const after = createTextRun(
      run.content.slice(end.localOffset),
      [...run.marks]
    );
    after.attrs = run.attrs ? { ...run.attrs } : undefined;
    block.children.splice(end.runIndex, 1, before, after);
    // end.runIndex still points to the "before" part
  }

  // Step 2: split the START run — this shifts everything to the
  // right by 1, including end.runIndex.
  if (start.localOffset > 0 && start.localOffset < block.children[start.runIndex].content.length) {
    const run = block.children[start.runIndex];
    const before = createTextRun(
      run.content.slice(0, start.localOffset),
      [...run.marks]
    );
    before.attrs = run.attrs ? { ...run.attrs } : undefined;
    const contentAfter = createTextRun(
      run.content.slice(start.localOffset),
      [...run.marks]
    );
    contentAfter.attrs = run.attrs ? { ...run.attrs } : undefined;
    block.children.splice(start.runIndex, 1, before, contentAfter);

    // Start of selection is now at the "after" part
    start.runIndex++;
    // End shifted right by 1
    end.runIndex++;
  }

  // When end.localOffset is 0, findRunAtOffset returned the NEXT run
  // (the strict < ensures deletion works at boundaries). But that run
  // is NOT selected — the selection ends at its start. Exclude it.
  // This prevents formatting from leaking past the selection into
  // the following run (e.g. "this " → applying bold to "this" and
  // the rest of the line beyond the selection).
  if (end.localOffset === 0) {
    end.runIndex--;
  }

  return { startRunIndex: start.runIndex, endRunIndex: end.runIndex };
}

export function applyToggleMark(doc: DocumentRoot, op: ToggleMarkOp): void {
  const block = findNode(doc, op.blockId);
  if (!block || (block.type !== 'paragraph' && block.type !== 'heading')) {
    throw new Error(`Block ${op.blockId} not found or is not a text block`);
  }

  const textBlock = block as Paragraph | Heading;

  // No selection range — nothing to toggle
  if (op.startOffset === op.endOffset) return;

  // Split runs so the selection aligns with run boundaries
  const { startRunIndex, endRunIndex } = splitRunsAtRange(
    textBlock, op.startOffset, op.endOffset
  );
  if (startRunIndex < 0) return;

  // Determine if we're adding or removing the mark
  const firstRun = textBlock.children[startRunIndex];
  const hasMark = firstRun.marks.includes(op.mark);

  // Apply or remove mark from the exact runs covering the selection
  for (let i = startRunIndex; i <= endRunIndex; i++) {
    const run = textBlock.children[i];
    if (hasMark) {
      run.marks = run.marks.filter((m) => m !== op.mark);
    } else {
      if (!run.marks.includes(op.mark)) {
        run.marks.push(op.mark);
      }
    }
  }
}

export function invertToggleMark(op: ToggleMarkOp): ToggleMarkOp {
  // Toggle is its own inverse
  return { ...op };
}

// ============================================================
// ClearFormatting Operation
// ============================================================

/**
 * Remove all marks and style attributes from runs within the
 * selection range, leaving the text content intact.
 */
export function applyClearFormatting(
  doc: DocumentRoot,
  blockId: NodeId,
  startOffset: number,
  endOffset: number
): void {
  const block = findNode(doc, blockId);
  if (!block || (block.type !== 'paragraph' && block.type !== 'heading')) return;

  const textBlock = block as Paragraph | Heading;
  if (startOffset === endOffset) return;

  // Split runs so the range aligns with run boundaries
  const { startRunIndex, endRunIndex } = splitRunsAtRange(
    textBlock, startOffset, endOffset
  );
  if (startRunIndex < 0) return;

  // Clear marks and attrs from the exact runs covering the range
  for (let i = startRunIndex; i <= endRunIndex; i++) {
    const run = textBlock.children[i];
    run.marks = [];
    run.attrs = undefined;
  }
}

// ============================================================
// SetStyle Operation
// ============================================================

export function applySetStyle(doc: DocumentRoot, op: SetStyleOp): void {
  const block = findNode(doc, op.blockId);
  if (!block || (block.type !== 'paragraph' && block.type !== 'heading')) {
    throw new Error(`Block ${op.blockId} not found or is not a text block`);
  }

  const textBlock = block as Paragraph | Heading;

  // No selection range — nothing to style
  if (op.startOffset === op.endOffset) return;

  // Split runs so the selection aligns with run boundaries
  const { startRunIndex, endRunIndex } = splitRunsAtRange(
    textBlock, op.startOffset, op.endOffset
  );
  if (startRunIndex < 0) return;

  // Apply style to the exact runs covering the selection
  for (let i = startRunIndex; i <= endRunIndex; i++) {
    const run = textBlock.children[i];
    if (!run.attrs) {
      run.attrs = {};
    }
    if (op.value === undefined) {
      delete run.attrs[op.key];
    } else {
      (run.attrs as any)[op.key] = op.value;
    }
  }
}

export function invertSetStyle(op: SetStyleOp): SetStyleOp {
  // Invert: set the previous value (we don't track it, so this is a limitation)
  // For now, we'll set to undefined to remove the style
  return {
    ...op,
    value: undefined,
  };
}

// ============================================================
// SetBlockAttrs Operation (alignment, etc.)
// ============================================================

export function applySetBlockAttrs(doc: DocumentRoot, op: SetBlockAttrsOp): void {
  const block = findNode(doc, op.blockId);
  if (!block || (block.type !== 'paragraph' && block.type !== 'heading')) {
    throw new Error(`Block ${op.blockId} not found or is not a text block`);
  }

  const textBlock = block as Paragraph | Heading;
  textBlock.attrs = { ...(textBlock.attrs || {}), ...op.attrs };
}

export function invertSetBlockAttrs(op: SetBlockAttrsOp): SetBlockAttrsOp {
  return {
    type: 'setBlockAttrs',
    blockId: op.blockId,
    attrs: op.prevAttrs,
    prevAttrs: op.attrs,
  };
}

// ============================================================
// InsertBlock Operation
// ============================================================

export function applyInsertBlock(doc: DocumentRoot, op: InsertBlockOp): void {
  let newBlock: BlockNode;

  switch (op.blockType) {
    case 'paragraph':
      newBlock = createParagraph();
      break;
    case 'heading':
      newBlock = createHeading((op.attrs?.level as 1 | 2 | 3 | 4 | 5 | 6) ?? 1);
      break;
    case 'list':
      newBlock = createList(op.attrs?.ordered as boolean ?? false);
      break;
    case 'blockquote':
      newBlock = createBlockquote();
      break;
    case 'horizontalRule':
      newBlock = createHorizontalRule();
      break;
    default:
      newBlock = createParagraph();
  }

  // Find the block to insert after
  const blocks = getBlockNodes(doc);
  const afterIndex = blocks.findIndex((b) => b.id === op.afterBlockId);

  if (afterIndex >= 0) {
    // Find the position in doc.children
    const docChildIndex = doc.children.findIndex((c) => c.id === op.afterBlockId);
    if (docChildIndex >= 0) {
      doc.children.splice(docChildIndex + 1, 0, newBlock);
    } else {
      doc.children.push(newBlock);
    }
  } else {
    doc.children.push(newBlock);
  }
}

export function invertInsertBlock(op: InsertBlockOp): DeleteBlockOp {
  return {
    type: 'deleteBlock',
    blockId: op.blockId,
    block: createParagraph(), // Placeholder — actual block stored in history
    afterBlockId: op.afterBlockId,
  };
}

// ============================================================
// ConvertBlock Operation
// ============================================================

export function applyConvertBlock(doc: DocumentRoot, op: ConvertBlockOp): void {
  const block = findNode(doc, op.blockId);
  if (!block) return;

  // Convert block type
  if (op.toType === 'paragraph' && (block.type === 'heading' || block.type === 'blockquote')) {
    const source = block as Heading | Blockquote;
    const newBlock: Paragraph = {
      id: block.id,
      type: 'paragraph',
      children: 'children' in source && source.type !== 'blockquote'
        ? [...(source as Heading).children]
        : [createTextRun('')],
    };
    replaceBlockInDoc(doc, block.id, newBlock);
  } else if (op.toType === 'heading' && block.type === 'paragraph') {
    const source = block as Paragraph;
    const newBlock: Heading = {
      id: block.id,
      type: 'heading',
      level: (op.attrs?.level as 1 | 2 | 3 | 4 | 5 | 6) ?? 1,
      children: [...source.children],
    };
    replaceBlockInDoc(doc, block.id, newBlock);
  } else if (op.toType === 'heading' && block.type === 'heading') {
    // Change heading level directly (e.g. Heading 1 → Heading 2)
    const source = block as Heading;
    source.level = (op.attrs?.level as 1 | 2 | 3 | 4 | 5 | 6) ?? 1;
  } else if (op.toType === 'blockquote' && block.type === 'paragraph') {
    const source = block as Paragraph;
    const newBlock: Blockquote = {
      id: block.id,
      type: 'blockquote',
      children: [{ ...source, id: createId() }],
    };
    replaceBlockInDoc(doc, block.id, newBlock);
  } else if (op.toType === 'list' && block.type === 'paragraph') {
    const source = block as Paragraph;
    const listItem = createListItem([{ ...source, id: createId() }]);
    const newBlock: List = {
      id: block.id,
      type: 'list',
      ordered: (op.attrs?.ordered as boolean) ?? false,
      children: [listItem],
    };
    replaceBlockInDoc(doc, block.id, newBlock);
  } else if (op.toType === 'paragraph' && block.type === 'list') {
    // Extract first list item's content as paragraph
    const source = block as List;
    if (source.children.length > 0 && source.children[0].children.length > 0) {
      const firstItem = source.children[0];
      const firstContent = firstItem.children[0];
      if (firstContent && firstContent.type === 'paragraph') {
        replaceBlockInDoc(doc, block.id, { ...firstContent, id: block.id });
      }
    }
  }
}

function replaceBlockInDoc(doc: DocumentRoot, blockId: NodeId, newBlock: BlockNode): void {
  const index = doc.children.findIndex((c) => c.id === blockId);
  if (index >= 0) {
    doc.children[index] = newBlock;
  }
}

export function invertConvertBlock(op: ConvertBlockOp): ConvertBlockOp {
  return {
    ...op,
    fromType: op.toType,
    toType: op.fromType,
  };
}

// ============================================================
// DeleteBlock Operation
// ============================================================

export function applyDeleteBlock(doc: DocumentRoot, op: DeleteBlockOp): void {
  const index = doc.children.findIndex((c) => c.id === op.blockId);
  if (index >= 0) {
    doc.children.splice(index, 1);
  }
}

export function invertDeleteBlock(op: DeleteBlockOp): InsertBlockOp {
  return {
    type: 'insertBlock',
    blockId: op.blockId,
    blockType: op.block.type as 'paragraph',
    afterBlockId: op.afterBlockId ?? '',
  };
}

// ============================================================
// InsertImage Operation
// ============================================================

export function applyInsertImage(doc: DocumentRoot, op: InsertImageOp): void {
  const newImage = createImage(
    op.src,
    op.alt,
    op.width,
    op.height,
    op.inline
  );

  // Find the block to insert after
  const docChildIndex = doc.children.findIndex((c) => c.id === op.afterBlockId);
  if (docChildIndex >= 0) {
    doc.children.splice(docChildIndex + 1, 0, newImage);
  } else {
    doc.children.push(newImage);
  }
}

export function invertInsertImage(op: InsertImageOp): DeleteBlockOp {
  return {
    type: 'deleteBlock',
    blockId: op.blockId,
    block: createImage(op.src, op.alt, op.width, op.height, op.inline),
    afterBlockId: op.afterBlockId,
  };
}

// ============================================================
// ResizeImage Operation
// ============================================================

export function applyResizeImage(doc: DocumentRoot, op: ResizeImageOp): void {
  const block = findNode(doc, op.blockId);
  if (!block || block.type !== 'image') return;

  const image = block as import('./types').Image;
  image.width = op.width;
  image.height = op.height;
}

export function invertResizeImage(op: ResizeImageOp): ResizeImageOp {
  // We don't track previous size, so this is a limitation
  // For now, we'll just return the same op (no-op on undo)
  return { ...op };
}

// ============================================================
// InsertTable Operation
// ============================================================

export function applyInsertTable(doc: DocumentRoot, op: InsertTableOp): void {
  const newTable = createTable(op.rows, op.cols);

  // Find the block to insert after
  const docChildIndex = doc.children.findIndex((c) => c.id === op.afterBlockId);
  if (docChildIndex >= 0) {
    doc.children.splice(docChildIndex + 1, 0, newTable);
  } else {
    doc.children.push(newTable);
  }
}

export function invertInsertTable(op: InsertTableOp): DeleteBlockOp {
  return {
    type: 'deleteBlock',
    blockId: op.blockId,
    block: createTable(op.rows, op.cols),
    afterBlockId: op.afterBlockId,
  };
}

// ============================================================
// AddTableRow Operation
// ============================================================

export function applyAddTableRow(doc: DocumentRoot, op: AddTableRowOp): void {
  const block = findNode(doc, op.tableId);
  if (!block || block.type !== 'table') return;

  const table = block as Table;
  const cols = table.rows[0]?.cells.length ?? 3;
  const newRow = createTableRow(cols);

  if (op.afterRowIndex >= 0 && op.afterRowIndex < table.rows.length) {
    table.rows.splice(op.afterRowIndex + 1, 0, newRow);
  } else {
    table.rows.push(newRow);
  }
}

export function invertAddTableRow(op: AddTableRowOp): DeleteTableRowOp {
  return {
    type: 'deleteTableRow',
    blockId: op.blockId,
    tableId: op.tableId,
    rowIndex: op.afterRowIndex + 1,
    deletedRow: createTableRow(),
  };
}

// ============================================================
// AddTableColumn Operation
// ============================================================

export function applyAddTableColumn(doc: DocumentRoot, op: AddTableColumnOp): void {
  const block = findNode(doc, op.tableId);
  if (!block || block.type !== 'table') return;

  const table = block as Table;
  const insertIndex = op.afterColumnIndex + 1;

  // Add cell to each row
  for (const row of table.rows) {
    const newCell = createTableCell();
    if (insertIndex >= 0 && insertIndex <= row.cells.length) {
      row.cells.splice(insertIndex, 0, newCell);
    } else {
      row.cells.push(newCell);
    }
  }

  // Add column width
  const defaultWidth = Math.floor(624 / (table.columnWidths.length + 1));
  if (insertIndex >= 0 && insertIndex <= table.columnWidths.length) {
    table.columnWidths.splice(insertIndex, 0, defaultWidth);
  } else {
    table.columnWidths.push(defaultWidth);
  }
}

export function invertAddTableColumn(op: AddTableColumnOp): DeleteTableColumnOp {
  return {
    type: 'deleteTableColumn',
    blockId: op.blockId,
    tableId: op.tableId,
    columnIndex: op.afterColumnIndex + 1,
    deletedCells: [createTableCell()],
  };
}

// ============================================================
// DeleteTableRow Operation
// ============================================================

export function applyDeleteTableRow(doc: DocumentRoot, op: DeleteTableRowOp): void {
  const block = findNode(doc, op.tableId);
  if (!block || block.type !== 'table') return;

  const table = block as Table;
  if (op.rowIndex >= 0 && op.rowIndex < table.rows.length) {
    table.rows.splice(op.rowIndex, 1);
  }
}

export function invertDeleteTableRow(op: DeleteTableRowOp): AddTableRowOp {
  return {
    type: 'addTableRow',
    blockId: op.blockId,
    tableId: op.tableId,
    afterRowIndex: op.rowIndex - 1,
  };
}

// ============================================================
// DeleteTableColumn Operation
// ============================================================

export function applyDeleteTableColumn(doc: DocumentRoot, op: DeleteTableColumnOp): void {
  const block = findNode(doc, op.tableId);
  if (!block || block.type !== 'table') return;

  const table = block as Table;

  // Remove cell from each row
  for (const row of table.rows) {
    if (op.columnIndex >= 0 && op.columnIndex < row.cells.length) {
      row.cells.splice(op.columnIndex, 1);
    }
  }

  // Remove column width
  if (op.columnIndex >= 0 && op.columnIndex < table.columnWidths.length) {
    table.columnWidths.splice(op.columnIndex, 1);
  }
}

export function invertDeleteTableColumn(op: DeleteTableColumnOp): AddTableColumnOp {
  return {
    type: 'addTableColumn',
    blockId: op.blockId,
    tableId: op.tableId,
    afterColumnIndex: op.columnIndex - 1,
  };
}

// ============================================================
// MergeTableCells Operation
// ============================================================

export function applyMergeTableCells(doc: DocumentRoot, op: MergeTableCellsOp): void {
  const block = findNode(doc, op.tableId);
  if (!block || block.type !== 'table') return;

  const table = block as Table;
  const { startRow, startCol, endRow, endCol } = op;

  // Validate bounds
  if (startRow < 0 || startRow >= table.rows.length) return;
  if (endRow < 0 || endRow >= table.rows.length) return;

  // Get the start cell
  const startCell = table.rows[startRow].cells[startCol];
  if (!startCell) return;

  // Merge all text content from cells in range
  let mergedContent = '';
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = table.rows[r]?.cells[c];
      if (cell) {
        const cellText = cell.children.map((p) => p.children.map((t) => t.content).join('')).join(' ');
        if (cellText) {
          mergedContent += (mergedContent ? ' ' : '') + cellText;
        }
      }
    }
  }

  // Update the start cell
  startCell.colSpan = endCol - startCol + 1;
  startCell.rowSpan = endRow - startRow + 1;
  if (mergedContent) {
    startCell.children = [createParagraph(mergedContent)];
  }

  // Mark cells in range as merged (set colSpan/rowSpan to 0)
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      if (r === startRow && c === startCol) continue; // Skip start cell
      const cell = table.rows[r]?.cells[c];
      if (cell) {
        cell.colSpan = 0;
        cell.rowSpan = 0;
      }
    }
  }
}

export function invertMergeTableCells(op: MergeTableCellsOp): MergeTableCellsOp {
  // We don't track the original state, so this is a limitation
  // For now, we'll just return the same op (no-op on undo)
  return { ...op };
}

// ============================================================
// Helpers
// ============================================================

/** Find which run and local offset a global offset maps to */
function findRunAtOffset(
  block: Paragraph | Heading,
  offset: number
): { runIndex: number; localOffset: number } {
  let accumulated = 0;

  for (let i = 0; i < block.children.length; i++) {
    const run = block.children[i];
    // Strict less-than so offsets exactly at the boundary between two
    // runs fall through to the NEXT run. Required for correct deletion:
    // with <=, `findRunAtOffset(block, 6)` on ["Hello ", "World"] returns
    // run0 with localOffset=6 (past-the-end), and applyDeleteText silently
    // deletes nothing. With <, it returns run1 with localOffset=0, deleting
    // the first character of "World" as expected.
    if (offset < accumulated + run.content.length) {
      return {
        runIndex: i,
        localOffset: offset - accumulated,
      };
    }
    accumulated += run.content.length;
  }

  // If offset is beyond total length, point to end of last run
  const lastRun = block.children[block.children.length - 1];
  return {
    runIndex: block.children.length - 1,
    localOffset: lastRun.content.length,
  };
}
