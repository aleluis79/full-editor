import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkBlockTextWithNspell, tokenizeWords } from '../spell-check-core';
import type { NspellLike } from '../spell-check-core';

// Mock nspell instance
function createMockNspell(): NspellLike {
  const dictionary = new Set([
    'this', 'is', 'a', 'test', 'correct', 'word',
    'hello', 'world', 'opencode', 'typescript', 'software',
    'fine', 'great', 'visit', 'page', 'buy', 'items',
    'email', 'now', 'the',
  ]);

  const suggestionsMap: Record<string, string[]> = {
    'ths': ['this', 'thus'],
    'tset': ['test', 'set'],
    'helo': ['hello', 'helot'],
  };

  return {
    correct: vi.fn((word: string) => dictionary.has(word.toLowerCase())),
    suggest: vi.fn((word: string) => suggestionsMap[word.toLowerCase()] || []),
  };
}

describe('checkBlockTextWithNspell', () => {
  let nspell: NspellLike;

  beforeEach(() => {
    nspell = createMockNspell();
  });

  it('returns empty array for correct text', () => {
    const result = checkBlockTextWithNspell('block-1', 'This is a test', nspell, []);
    expect(result).toEqual({
      blockId: 'block-1',
      misspellings: [],
    });
  });

  it('detects misspelled words', () => {
    const result = checkBlockTextWithNspell('block-1', 'Ths is a tset', nspell, []);
    expect(result.misspellings).toHaveLength(2);
    expect(result.misspellings[0].word).toBe('Ths');
    expect(result.misspellings[0].suggestions).toEqual(['this', 'thus']);
    expect(result.misspellings[1].word).toBe('tset');
    expect(result.misspellings[1].suggestions).toEqual(['test', 'set']);
  });

  it('skips URLs', () => {
    const result = checkBlockTextWithNspell('block-1', 'Visit https://example.com page', nspell, []);
    const misspelled = result.misspellings.filter(m => m.word === 'https://example.com');
    expect(misspelled).toHaveLength(0);
  });

  it('skips numeric tokens', () => {
    const result = checkBlockTextWithNspell('block-1', 'Buy 100 items', nspell, []);
    const misspelled = result.misspellings.filter(m => m.word === '100');
    expect(misspelled).toHaveLength(0);
  });

  it('skips email addresses', () => {
    const result = checkBlockTextWithNspell('block-1', 'Email test@example.com now', nspell, []);
    const misspelled = result.misspellings.filter(m => m.word === 'test@example.com');
    expect(misspelled).toHaveLength(0);
  });

  it('respects custom words — does not flag them', () => {
    const result = checkBlockTextWithNspell('block-1', 'opencode is great', nspell, ['opencode']);
    const misspelled = result.misspellings.filter(m => m.word === 'opencode');
    expect(misspelled).toHaveLength(0);
  });

  it('reports block-relative offsets', () => {
    const result = checkBlockTextWithNspell('block-1', 'Ths is fine', nspell, []);
    expect(result.misspellings).toHaveLength(1);
    expect(result.misspellings[0].start).toBe(0);
    expect(result.misspellings[0].end).toBe(3);
  });

  it('corrects offset when misspelling is not at position 0', () => {
    const result = checkBlockTextWithNspell('block-1', 'hello Ths world', nspell, []);
    expect(result.misspellings).toHaveLength(1);
    // "Ths" starts after "hello " = 6 chars offset
    expect(result.misspellings[0].start).toBe(6);
    expect(result.misspellings[0].end).toBe(9);
  });

  it('handles empty text', () => {
    const result = checkBlockTextWithNspell('block-1', '', nspell, []);
    expect(result.misspellings).toHaveLength(0);
  });
});

describe('tokenizeWords', () => {
  it('splits text into words with offsets', () => {
    const tokens = tokenizeWords('hello world');
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toEqual({ word: 'hello', start: 0, end: 5 });
    expect(tokens[1]).toEqual({ word: 'world', start: 6, end: 11 });
  });

  it('handles multiple spaces', () => {
    const tokens = tokenizeWords('a   b');
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toEqual({ word: 'a', start: 0, end: 1 });
    expect(tokens[1]).toEqual({ word: 'b', start: 4, end: 5 });
  });

  it('returns empty for empty string', () => {
    expect(tokenizeWords('')).toEqual([]);
  });
});
