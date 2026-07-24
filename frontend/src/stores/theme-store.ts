/**
 * Theme Store — Zustand store for theme preference management.
 *
 * Pure state + actions following project conventions (all 7 existing stores
 * are pure `create((set) => ({ ... }))`). DOM sync lives in `useThemeInit` hook.
 */
import { create } from 'zustand';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'full-editor-theme';

function isValidPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isValidPreference(stored)) return stored;
  } catch {
    // localStorage unavailable — default to system
  }
  return 'system';
}

function resolveMode(preference: ThemePreference): ThemeMode {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  // system: check OS preference
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export interface ThemeState {
  preference: ThemePreference;
  resolved: ThemeMode;
  setPreference: (pref: ThemePreference) => void;
  /** Internal — clean up matchMedia listener. Called by useThemeInit hook on unmount. */
  _cleanup: () => void;
}

// ── Module-level MQL reference for system listener ─────────────

type SetState = Parameters<Parameters<typeof create<ThemeState>>[0]>[0];

let _internalSet: SetState | null = null;
let _mql: MediaQueryList | null = null;

function onSystemChange(e: { matches: boolean }) {
  if (!_internalSet) return;
  _internalSet((state: ThemeState) => {
    if (state.preference !== 'system') return {};
    return { resolved: e.matches ? 'dark' : 'light' };
  });
}

function setupSystemListener(set: SetState) {
  _internalSet = set;
  try {
    _mql = window.matchMedia('(prefers-color-scheme: dark)');
    _mql.addEventListener('change', onSystemChange);
  } catch {
    // matchMedia not available — stay on light
  }
}

function teardownSystemListener() {
  if (_mql) {
    _mql.removeEventListener('change', onSystemChange);
    _mql = null;
  }
  _internalSet = null;
}

const initialPreference = readStoredPreference();
const initialResolved = resolveMode(initialPreference);

export const useThemeStore = create<ThemeState>((set) => {
  // Set up system listener during store creation
  setupSystemListener(set);

  return {
    preference: initialPreference,
    resolved: initialResolved,

    setPreference: (pref: ThemePreference) => {
      try {
        localStorage.setItem(STORAGE_KEY, pref);
      } catch {
        // localStorage unavailable — persist in-memory only
      }
      set({
        preference: pref,
        resolved: resolveMode(pref),
      });
    },

    _cleanup: () => {
      teardownSystemListener();
    },
  };
});
