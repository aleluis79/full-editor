import { describe, it, expect, vi } from 'vitest';
import { LayoutEngine, DEFAULT_CONSTRAINTS } from '../engine';
import { createDocument, createParagraph } from '../../document';
import type { TextRun } from '../../types';

// Mock measureText so we don't need a real canvas
vi.mock('../measure', () => ({
  measureText: vi.fn(() => ({ width: 50, height: 16 })),
  splitIntoWords: (text: string) => text.split(/(\s+|\n)/).filter(Boolean),
}));

describe('LayoutEngine href propagation', () => {
  it('propagates run.href into PositionedRun.href', () => {
    const runWithHref: TextRun = {
      id: 'run-1',
      type: 'text',
      content: 'Click here',
      marks: ['link'],
      href: 'https://example.com',
    };
    const para = createParagraph('');
    para.children = [runWithHref];

    const doc = createDocument([para]);
    const engine = new LayoutEngine();
    const layout = engine.layoutDocument(doc);

    expect(layout.blocks.length).toBeGreaterThanOrEqual(1);
    const blockLayout = layout.blocks[0];
    expect(blockLayout.lines.length).toBeGreaterThanOrEqual(1);

    // Find positioned runs with href
    const positionedRuns = blockLayout.lines[0].runs.filter((r) => r.href);
    expect(positionedRuns.length).toBeGreaterThanOrEqual(1);
    // All linked runs should carry the href
    for (const pr of positionedRuns) {
      expect(pr.href).toBe('https://example.com');
      expect(pr.marks).toContain('link');
    }
    // The linked content should include both words
    const linkedText = positionedRuns.map((r) => r.text).join('');
    expect(linkedText).toBe('Click here');
  });

  it('creates PositionedRun without href when run has no href', () => {
    const plainRun: TextRun = {
      id: 'run-2',
      type: 'text',
      content: 'Plain text',
      marks: [],
    };
    const para = createParagraph('');
    para.children = [plainRun];

    const doc = createDocument([para]);
    const engine = new LayoutEngine();
    const layout = engine.layoutDocument(doc);

    const blockLayout = layout.blocks[0];
    const positionedRuns = blockLayout.lines[0].runs;
    expect(positionedRuns.every((r) => r.href === undefined)).toBe(true);
  });

  it('propagates href through split words', () => {
    const linkRun: TextRun = {
      id: 'run-3',
      type: 'text',
      content: 'hello world',
      marks: ['link'],
      href: 'https://link.com',
    };
    const para = createParagraph('');
    para.children = [linkRun];

    const doc = createDocument([para]);
    const engine = new LayoutEngine();
    const layout = engine.layoutDocument(doc);

    // Since measureText always returns 50 width, both words should
    // fit on one line (fake mock). But they should both carry href.
    const blockLayout = layout.blocks[0];
    const runs = blockLayout.lines[0].runs;
    expect(runs.length).toBeGreaterThanOrEqual(1);
    for (const run of runs) {
      expect(run.href).toBe('https://link.com');
    }
  });
});

describe('LayoutEngine basic', () => {
  it('produces a layout with block and lines', () => {
    const doc = createDocument([createParagraph('Hello')]);
    const engine = new LayoutEngine();
    const layout = engine.layoutDocument(doc);

    expect(layout.blocks.length).toBe(1);
    expect(layout.blocks[0].lines.length).toBeGreaterThanOrEqual(1);
  });
});
