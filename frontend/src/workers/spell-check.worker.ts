/**
 * Spell Check Web Worker
 *
 * Receives pre-loaded Hunspell dictionary data (aff + dic bytes) via an 'init'
 * message, then process 'check' messages using nspell.
 *
 * Messages received:
 *   Init:     { type: 'init', payload: { lang: 'en'|'es', aff: Uint8Array, dic: Uint8Array } }
 *   Check:    { type: 'check', payload: { blocks: { id, text }[], lang: 'en'|'es', customWords: string[] } }
 *
 * Messages sent:
 *   Result:   { type: 'result', payload: { blockId, misspellings: { word, start, end, suggestions }[] }[] }
 */

import nspell from 'nspell';
import { checkBlockTextWithNspell } from './spell-check-core';
import type { NspellLike } from './spell-check-core';

// ── Types ──────────────────────────────────────────────────────

export interface SpellCheckInit {
  type: 'init';
  payload: {
    lang: 'en' | 'es';
    aff: ArrayBuffer;
    dic: ArrayBuffer;
  };
}

export interface SpellCheckRequest {
  type: 'check';
  payload: {
    blocks: Array<{ id: string; text: string }>;
    lang: 'en' | 'es';
    customWords: string[];
  };
}

export interface SpellCheckResult {
  type: 'result';
  payload: Array<{
    blockId: string;
    misspellings: Array<{
      word: string;
      start: number;
      end: number;
      suggestions: string[];
    }>;
  }>;
}

// ── State ──────────────────────────────────────────────────────

const instances = new Map<string, NspellLike>();

// ── Message Handler ────────────────────────────────────────────

self.onmessage = (e: MessageEvent<SpellCheckInit | SpellCheckRequest>) => {
  const { type } = e.data;

  if (type === 'init') {
    // Receive pre-loaded dictionary data from the main thread
    const { lang, aff, dic } = e.data.payload;
    try {
      // nspell is statically imported at the top of the file.
      // It is NOT dynamically imported — Vite doesn't bundle dynamic
      // imports inside workers, so the worker would try to fetch
      // nspell from the network and fail.
      // Decode the raw bytes to strings. nspell's internal affix parser
      // expects string input, not Uint8Array.
      const decoder = new TextDecoder('utf-8');
      const affStr = decoder.decode(aff);
      const dicStr = decoder.decode(dic);
      // Pass as two separate strings — nspell detects string args and
      // uses the correct code path for parsing affix + dictionary data.
      instances.set(lang, nspell(affStr, dicStr));
      self.postMessage({ type: 'ready', payload: { lang } });
    } catch (err) {
      self.postMessage({ type: 'error', payload: { lang, error: String(err) } });
    }
    return;
  }

  if (type === 'check') {
    const { blocks, lang, customWords } = e.data.payload;
    const instance = instances.get(lang);

    if (!instance) {
      self.postMessage({
        type: 'result',
        payload: blocks.map((b) => ({ blockId: b.id, misspellings: [] })),
      });
      return;
    }

    try {
      const results = blocks.map((block) =>
        checkBlockTextWithNspell(block.id, block.text, instance, customWords),
      );

      self.postMessage({ type: 'result', payload: results });
    } catch (err) {
      self.postMessage({
        type: 'result',
        payload: blocks.map((block) => ({ blockId: block.id, misspellings: [] })),
      });
    }
  }
};
