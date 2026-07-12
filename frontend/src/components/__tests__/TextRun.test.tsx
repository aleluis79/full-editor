import { describe, it, expect } from 'vitest';
import { getSelectionRangeInBlock } from '../TextRun';
import type { Selection } from '../../core/types';

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
