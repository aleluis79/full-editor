import { describe, it, expect } from 'vitest';
import {
  applyInsertText,
  applyDeleteText,
  applyToggleMark,
  applySetStyle,
  invertOperation,
} from '../operations';
import { createDocument, createParagraph, getBlockText, createHeading } from '../document';
import type { InsertTextOp, DeleteTextOp, ToggleMarkOp, SetStyleOp, Paragraph, Heading } from '../types';

// ── Helpers ──────────────────────────────────────────────────

function makeDoc(text = '') {
  return createDocument([createParagraph(text)]);
}

function getFirstBlock(doc: ReturnType<typeof createDocument>) {
  return doc.children[0] as Paragraph | Heading;
}

// ── applyInsertText ──────────────────────────────────────────

describe('applyInsertText', () => {
  it('inserts text at the given offset', () => {
    const doc = makeDoc('Hello');
    const op: InsertTextOp = { type: 'insertText', blockId: doc.children[0].id, offset: 5, text: ' World' };
    applyInsertText(doc, op);
    expect(getBlockText(getFirstBlock(doc))).toBe('Hello World');
  });

  it('inserts text at the beginning', () => {
    const doc = makeDoc('World');
    const op: InsertTextOp = { type: 'insertText', blockId: doc.children[0].id, offset: 0, text: 'Hello ' };
    applyInsertText(doc, op);
    expect(getBlockText(getFirstBlock(doc))).toBe('Hello World');
  });

  it('inserts text in the middle', () => {
    const doc = makeDoc('Heo');
    const op: InsertTextOp = { type: 'insertText', blockId: doc.children[0].id, offset: 2, text: 'll' };
    applyInsertText(doc, op);
    expect(getBlockText(getFirstBlock(doc))).toBe('Hello');
  });

  it('inserts into an empty paragraph', () => {
    const doc = makeDoc('');
    const op: InsertTextOp = { type: 'insertText', blockId: doc.children[0].id, offset: 0, text: 'Hello' };
    applyInsertText(doc, op);
    expect(getBlockText(getFirstBlock(doc))).toBe('Hello');
  });

  it('inserts with marks — creates a new styled run when marks differ', () => {
    const doc = makeDoc('Hello');
    const block = getFirstBlock(doc);

    // Insert at end with bold mark
    const op: InsertTextOp = { type: 'insertText', blockId: block.id, offset: 5, text: ' Bold' };
    applyInsertText(doc, op, ['bold']);

    expect(getBlockText(block)).toBe('Hello Bold');

    // Should have created a new run with bold mark
    expect(block.children.length).toBe(2);
    expect(block.children[0].marks).toEqual([]);
    expect(block.children[0].content).toBe('Hello');
    expect(block.children[1].marks).toEqual(['bold']);
    expect(block.children[1].content).toBe(' Bold');
  });

  it('inserts with marks — same marks should not split run', () => {
    const doc = makeDoc('Hel');
    const block = getFirstBlock(doc);

    // Insert with bold mark — creates new run
    const op1: InsertTextOp = { type: 'insertText', blockId: block.id, offset: 3, text: 'l' };
    applyInsertText(doc, op1, ['bold']);

    // Insert more text with same bold mark — should merge into existing run
    const op2: InsertTextOp = { type: 'insertText', blockId: block.id, offset: 4, text: 'o' };
    applyInsertText(doc, op2, ['bold']);

    expect(getBlockText(block)).toBe('Hello');

    // Both bold characters should be in the same run
    const boldRuns = block.children.filter((r) => r.marks.includes('bold'));
    expect(boldRuns.length).toBe(1);
    expect(boldRuns[0].content).toBe('lo');
  });

  it('inserts with attrs — creates new run with style', () => {
    const doc = makeDoc('Hello');
    const block = getFirstBlock(doc);

    const op: InsertTextOp = { type: 'insertText', blockId: block.id, offset: 5, text: ' Red' };
    applyInsertText(doc, op, [], { color: '#ff0000' });

    expect(getBlockText(block)).toBe('Hello Red');

    const styledRuns = block.children.filter((r) => r.attrs?.color === '#ff0000');
    expect(styledRuns.length).toBe(1);
    expect(styledRuns[0].content).toBe(' Red');
  });

  it('inserts with empty marks (break-out) — creates a plain run', () => {
    const doc = makeDoc('');
    const block = getFirstBlock(doc);

    // First insert with bold
    const op1: InsertTextOp = { type: 'insertText', blockId: block.id, offset: 0, text: 'Bold' };
    applyInsertText(doc, op1, ['bold']);

    // Then insert with empty marks (break out)
    const op2: InsertTextOp = { type: 'insertText', blockId: block.id, offset: 4, text: 'Plain' };
    applyInsertText(doc, op2, []);

    expect(getBlockText(block)).toBe('BoldPlain');
    expect(block.children.length).toBe(2);
    expect(block.children[0].marks).toEqual(['bold']);
    expect(block.children[1].marks).toEqual([]);
  });
});

