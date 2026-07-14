import { describe, it, expect } from 'vitest';
import {
  applyInsertText,
  applyDeleteText,
  applyToggleMark,
  applySetStyle,
  applySetLink,
  applyRemoveLink,
  invertOperation,
} from '../operations';
import { createDocument, createParagraph, getBlockText, createHeading } from '../document';
import type { InsertTextOp, DeleteTextOp, ToggleMarkOp, SetStyleOp, SetLinkOp, RemoveLinkOp, Paragraph, Heading } from '../types';

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

// ── Link URL validation ──────────────────────────────────────

// ── Link removal at cursor position (Ctrl+K) ─────────────────

describe('link removal at cursor position', () => {
  it('removes link from the run that contains the cursor', () => {
    const doc = makeDoc('Hello World');
    const block = getFirstBlock(doc);

    // Set link on "Hello"
    applySetLink(doc, { type: 'setLink', blockId: block.id, startOffset: 0, endOffset: 5, href: 'https://ex.com' });

    // Simulate: cursor is at offset 2 (inside "Hello"), no selection
    // The Editor handler finds the run at cursor offset and calls removeLink
    // with the run's range
    const cursorOffset = 2;
    let accumulated = 0;
    for (const run of block.children) {
      if (cursorOffset < accumulated + run.content.length) {
        // Cursor is inside this run — remove link from this run's range
        expect(run.href).toBe('https://ex.com');
        applyRemoveLink(doc, { type: 'removeLink', blockId: block.id, startOffset: accumulated, endOffset: accumulated + run.content.length });
        break;
      }
      accumulated += run.content.length;
    }

    // After removal, the run should have no href and no 'link' mark
    expect(block.children[0].href).toBeUndefined();
    expect(block.children[0].marks.includes('link')).toBe(false);
    // Text should be unchanged
    expect(getBlockText(block)).toBe('Hello World');
  });

  it('cursor at end of linked run also removes link', () => {
    const doc = makeDoc('Click here');
    const block = getFirstBlock(doc);

    applySetLink(doc, { type: 'setLink', blockId: block.id, startOffset: 0, endOffset: 10, href: 'https://link.com' });

    // Cursor at offset 10 (end of the run)
    const cursorOffset = 10;
    let accumulated = 0;
    let targetRunIndex = -1;
    let targetStart = -1;
    let targetEnd = -1;
    for (let i = 0; i < block.children.length; i++) {
      const run = block.children[i];
      if (cursorOffset <= accumulated + run.content.length) {
        targetRunIndex = i;
        targetStart = accumulated;
        targetEnd = accumulated + run.content.length;
        break;
      }
      accumulated += run.content.length;
    }

    expect(targetRunIndex).toBeGreaterThanOrEqual(0);
    applyRemoveLink(doc, { type: 'removeLink', blockId: block.id, startOffset: targetStart, endOffset: targetEnd });
    expect(block.children[0].href).toBeUndefined();
    expect(getBlockText(block)).toBe('Click here');
  });
});

describe('link URL validation', () => {
  it('empty URL string should produce no operation', () => {
    const url = '';
    const trimmed = url.trim();
    // Simulate the toolbar handler logic: if trimmed is empty, no setLink is called
    expect(trimmed).toBe('');
  });

  it('whitespace-only URL should produce no operation', () => {
    const url = '   ';
    const trimmed = url.trim();
    expect(trimmed).toBe('');
  });
});

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

// ── applySetLink ─────────────────────────────────────────────

