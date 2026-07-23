import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSpellCheckStore } from '../stores/spell-check-store';
import { useDocumentStore } from '../stores/document-store';
import { getBlockNodes } from '../core/document';
import { fetchCustomWords, addCustomWord } from '../api/client';
import { isComposing } from '../core/composition';
import type { SpellCheckRequest, SpellCheckResult, SpellCheckInit } from '../workers/spell-check.worker';

// ── Dictionary data loaders ────────────────────────────────────
// The dictionary-en/dictionary-es npm packages use fs.readFile (Node.js API)
// which doesn't work in the browser. We serve the raw .aff/.dic files from
// the public/dict/ directory and fetch them as ArrayBuffer at runtime.

async function fetchDictionary(lang: string): Promise<{ aff: ArrayBuffer; dic: ArrayBuffer }> {
  const base = `/dict/${lang}`;
  const [affRes, dicRes] = await Promise.all([
    fetch(`${base}.aff`),
    fetch(`${base}.dic`),
  ]);
  if (!affRes.ok || !dicRes.ok) {
    throw new Error(`Failed to load ${lang} dictionary`);
  }
  const [aff, dic] = await Promise.all([affRes.arrayBuffer(), dicRes.arrayBuffer()]);
  return { aff, dic };
}

// Fetch both dictionaries — returns fresh ArrayBuffers each call.
// Browser caches the HTTP response so subsequent fetches are instant.
async function loadBothDicts() {
  const [enResult, esResult] = await Promise.all([
    fetchDictionary('en').then((d) => ({ lang: 'en' as const, ...d })),
    fetchDictionary('es').then((d) => ({ lang: 'es' as const, ...d })),
  ]);
  return {
    en: enResult,
    es: esResult,
  } as const;
}

/**
 * Hook that manages the spell-check Web Worker lifecycle,
 * handles debounced checking on document mutations,
 * and initializes the custom words dictionary.
 *
 * - 400ms debounce after the last document mutation
 * - Only checks the focused block (for performance)
 * - Initializes custom words from the API on mount
 * - Cleans up the worker on unmount
 */
export function useSpellCheck() {
  const { i18n } = useTranslation();
  const workerRef = useRef<Worker | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabled = useSpellCheckStore((s) => s.enabled);
  const customWords = useSpellCheckStore((s) => s.customWords);
  const setMisspellings = useSpellCheckStore((s) => s.setMisspellings);
  const clearBlock = useSpellCheckStore((s) => s.clearBlock);
  const clearAll = useSpellCheckStore((s) => s.clearAll);
  const setCustomWords = useSpellCheckStore((s) => s.setCustomWords);


  // ── Worker lifecycle ─────────────────────────────────────────

  useEffect(() => {
    if (!enabled) {
      // Clean up worker when disabled
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      return;
    }

    const worker = new Worker(
      new URL('../workers/spell-check.worker.ts', import.meta.url),
      { type: 'module' },
    );

    let readyCount = 0;

    worker.onmessage = (e: MessageEvent) => {
      const { type } = e.data;

      if (type === 'ready') {
        readyCount++;
        if (readyCount >= 2) {
          triggerCheck();
        }
        return;
      }

      if (type === 'error') {
        console.error('[SpellCheck] Worker init error:', e.data.payload.error);
        return;
      }

      if (type === 'result') {
        const payload = e.data.payload as SpellCheckResult['payload'];
        for (const block of payload) {
          if (block.misspellings.length > 0) {
            setMisspellings(block.blockId, block.misspellings);
          } else {
            clearBlock(block.blockId);
          }
        }
      }
    };

    worker.onerror = () => {
      // Worker error — clear all misspellings gracefully
      console.error('[SpellCheck] Worker runtime error');
      clearAll();
    };

    workerRef.current = worker;

    // ── Load dictionaries ─────────────────────────────────────
    loadBothDicts()
      .then((dicts) => {
        for (const lang of ['en', 'es'] as const) {
          const { aff, dic } = dicts[lang];
          const initMsg: SpellCheckInit = {
            type: 'init',
            payload: { lang, aff, dic },
          };
          worker.postMessage(initMsg, [aff, dic]);
        }
      })
      .catch((err) => {
        console.error('Failed to load spell check dictionaries:', err);
      });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [enabled, setMisspellings, clearBlock, clearAll]);

  // ── Custom words initialization ──────────────────────────────

  useEffect(() => {
    if (!enabled) return;

    Promise.resolve()
      .then(() => fetchCustomWords())
      .then((words) => {
        setCustomWords(words.map((w) => w.word));
      })
      .catch(() => {
        // Silently fail — custom words are optional
      });
  }, [enabled, setCustomWords]);

  // ── Debounced spell check ────────────────────────────────────

  const triggerCheck = useCallback(() => {
    if (!enabled || !workerRef.current) return;

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      // Skip check during IME composition
      if (isComposing()) return;

      const doc = useDocumentStore.getState().document;
      const blocks = getBlockNodes(doc);
      const lang = i18n.language?.startsWith('es') ? 'es' : 'en';

      // Check all paragraph/heading blocks
      const blocksToCheck = blocks
        .filter((b) => b.type === 'paragraph' || b.type === 'heading')
        .map((b) => ({
          id: b.id,
          text: b.children.map((c) => c.content).join(''),
        }));

      if (blocksToCheck.length === 0) return;

      const message: SpellCheckRequest = {
        type: 'check',
        payload: {
          blocks: blocksToCheck,
          lang: lang as 'en' | 'es',
          customWords,
        },
      };

      workerRef.current?.postMessage(message);
    }, 400);
  }, [enabled, customWords, i18n.language, setMisspellings, clearBlock]);

  // Subscribe to document mutations via document store version/changes
  useEffect(() => {
    if (!enabled) return;

    const unsub = useDocumentStore.subscribe((state) => {
      // Trigger check when the document changes
      triggerCheck();
    });

    // Trigger initial check for already-loaded documents
    triggerCheck();

    return () => {
      unsub();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [enabled, triggerCheck]);

  // ── Add custom word (via API + store) ────────────────────────

  const addToDictionary = useCallback(
    async (word: string) => {
      try {
        const lang = i18n.language?.startsWith('es') ? 'es' : 'en';
        await addCustomWord(word, lang);
        useSpellCheckStore.getState().addCustomWord(word);
      } catch {
        // Silently fail
      }
    },
    [i18n.language],
  );

  return { addToDictionary };
}
