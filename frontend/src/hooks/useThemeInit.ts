/**
 * useThemeInit — syncs the theme store's resolved mode to the DOM.
 *
 * Subscribes to `resolved` changes and sets `data-theme` on
 * `document.documentElement`. Manages a matchMedia listener for
 * system-mode OS changes. Follows the project's hook pattern
 * (useEffect + store.subscribe).
 */
import { useEffect } from 'react';
import { useThemeStore } from '../stores/theme-store';

export function useThemeInit() {
  useEffect(() => {
    // ── Initial sync ──────────────────────────────────────────
    const store = useThemeStore.getState();
    document.documentElement.dataset.theme = store.resolved;

    // ── Subscribe to store changes ────────────────────────────
    const unsub = useThemeStore.subscribe((state, prevState) => {
      if (state.resolved !== prevState.resolved) {
        document.documentElement.dataset.theme = state.resolved;
      }
    });

    // ── matchMedia listener for system mode OS changes ────────
    let mql: MediaQueryList | undefined;
    try {
      mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => {
        const current = useThemeStore.getState();
        if (current.preference === 'system') {
          document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
        }
      };
      mql.addEventListener('change', handler);

      return () => {
        mql?.removeEventListener('change', handler);
        unsub();
      };
    } catch {
      return () => {
        unsub();
      };
    }
  }, []);
}
