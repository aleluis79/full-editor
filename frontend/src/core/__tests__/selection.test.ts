import { describe, it, expect } from 'vitest';
import {
  deleteSelection,
  getSelectionRange,
  createSelection,
} from '../selection';
import {
  createDocument,
  createParagraph,
  createList,
  createListItem,
  createHeading,
  getBlockNodes,
  getBlockText,
} from '../document';
import type {
  DocumentRoot,
  Paragraph,
  Heading,
  List,
  Selection,
} from '../types';

// ── Helpers ──────────────────────────────────────────────────

function makeDoc(children: (Paragraph | Heading | List)[]) {
  return createDocument(children);
}

function makeSimpleDoc(texts: string[]): DocumentRoot {
  return makeDoc(texts.map((t) => createParagraph(t)));
}

// ── getSelectionRange ────────────────────────────────────────

describe('getSelectionRange', () => {
  it('orders positions when anchor is before focus (forward selection)', () => {
    const doc = makeSimpleDoc(['Line A', 'Line B', 'Line C']);
    const blocks = getBlockNodes(doc);

    // anchor = first block, focus = last block
    const sel: Selection = createSelection(
      { nodeId: blocks[0].id, offset: 2 },
      { nodeId: blocks[2].id, offset: 3 }
    );
    const { start, end } = getSelectionRange(sel, doc);
    expect(start.nodeId).toBe(blocks[0].id);
    expect(start.offset).toBe(2);
    expect(end.nodeId).toBe(blocks[2].id);
    expect(end.offset).toBe(3);
  });

  it('orders positions when anchor is after focus (backward selection)', () => {
    const doc = makeSimpleDoc(['Line A', 'Line B', 'Line C']);
    const blocks = getBlockNodes(doc);

    // anchor = last block (user clicked last, dragged up)
    const sel: Selection = createSelection(
      { nodeId: blocks[2].id, offset: 3 },
      { nodeId: blocks[0].id, offset: 2 }
    );
    const { start, end } = getSelectionRange(sel, doc);
    // start should be the earlier position (block 0)
    expect(start.nodeId).toBe(blocks[0].id);
    expect(start.offset).toBe(2);
    // end should be the later position (block 2)
    expect(end.nodeId).toBe(blocks[2].id);
    expect(end.offset).toBe(3);
  });

  it('orders within the same block by offset', () => {
    const doc = makeSimpleDoc(['Hello World']);
    const block = getBlockNodes(doc)[0];

    const sel: Selection = createSelection(
      { nodeId: block.id, offset: 6 },
      { nodeId: block.id, offset: 0 }
    );
    const { start, end } = getSelectionRange(sel, doc);
    expect(start.offset).toBe(0);
    expect(end.offset).toBe(6);
  });
});

// ── deleteSelection — multi-block ────────────────────────────

describe('deleteSelection — multi-block', () => {
  it('deletes across multiple blocks preserving trailing text of the last block', () => {
    const doc = makeSimpleDoc(['AAA', 'BBB', 'CCC']);
    const blocks = getBlockNodes(doc);

    // Select from middle of block 0 to middle of block 2
    // Block 0 'AAA': keep 'A' (offset 0-1), lose 'AA' (offset 1-3)
    // Block 2 'CCC': keep 'C' (offset 2-3), lose 'CC' (offset 0-2)
    // Merged: 'A' + 'C' = 'AC'
    const sel: Selection = createSelection(
      { nodeId: blocks[0].id, offset: 1 },
      { nodeId: blocks[2].id, offset: 2 }
    );
    const result = deleteSelection(doc, sel);

    expect(doc.children.length).toBe(1);
    expect(getBlockText(doc.children[0] as Paragraph)).toBe('AC');
    // Cursor after the first part (offset 1 in original = 1 char kept)
    expect(result.newCursorPosition.nodeId).toBe(blocks[0].id);
    expect(result.newCursorPosition.offset).toBe(1);
  });

  it('deletes backward selection (anchor after focus)', () => {
    const doc = makeSimpleDoc(['AAA', 'BBB', 'CCC']);
    const blocks = getBlockNodes(doc);

    // anchor = block 2 (last), focus = block 0 (first) — backward selection
    // getSelectionRange normalizes: start=block0:1, end=block2:2
    const sel: Selection = createSelection(
      { nodeId: blocks[2].id, offset: 2 },
      { nodeId: blocks[0].id, offset: 1 }
    );
    const result = deleteSelection(doc, sel);

    expect(doc.children.length).toBe(1);
    expect(getBlockText(doc.children[0] as Paragraph)).toBe('AC');
    expect(result.newCursorPosition.nodeId).toBe(blocks[0].id);
    expect(result.newCursorPosition.offset).toBe(1);
  });

  it('deletes across 2 blocks with partial selection on both', () => {
    const doc = makeSimpleDoc(['Hello', 'World']);
    const blocks = getBlockNodes(doc);

    // Select from "ell" (offset 1-4) in block 0 to "or" (offset 1-3) in block 1
    const sel: Selection = createSelection(
      { nodeId: blocks[0].id, offset: 1 },
      { nodeId: blocks[1].id, offset: 3 }
    );
    deleteSelection(doc, sel);

    // "H" + "ld" = "Hld"
    expect(doc.children.length).toBe(1);
    expect(getBlockText(doc.children[0] as Paragraph)).toBe('Hld');
  });

  it('removes middle blocks entirely', () => {
    const doc = makeSimpleDoc(['First', 'Second', 'Third', 'Fourth']);
    const blocks = getBlockNodes(doc);

    // Select from end of block 0 to start of block 3
    const sel: Selection = createSelection(
      { nodeId: blocks[0].id, offset: 5 },
      { nodeId: blocks[3].id, offset: 0 }
    );
    deleteSelection(doc, sel);

    // Block 0 should remain with its text, blocks 1-3 should be removed
    expect(doc.children.length).toBe(1);
    expect(getBlockText(doc.children[0] as Paragraph)).toBe('FirstFourth');
  });

  it('deletes entire range when selection covers full blocks', () => {
    const doc = makeSimpleDoc(['A', 'B', 'C']);
    const blocks = getBlockNodes(doc);

    // Full selection from start of block 0 to end of block 2
    const sel: Selection = createSelection(
      { nodeId: blocks[0].id, offset: 0 },
      { nodeId: blocks[2].id, offset: 1 }
    );
    deleteSelection(doc, sel);

    // All blocks removed, document has one empty paragraph? No, the doc
    // deletes everything and there's nothing left.
    expect(doc.children.length).toBe(0);
  });
});