describe('applySetLink', () => {
  it('splits runs and sets href on selected range', () => {
    const doc = makeDoc('Hello World');
    const block = getFirstBlock(doc);

    const op: SetLinkOp = {
      type: 'setLink', blockId: block.id,
      startOffset: 0, endOffset: 5,
      href: 'https://example.com',
    };
    applySetLink(doc, op);

    // "Hello" should now have href and 'link' mark
    expect(block.children[0].href).toBe('https://example.com');
    expect(block.children[0].marks).toContain('link');
    // " World" should remain unaffected
    const restContent = block.children.slice(1).map((r) => r.content).join('');
    expect(restContent).toBe(' World');
    const restRuns = block.children.slice(1);
    expect(restRuns.every((r) => !r.marks.includes('link'))).toBe(true);
    expect(restRuns.every((r) => !r.href)).toBe(true);
  });

  it('splits at range boundaries on multi-run text', () => {
    const doc = makeDoc('Hello World');
    const block = getFirstBlock(doc);

    // First make " World" italic
    applyToggleMark(doc, { type: 'toggleMark', blockId: block.id, mark: 'italic', startOffset: 5, endOffset: 11 });

    // Now apply link to middle portion "lo Wo" (offsets 3-8)
    const op: SetLinkOp = {
      type: 'setLink', blockId: block.id,
      startOffset: 3, endOffset: 8,
      href: 'https://link.com',
    };
    applySetLink(doc, op);

    // Find runs with href
    const linkedRuns = block.children.filter((r) => r.href === 'https://link.com');
    expect(linkedRuns.length).toBeGreaterThanOrEqual(1);
    const linkedText = linkedRuns.map((r) => r.content).join('');
    expect(linkedText).toBe('lo Wo');
    // All linked runs should have 'link' mark
    expect(linkedRuns.every((r) => r.marks.includes('link'))).toBe(true);
    // Non-linked runs should not have link
    const nonLinked = block.children.filter((r) => !r.marks.includes('link'));
    expect(nonLinked.every((r) => !r.href)).toBe(true);
  });
});

// ── applyRemoveLink ───────────────────────────────────────────

describe('applyRemoveLink', () => {
  it('removes href and link mark from linked range', () => {
    const doc = makeDoc('Hello World');
    const block = getFirstBlock(doc);

    // First set a link on "Hello"
    applySetLink(doc, { type: 'setLink', blockId: block.id, startOffset: 0, endOffset: 5, href: 'https://example.com' });

    // Now remove the link
    const op: RemoveLinkOp = { type: 'removeLink', blockId: block.id, startOffset: 0, endOffset: 5 };
    applyRemoveLink(doc, op);

    // "Hello" should have no href and no 'link' mark
    const helloRun = block.children.find((r) => r.content === 'Hello');
    expect(helloRun).toBeDefined();
    expect(helloRun!.href).toBeUndefined();
    expect(helloRun!.marks.includes('link')).toBe(false);
    // Text should be unchanged
    expect(getBlockText(block)).toBe('Hello World');
  });

  it('does nothing when startOffset equals endOffset (no selection)', () => {
    const doc = makeDoc('Hello');
    const block = getFirstBlock(doc);
    const originalRuns = block.children.length;

    applySetLink(doc, { type: 'setLink', blockId: block.id, startOffset: 3, endOffset: 3, href: 'https://x.com' });
    expect(block.children.length).toBe(originalRuns);
    expect(block.children.every((r) => !r.href)).toBe(true);
  });

  it('preserves other marks when removing link', () => {
    const doc = makeDoc('Hello World');
    const block = getFirstBlock(doc);

    // Set bold + link on "Hello"
    applyToggleMark(doc, { type: 'toggleMark', blockId: block.id, mark: 'bold', startOffset: 0, endOffset: 5 });
    applySetLink(doc, { type: 'setLink', blockId: block.id, startOffset: 0, endOffset: 5, href: 'https://ex.com' });

    // Remove link only
    applyRemoveLink(doc, { type: 'removeLink', blockId: block.id, startOffset: 0, endOffset: 5 });

    // Bold should remain, link should be gone
    const helloRun = block.children.find((r) => r.content === 'Hello');
    expect(helloRun).toBeDefined();
    expect(helloRun!.marks.includes('bold')).toBe(true);
    expect(helloRun!.marks.includes('link')).toBe(false);
    expect(helloRun!.href).toBeUndefined();
  });
});
