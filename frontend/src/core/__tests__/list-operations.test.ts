import { describe, it, expect } from 'vitest';
import {
  applyConvertBlock,
  applySplitBlock,
} from '../operations';
import {
  createDocument,
  createParagraph,
  createHeading,
  createList,
  createListItem,
  getBlockNodes,
  getBlockText,
  createId,
  findListContext,
} from '../document';
import { moveCursorRight, moveCursorLeft } from '../cursor';
import type {
  DocumentRoot,
  Paragraph,
  Heading,
  List,
  ListItem,
  ConvertBlockOp,
  SplitBlockOp,
} from '../types';

// ── Helpers ──────────────────────────────────────────────────

function makeDoc(children: (Paragraph | Heading | List)[]) {
  return createDocument(children);
}

function getText(block: Paragraph | Heading): string {
  return getBlockText(block);
}

// ── applyConvertBlock: list conversions ──────────────────────

describe('applyConvertBlock — list', () => {
  it('converts paragraph to unordered list', () => {
    const doc = makeDoc([createParagraph('Hello')]);
    const paraId = doc.children[0].id;

    const op: ConvertBlockOp = {
      type: 'convertBlock',
      blockId: paraId,
      fromType: 'paragraph',
      toType: 'list',
      attrs: { ordered: false },
    };
    applyConvertBlock(doc, op);

    // The paragraph should be replaced by a List
    const list = doc.children[0] as List;
    expect(list.type).toBe('list');
    expect(list.ordered).toBe(false);
    expect(list.children[0].type).toBe('listItem');
    // The list item should contain a paragraph with the original text
    const itemPara = list.children[0].children[0] as Paragraph;
    expect(itemPara.type).toBe('paragraph');
    expect(getText(itemPara)).toBe('Hello');
  });

  it('converts paragraph to ordered list', () => {
    const doc = makeDoc([createParagraph('Item')]);
    const paraId = doc.children[0].id;

    const op: ConvertBlockOp = {
      type: 'convertBlock',
      blockId: paraId,
      fromType: 'paragraph',
      toType: 'list',
      attrs: { ordered: true },
    };
    applyConvertBlock(doc, op);

    const list = doc.children[0] as List;
    expect(list.type).toBe('list');
    expect(list.ordered).toBe(true);
  });

  it('converts list to paragraph (extracts first item)', () => {
    const doc = makeDoc([
      createList(false, [
        createListItem([createParagraph('First')]),
        createListItem([createParagraph('Second')]),
      ]),
    ]);
    const listId = doc.children[0].id;

    const op: ConvertBlockOp = {
      type: 'convertBlock',
      blockId: listId,
      fromType: 'list',
      toType: 'paragraph',
    };
    applyConvertBlock(doc, op);

    // List replaced by first item's content
    const para = doc.children[0] as Paragraph;
    expect(para.type).toBe('paragraph');
    expect(getText(para)).toBe('First');
    // Second item is lost (expected behavior for basic conversion)
    expect(doc.children.length).toBe(1);
  });

  it('changes heading level (heading → heading)', () => {
    const doc = makeDoc([createHeading(1, 'Title')]);
    const headingId = doc.children[0].id;

    const op: ConvertBlockOp = {
      type: 'convertBlock',
      blockId: headingId,
      fromType: 'heading',
      toType: 'heading',
      attrs: { level: 3 },
    };
    applyConvertBlock(doc, op);

    const heading = doc.children[0] as Heading;
    expect(heading.type).toBe('heading');
    expect(heading.level).toBe(3);
    expect(getText(heading)).toBe('Title');
  });

  it('converts heading to paragraph', () => {
    const doc = makeDoc([createHeading(2, 'Subtitle')]);
    const headingId = doc.children[0].id;

    const op: ConvertBlockOp = {
      type: 'convertBlock',
      blockId: headingId,
      fromType: 'heading',
      toType: 'paragraph',
    };
    applyConvertBlock(doc, op);

    const para = doc.children[0] as Paragraph;
    expect(para.type).toBe('paragraph');
    expect(getText(para)).toBe('Subtitle');
  });
});

// ── applySplitBlock: split inside list items ─────────────────

