import { describe, it, expect } from 'vitest';
import type { TextRun, MarkType } from '../../core/types';
import {
  insertTokenAtCursor,
  toggleMarkOnRuns,
  runsFromPlainText,
  resolveTokens,
} from '../header-footer-ops';

// ── Helpers ──────────────────────────────────────────────

function makeRun(content: string, marks: MarkType[] = []): TextRun {
  return {
    id: `run-${content}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'text',
    content,
    marks,
  };
}

// ============================================================
// Task 1.1: insertTokenAtCursor
// ============================================================

describe('insertTokenAtCursor', () => {
  it('inserts token at the start of an empty runs array', () => {
    const result = insertTokenAtCursor([], 0, '{pageNumber}');
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('{pageNumber}');
    expect(result[0].marks).toEqual([]);
  });

  it('inserts token at the start of a single run (offset 0)', () => {
    const runs = [makeRun('Hello')];
    const result = insertTokenAtCursor(runs, 0, '{date}');
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('{date}');
    expect(result[1].content).toBe('Hello');
  });

  it('inserts token in the middle of a single run', () => {
    const runs = [makeRun('Hello World')];
    const result = insertTokenAtCursor(runs, 5, '{pageNumber}');
    expect(result).toHaveLength(3);
    expect(result[0].content).toBe('Hello');
    expect(result[1].content).toBe('{pageNumber}');
    expect(result[2].content).toBe(' World');
  });

  it('inserts token at the end of a single run', () => {
    const runs = [makeRun('Hello')];
    const result = insertTokenAtCursor(runs, 5, '{totalPages}');
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('Hello');
    expect(result[1].content).toBe('{totalPages}');
  });

  it('inserts token at boundary between two runs', () => {
    const runs = [makeRun('Hello'), makeRun(' World')];
    // offset 5 = end of first run = start of second run
    const result = insertTokenAtCursor(runs, 5, '{date}');
    expect(result).toHaveLength(3);
    expect(result[0].content).toBe('Hello');
    expect(result[1].content).toBe('{date}');
    expect(result[2].content).toBe(' World');
  });

  it('inserts token in the middle of a multi-run sequence', () => {
    const runs = [makeRun('A'), makeRun('BC'), makeRun('D')];
    // offset 2 = middle of second run ('BC' at index 1, local offset 1)
    // 'BC' splits into 'B' + 'C', token inserted between them
    const result = insertTokenAtCursor(runs, 2, '{time}');
    expect(result).toHaveLength(5);
    expect(result.map((r) => r.content)).toEqual(['A', 'B', '{time}', 'C', 'D']);
  });

  it('preserves marks on surrounding split runs', () => {
    const runs = [makeRun('BoldText', ['bold'])];
    const result = insertTokenAtCursor(runs, 4, '{pageNumber}');
    expect(result[0].marks).toEqual(['bold']);
    expect(result[1].marks).toEqual([]);
    expect(result[2].marks).toEqual(['bold']);
  });

  it('does not mutate the original runs array', () => {
    const runs = [makeRun('Hello')];
    const original = [...runs];
    insertTokenAtCursor(runs, 3, '{date}');
    expect(runs).toEqual(original);
  });
});

// ============================================================
// Task 1.2: toggleMarkOnRuns
// ============================================================

describe('toggleMarkOnRuns', () => {
  it('applies bold to a full single run', () => {
    const runs = [makeRun('Hello')];
    const result = toggleMarkOnRuns(runs, 0, 5, 'bold');
    expect(result).toHaveLength(1);
    expect(result[0].marks).toContain('bold');
  });

  it('removes bold when already present (toggle off)', () => {
    const runs = [makeRun('Hello', ['bold'])];
    const result = toggleMarkOnRuns(runs, 0, 5, 'bold');
    expect(result).toHaveLength(1);
    expect(result[0].marks).not.toContain('bold');
  });

  it('applies mark to a partial range within a single run', () => {
    const runs = [makeRun('Hello World')];
    const result = toggleMarkOnRuns(runs, 0, 5, 'italic');
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('Hello');
    expect(result[0].marks).toContain('italic');
    expect(result[1].content).toBe(' World');
    expect(result[1].marks).not.toContain('italic');
  });

  it('applies mark to a range spanning multiple runs', () => {
    const runs = [makeRun('Hello'), makeRun(' World')];
    const result = toggleMarkOnRuns(runs, 0, 11, 'bold');
    expect(result).toHaveLength(2);
    expect(result[0].marks).toContain('bold');
    expect(result[1].marks).toContain('bold');
  });

  it('applies mark to a partial selection spanning multiple runs', () => {
    const runs = [makeRun('AAA'), makeRun('BBB'), makeRun('CCC')];
    // Select from offset 1 to offset 8 (middle of first to middle of last)
    const result = toggleMarkOnRuns(runs, 1, 8, 'underline');
    // AAA → 'A' (no mark) + 'AA' (underline)
    // BBB → 'BBB' (underline)
    // CCC → 'CC' (underline) + 'C' (no mark)
    expect(result.length).toBeGreaterThanOrEqual(3);
    const allText = result.map((r) => r.content).join('');
    expect(allText).toBe('AAABBBCCC');
    // Middle runs should have underline
    const underlinedRuns = result.filter((r) => r.marks.includes('underline'));
    const underlinedText = underlinedRuns.map((r) => r.content).join('');
    expect(underlinedText).toBe('AABBBCC');
  });

  it('preserves other marks when toggling', () => {
    const runs = [makeRun('Hello', ['italic'])];
    const result = toggleMarkOnRuns(runs, 0, 5, 'bold');
    expect(result[0].marks).toContain('bold');
    expect(result[0].marks).toContain('italic');
  });

  it('handles zero-length selection (no-op)', () => {
    const runs = [makeRun('Hello')];
    const result = toggleMarkOnRuns(runs, 3, 3, 'bold');
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Hello');
    expect(result[0].marks).toEqual([]);
  });

  it('does not mutate original runs', () => {
    const runs = [makeRun('Hello')];
    const original = JSON.parse(JSON.stringify(runs));
    toggleMarkOnRuns(runs, 0, 5, 'bold');
    expect(runs).toEqual(original);
  });
});

// ============================================================
// Task 1.2b: runsFromPlainText
// ============================================================

describe('runsFromPlainText', () => {
  it('converts empty string to empty array', () => {
    expect(runsFromPlainText('')).toEqual([]);
  });

  it('converts plain text to a single TextRun with no marks', () => {
    const result = runsFromPlainText('Hello World');
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Hello World');
    expect(result[0].marks).toEqual([]);
    expect(result[0].type).toBe('text');
  });
});

// ============================================================
// Task 1.3: resolveTokens
// ============================================================

describe('resolveTokens', () => {
  const ctx = { pageNumber: 3, totalPages: 10 };

  it('resolves {pageNumber} to the page number', () => {
    expect(resolveTokens('Page {pageNumber}', ctx)).toBe('Page 3');
  });

  it('resolves {totalPages} to the total pages', () => {
    expect(resolveTokens('of {totalPages}', ctx)).toBe('of 10');
  });

  it('resolves {date} to a non-empty string', () => {
    const result = resolveTokens('Today: {date}', ctx);
    expect(result).toMatch(/^Today: .+$/);
    expect(result).not.toContain('{date}');
  });

  it('resolves {time} to a non-empty string', () => {
    const result = resolveTokens('At {time}', ctx);
    expect(result).toMatch(/^At .+$/);
    expect(result).not.toContain('{time}');
  });

  it('resolves multiple tokens in the same string', () => {
    const result = resolveTokens('{pageNumber} / {totalPages}', ctx);
    expect(result).toBe('3 / 10');
  });

  it('leaves unknown tokens as literal text', () => {
    const result = resolveTokens('Hello {unknown}', ctx);
    expect(result).toBe('Hello {unknown}');
  });

  it('handles string with no tokens', () => {
    expect(resolveTokens('Just plain text', ctx)).toBe('Just plain text');
  });

  it('handles empty string', () => {
    expect(resolveTokens('', ctx)).toBe('');
  });
});