// ── applyDeleteText ──────────────────────────────────────────

describe('applyDeleteText', () => {
  it('deletes a single character at offset', () => {
    const doc = makeDoc('Hello');
    const op: DeleteTextOp = { type: 'deleteText', blockId: doc.children[0].id, offset: 0, text: 'H' };
    applyDeleteText(doc, op);
    expect(getBlockText(getFirstBlock(doc))).toBe('ello');
  });

  it('deletes a character in the middle', () => {
    const doc = makeDoc('Hello');
    const op: DeleteTextOp = { type: 'deleteText', blockId: doc.children[0].id, offset: 2, text: 'l' };
    applyDeleteText(doc, op);
    expect(getBlockText(getFirstBlock(doc))).toBe('Helo');
  });

  it('deletes multiple characters (batched undo)', () => {
    const doc = makeDoc('Hello World');
    const op: DeleteTextOp = { type: 'deleteText', blockId: doc.children[0].id, offset: 0, text: 'Hello' };
    applyDeleteText(doc, op);
    expect(getBlockText(getFirstBlock(doc))).toBe(' World');
  });

  it('handles past-end offset gracefully', () => {
    const doc = makeDoc('Hi');
    const op: DeleteTextOp = { type: 'deleteText', blockId: doc.children[0].id, offset: 10, text: 'x' };
    // Should not throw, just return early
    applyDeleteText(doc, op);
    expect(getBlockText(getFirstBlock(doc))).toBe('Hi');
  });

  it('removes empty run when children.length > 1', () => {
    const doc = makeDoc('');
    const block = getFirstBlock(doc);

    // Insert to create runs
    const ins: InsertTextOp = { type: 'insertText', blockId: block.id, offset: 0, text: 'A' };
    applyInsertText(doc, ins, ['bold']);

    // Now delete the character
    const del: DeleteTextOp = { type: 'deleteText', blockId: block.id, offset: 0, text: 'A' };
    applyDeleteText(doc, del);

    // Should keep at least one run (empty)
    expect(block.children.length).toBe(1);
  });
});

// ── applyToggleMark ──────────────────────────────────────────

describe('applyToggleMark', () => {
  it('toggles bold on selected text (single run)', () => {
    const doc = makeDoc('Hello World');
    const block = getFirstBlock(doc);

    const op: ToggleMarkOp = { type: 'toggleMark', blockId: block.id, mark: 'bold', startOffset: 0, endOffset: 5 };
    applyToggleMark(doc, op);

    expect(block.children[0].marks).toEqual(['bold']);
    expect(block.children[0].content).toBe('Hello');
  });

  it('toggles bold off', () => {
    const doc = makeDoc('Hello World');
    const block = getFirstBlock(doc);

    // Toggle on
    applyToggleMark(doc, { type: 'toggleMark', blockId: block.id, mark: 'bold', startOffset: 0, endOffset: 5 });
    // Toggle off
    applyToggleMark(doc, { type: 'toggleMark', blockId: block.id, mark: 'bold', startOffset: 0, endOffset: 5 });

    const text = block.children.map((r) => r.content).join('');
    expect(text).toBe('Hello World');
    // The run may have been merged, but marks should be gone
    expect(block.children.every((r) => !r.marks.includes('bold'))).toBe(true);
  });

  it('toggles mark on partial text, splitting the run', () => {
    const doc = makeDoc('Hello');
    const block = getFirstBlock(doc);

    // Toggle bold on "ell" only
    applyToggleMark(doc, { type: 'toggleMark', blockId: block.id, mark: 'bold', startOffset: 1, endOffset: 4 });

    expect(block.children.length).toBeGreaterThanOrEqual(2);
    // "H" should not be bold
    expect(block.children[0].content).toBe('H');
    expect(block.children[0].marks).toEqual([]);
    // "ell" should be bold
    const boldRun = block.children.find((r) => r.marks.includes('bold'));
    expect(boldRun?.content).toBe('ell');
    // "o" should not be bold
    const lastRun = block.children[block.children.length - 1];
    expect(lastRun.content).toBe('o');
    expect(lastRun.marks).toEqual([]);
  });
});