describe('applySplitBlock — inside list', () => {
  it('creates a new list item when splitting inside a list item', () => {
    const doc = makeDoc([
      createList(false, [
        createListItem([createParagraph('HelloWorld')]),
      ]),
    ]);
    const list = doc.children[0] as List;
    const para = list.children[0].children[0] as Paragraph;
    const paraId = para.id;

    const op: SplitBlockOp = {
      type: 'splitBlock',
      blockId: paraId,
      offset: 5,
      newBlockId: '',
    };
    const newId = applySplitBlock(doc, op);

    // The list should now have 2 items
    expect(list.children.length).toBe(2);
    // First item has "Hello"
    expect(getText(list.children[0].children[0] as Paragraph)).toBe('Hello');
    // Second item has "World"
    expect(getText(list.children[1].children[0] as Paragraph)).toBe('World');
    // New ID should match the second item's paragraph ID
    expect(newId).toBe(list.children[1].children[0].id);
  });

  it('inserts at end of list item creates a new empty item', () => {
    const doc = makeDoc([
      createList(false, [
        createListItem([createParagraph('Hello')]),
      ]),
    ]);
    const list = doc.children[0] as List;
    const para = list.children[0].children[0] as Paragraph;

    const op: SplitBlockOp = {
      type: 'splitBlock',
      blockId: para.id,
      offset: 5,
      newBlockId: '',
    };
    applySplitBlock(doc, op);

    expect(list.children.length).toBe(2);
    expect(getText(list.children[0].children[0] as Paragraph)).toBe('Hello');
    expect(getText(list.children[1].children[0] as Paragraph)).toBe('');
  });

  it('splits non-list paragraph normally (top-level)', () => {
    const doc = makeDoc([createParagraph('HelloWorld')]);
    const paraId = doc.children[0].id;

    const op: SplitBlockOp = {
      type: 'splitBlock',
      blockId: paraId,
      offset: 5,
      newBlockId: '',
    };
    const newId = applySplitBlock(doc, op);

    // Should create a new top-level paragraph
    expect(doc.children.length).toBe(2);
    expect(getText(doc.children[0] as Paragraph)).toBe('Hello');
    expect(getText(doc.children[1] as Paragraph)).toBe('World');
    expect(newId).toBe(doc.children[1].id);
  });
});

// ── findListContext ──────────────────────────────────────────

describe('findListContext', () => {
  it('finds list context for a paragraph inside a list item', () => {
    const doc = makeDoc([
      createParagraph('Before'),
      createList(true, [
        createListItem([createParagraph('Item 1')]),
        createListItem([createParagraph('Item 2')]),
      ]),
      createParagraph('After'),
    ]);
    const list = doc.children[1] as List;
    const item2Para = (list.children[1].children[0] as Paragraph);

    const ctx = findListContext(doc, item2Para.id);
    expect(ctx).not.toBeNull();
    expect(ctx!.list.id).toBe(list.id);
    expect(ctx!.itemIndex).toBe(1);
    expect(ctx!.listItem.id).toBe(list.children[1].id);
  });

  it('returns null for a paragraph not inside a list', () => {
    const doc = makeDoc([createParagraph('Outside')]);
    const para = doc.children[0] as Paragraph;

    const ctx = findListContext(doc, para.id);
    expect(ctx).toBeNull();
  });

  it('finds the list by list item ID directly', () => {
    const doc = makeDoc([
      createList(false, [
        createListItem([createParagraph('Only')]),
      ]),
    ]);
    const list = doc.children[0] as List;
    const item = list.children[0];

    const ctx = findListContext(doc, item.id);
    expect(ctx).not.toBeNull();
    expect(ctx!.list.id).toBe(list.id);
    expect(ctx!.itemIndex).toBe(0);
  });
});

// ── moveCursorRight / moveCursorLeft in lists ────────────────

describe('moveCursorRight/Left — in list context', () => {
  it('moves right from end of list item to next paragraph', () => {
    const doc = makeDoc([
      createList(false, [
        createListItem([createParagraph('One')]),
        createListItem([createParagraph('Two')]),
      ]),
    ]);
    const list = doc.children[0] as List;
    const firstPara = list.children[0].children[0] as Paragraph;

    // Cursor at end of first item
    const result = moveCursorRight(doc, { position: { nodeId: firstPara.id, offset: 3 } });
    // Should move to second item's paragraph
    const secondPara = list.children[1].children[0] as Paragraph;
    expect(result.position.nodeId).toBe(secondPara.id);
    expect(result.position.offset).toBe(0);
  });

  it('moves left from start of list item to previous paragraph', () => {
    const doc = makeDoc([
      createList(false, [
        createListItem([createParagraph('One')]),
        createListItem([createParagraph('Two')]),
      ]),
    ]);
    const list = doc.children[0] as List;
    const secondPara = list.children[1].children[0] as Paragraph;

    // Cursor at start of second item
    const result = moveCursorLeft(doc, { position: { nodeId: secondPara.id, offset: 0 } });
    // Should move to end of first item's paragraph
    const firstPara = list.children[0].children[0] as Paragraph;
    expect(result.position.nodeId).toBe(firstPara.id);
    expect(result.position.offset).toBe(3);
  });

  it('moves right past the list to the next top-level paragraph', () => {
    const doc = makeDoc([
      createList(false, [
        createListItem([createParagraph('In list')]),
      ]),
      createParagraph('After list'),
    ]);
    const list = doc.children[0] as List;
    const para = list.children[0].children[0] as Paragraph;
    const afterPara = doc.children[1] as Paragraph;

    // Cursor at end of only list item
    const result = moveCursorRight(doc, { position: { nodeId: para.id, offset: 7 } });
    // Should skip List and ListItem blocks, land on the paragraph after
    expect(result.position.nodeId).toBe(afterPara.id);
    expect(result.position.offset).toBe(0);
  });

  it('stays at start of document when moving left from first block', () => {
    const doc = makeDoc([
      createList(false, [
        createListItem([createParagraph('First')]),
      ]),
    ]);
    const list = doc.children[0] as List;
    const firstPara = list.children[0].children[0] as Paragraph;

    const result = moveCursorLeft(doc, { position: { nodeId: firstPara.id, offset: 0 } });
    // No previous paragraph — should stay
    expect(result.position.nodeId).toBe(firstPara.id);
    expect(result.position.offset).toBe(0);
  });
});
