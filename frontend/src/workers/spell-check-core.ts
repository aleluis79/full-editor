/** Pure spell-checking logic extracted for testability.

The test mocks nspell, so this function accepts an nspell-like instance
(calling .correct(word) and .suggest(word)).
*/

import type { SpellCheckOptions } from './spell-check.worker';

export interface Misspelling {
  word: string;
  start: number;
  end: number;
  suggestions: string[];
}

export interface BlockResult {
  blockId: string;
  misspellings: Misspelling[];
}

/** nspell-like interface for dependency injection in tests. */
export interface NspellLike {
  correct: (word: string) => boolean;
  suggest: (word: string) => string[];
}

// Regex patterns for tokens to skip
const URL_REGEX = /^https?:\/\/[^\s]+$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NUMERIC_REGEX = /^[\d.,]+$/;

function isSkippable(token: string): boolean {
  return URL_REGEX.test(token) || EMAIL_REGEX.test(token) || NUMERIC_REGEX.test(token);
}

export function tokenizeWords(text: string): Array<{ word: string; start: number; end: number }> {
  const tokens: Array<{ word: string; start: number; end: number }> = [];
  const re = /\S+/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    tokens.push({
      word: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return tokens;
}

/** Check a block's text for misspellings using the provided nspell instance. */
export function checkBlockTextWithNspell(
  blockId: string,
  text: string,
  nspell: NspellLike,
  customWords: string[],
): BlockResult {
  const customSet = new Set(customWords.map((w) => w.toLowerCase()));
  const tokens = tokenizeWords(text);
  const misspellings: Misspelling[] = [];

  for (const token of tokens) {
    const word = token.word;
    const lower = word.toLowerCase();

    // Skip URLs, emails, numbers, empty, and custom words
    if (word.length === 0 || isSkippable(word) || customSet.has(lower)) {
      continue;
    }

    // Check if the word is spelled correctly
    if (!nspell.correct(lower)) {
      const suggestions = nspell.suggest(lower);
      misspellings.push({
        word,
        start: token.start,
        end: token.end,
        suggestions,
      });
    }
  }

  return { blockId, misspellings };
}

/**
 * Stub for tests. The actual worker loads nspell dynamically.
 * This function exists so tests can import a consistent API.
 * The test mocks nspell and calls checkBlockTextWithNspell directly.
 */
export function checkBlockText(
  blockId: string,
  text: string,
  lang: string,
  customWords: string[],
): BlockResult {
  // Dynamic import — in tests the mock resolves it
  // In the real worker, nspellInstance is set up before calling
  throw new Error(
    'checkBlockText is a stub. Use checkBlockTextWithNspell with a real nspell instance. ' +
    'This function is only available inside the Web Worker context.',
  );
}