// ── applySetStyle ────────────────────────────────────────────

describe('applySetStyle', () => {
  it('sets font size on text', () => {
    const doc = makeDoc('Hello');
    const block = getFirstBlock(doc);

    const op: SetStyleOp = {
      type: 'setStyle', blockId: block.id,
      key: 'fontSize', value: 18,
      startOffset: 0, endOffset: 5,
    };
    applySetStyle(doc, op);

    expect(block.children[0].attrs?.fontSize).toBe(18);
  });

  it('sets color on text', () => {
    const doc = makeDoc('Hello');
    const block = getFirstBlock(doc);

    const op: SetStyleOp = {
      type: 'setStyle', blockId: block.id,
      key: 'color', value: '#ff0000',
      startOffset: 0, endOffset: 5,
    };
    applySetStyle(doc, op);

    expect(block.children[0].attrs?.color).toBe('#ff0000');
  });
});

// ── invertOperation ──────────────────────────────────────────

describe('invertOperation', () => {
  it('insertText inverts to deleteText', () => {
    const op: InsertTextOp = { type: 'insertText', blockId: 'b1', offset: 0, text: 'Hi' };
    const inverted = invertOperation(op);
    expect(inverted.type).toBe('deleteText');
    if (inverted.type === 'deleteText') {
      expect(inverted.offset).toBe(0);
      expect(inverted.text).toBe('Hi');
    }
  });

  it('deleteText inverts to insertText', () => {
    const op: DeleteTextOp = { type: 'deleteText', blockId: 'b1', offset: 3, text: 'x' };
    const inverted = invertOperation(op);
    expect(inverted.type).toBe('insertText');
    if (inverted.type === 'insertText') {
      expect(inverted.offset).toBe(3);
      expect(inverted.text).toBe('x');
    }
  });

  it('toggleMark is self-inverting', () => {
    const op: ToggleMarkOp = { type: 'toggleMark', blockId: 'b1', mark: 'bold', startOffset: 0, endOffset: 3 };
    const inverted = invertOperation(op);
    expect(inverted).toEqual(op);
  });
});

// ── applyInsertText + applyDeleteText = no-op ───────────────

describe('insert + delete round-trip', () => {
  it('insert then delete restores original document', () => {
    const doc = makeDoc('Original');
    const block = getFirstBlock(doc);
    const originalText = 'Original';

    // Insert
    const ins: InsertTextOp = { type: 'insertText', blockId: block.id, offset: 8, text: ' Text' };
    applyInsertText(doc, ins);
    expect(getBlockText(block)).toBe('Original Text');

    // Delete back
    const del: DeleteTextOp = { type: 'deleteText', blockId: block.id, offset: 8, text: ' Text' };
    applyDeleteText(doc, del);
    expect(getBlockText(block)).toBe(originalText);
  });

  it('insert with marks then delete restores original (no leftover styles)', () => {
    const doc = makeDoc('Hello');
    const block = getFirstBlock(doc);

    // Insert with bold
    const ins: InsertTextOp = { type: 'insertText', blockId: block.id, offset: 5, text: '!' };
    applyInsertText(doc, ins, ['bold']);

    // Delete the inserted text
    const del: DeleteTextOp = { type: 'deleteText', blockId: block.id, offset: 5, text: '!' };
    applyDeleteText(doc, del);

    // The document should be back to "Hello" with no bold marks
    expect(getBlockText(block)).toBe('Hello');
    expect(block.children.every((r) => r.marks.length === 0)).toBe(true);
  });
});
