import { describe, it, expect } from 'vitest';
import {
  getOrientedSize,
  A4,
  LETTER,
  LEGAL,
} from '../paper';

describe('getOrientedSize', () => {
  it('returns portrait dimensions for A4 portrait', () => {
    const result = getOrientedSize(A4, 'portrait');
    expect(result).toEqual({ width: 794, height: 1123 });
  });

  it('returns landscape (swapped) dimensions for A4 landscape', () => {
    const result = getOrientedSize(A4, 'landscape');
    expect(result).toEqual({ width: 1123, height: 794 });
  });

  it('returns portrait dimensions for Letter portrait', () => {
    const result = getOrientedSize(LETTER, 'portrait');
    expect(result).toEqual({ width: 816, height: 1056 });
  });

  it('returns landscape (swapped) dimensions for Letter landscape', () => {
    const result = getOrientedSize(LETTER, 'landscape');
    expect(result).toEqual({ width: 1056, height: 816 });
  });

  it('returns landscape dimensions for Legal landscape (816 x 1344 → 1344 x 816)', () => {
    const result = getOrientedSize(LEGAL, 'landscape');
    expect(result).toEqual({ width: 1344, height: 816 });
  });
});
