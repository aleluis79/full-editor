import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getSelectionRangeInBlock, TextRun } from '../TextRun';
import type { Selection, TextRun as TextRunType } from '../../core/types';

function sel(
  anchorNode: string,
  anchorOffset: number,
  focusNode: string,
  focusOffset: number
): Selection {
  return {
    anchor: { nodeId: anchorNode, offset: anchorOffset },
    focus: { nodeId: focusNode, offset: focusOffset },
  };
}

describe('getSelectionRangeInBlock', () => {
  it('returns null when selection does not touch the block', () => {
    const s = sel('block-a', 0, 'block-b', 5);
    expect(getSelectionRangeInBlock(s, 'block-c')).toBeNull();
  });

  it('returns range for single-block selection (forward)', () => {
    const s = sel('block-x', 2, 'block-x', 7);
    expect(getSelectionRangeInBlock(s, 'block-x')).toEqual({ start: 2, end: 7 });
  });

  it('returns range for single-block selection (backward)', () => {
    const s = sel('block-x', 7, 'block-x', 2);
    expect(getSelectionRangeInBlock(s, 'block-x')).toEqual({ start: 2, end: 7 });
  });

  it('anchor in block, focus elsewhere (forward — anchor first)', () => {
    const s = sel('block-a', 3, 'block-b', 5);
    expect(getSelectionRangeInBlock(s, 'block-a')).toEqual({ start: 3, end: Infinity });
    expect(getSelectionRangeInBlock(s, 'block-b')).toEqual({ start: 0, end: 5 });
  });

  it('anchor in block, focus elsewhere (backward — focus first)', () => {
    const s = sel('block-b', 5, 'block-a', 3);
    expect(getSelectionRangeInBlock(s, 'block-a')).toEqual({ start: 0, end: 3 });
    expect(getSelectionRangeInBlock(s, 'block-b')).toEqual({ start: 5, end: Infinity });
  });

  it('handles edge: anchor at start of block', () => {
    const s = sel('block-x', 0, 'block-y', 10);
    expect(getSelectionRangeInBlock(s, 'block-x')).toEqual({ start: 0, end: Infinity });
  });

  it('handles edge: focus at start of block (raw selection, no anchor here)', () => {
    // Raw selection: anchor in another block, focus at start of this block.
    // Without effectiveSelection normalization, the range is collapsed at 0.
    const s = sel('block-y', 10, 'block-x', 0);
    const result = getSelectionRangeInBlock(s, 'block-x');
    expect(result!.start).toBe(0);
    expect(result!.end).toBe(0); // collapsed at focus position
  });

  it('handles edge: anchor at end of block (infinity)', () => {
    const s = sel('block-a', Infinity, 'block-b', 0);
    expect(getSelectionRangeInBlock(s, 'block-a')).toEqual({ start: Infinity, end: Infinity });
    expect(getSelectionRangeInBlock(s, 'block-b')).toEqual({ start: 0, end: 0 });
  });

  it('both ends in same block with zero-length selection (collapsed)', () => {
    const s = sel('block-x', 5, 'block-x', 5);
    expect(getSelectionRangeInBlock(s, 'block-x')).toEqual({ start: 5, end: 5 });
  });
});

// ── TextRun <a> Rendering ──────────────────────────────────────

describe('TextRun <a> rendering', () => {
  const noSelection = null;

  function makeRun(overrides: Partial<TextRunType> = {}): TextRunType {
    return {
      id: 'run-1',
      type: 'text',
      content: 'Click here',
      marks: [],
      ...overrides,
    };
  }

  it('renders plain span when no href is set', () => {
    const run = makeRun({ content: 'Hello', marks: [] });
    const { container } = render(
      <TextRun run={run} selection={noSelection} blockId="b1" />
    );
    const span = container.querySelector('span');
    expect(span).toBeTruthy();
    expect(span!.textContent).toBe('Hello');
    expect(container.querySelector('a')).toBeNull();
  });

  it('renders <a> element when href is set', () => {
    const run = makeRun({
      content: 'Click here',
      marks: ['link'],
      href: 'https://example.com',
    });
    render(
      <TextRun run={run} selection={noSelection} blockId="b1" />
    );
    const link = screen.getByText('Click here').closest('a');
    expect(link).toBeTruthy();
    expect(link!.getAttribute('href')).toBe('https://example.com');
    expect(link!.getAttribute('target')).toBe('_blank');
    expect(link!.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders <a> with blue underline style', () => {
    const run = makeRun({
      content: 'Linked',
      marks: ['link'],
      href: 'https://x.com',
    });
    render(
      <TextRun run={run} selection={noSelection} blockId="b1" />
    );
    const textEl = screen.getByText('Linked');
    expect(textEl).toBeTruthy();
    const link = textEl.closest('a');
    expect(link).toBeTruthy();
    expect(link!.style.color).toBe('blue');
    expect(link!.style.textDecoration).toBe('underline');
  });

  it('renders <a> with combined marks (bold + link)', () => {
    const run = makeRun({
      content: 'Bold Link',
      marks: ['bold', 'link'],
      href: 'https://bold.example.com',
    });
    render(
      <TextRun run={run} selection={noSelection} blockId="b1" />
    );
    const textEl = screen.getByText('Bold Link');
    expect(textEl).toBeTruthy();
    const link = textEl.closest('a');
    expect(link).toBeTruthy();
    expect(link!.getAttribute('href')).toBe('https://bold.example.com');
    // Bold style is on the inner span, not the anchor element
    const innerSpan = link!.querySelector('span');
    expect(innerSpan).toBeTruthy();
    expect(innerSpan!.style.fontWeight).toBe('bold');
  });

  it('preserves text content inside <a>', () => {
    const run = makeRun({
      content: 'Visit our site',
      marks: ['link'],
      href: 'https://site.com',
    });
    render(
      <TextRun run={run} selection={noSelection} blockId="b1" />
    );
    const textEl = screen.getByText('Visit our site');
    expect(textEl).toBeTruthy();
    const link = textEl.closest('a');
    expect(link).toBeTruthy();
    expect(link!.textContent).toBe('Visit our site');
  });
});
