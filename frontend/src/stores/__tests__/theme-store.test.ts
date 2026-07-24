import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Theme Store tests — RED → GREEN → TRIANGULATE → REFACTOR
 *
 * Strict TDD: tests written BEFORE implementation. Import done dynamically
 * in beforeEach to ensure stubs (localStorage, matchMedia) are in place
 * before the Zustand store initializer runs.
 */

let useThemeStore: typeof import('../theme-store').useThemeStore;
let ThemePreferenceType: unknown;

// ── Stub factories ────────────────────────────────────────────

function createStorageStub() {
  const data: Record<string, string> = {};
  return {
    _data: data,
    getItem: vi.fn((key: string) => data[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete data[key];
    }),
  };
}

function createMqlStub(matches = false) {
  const listeners: Array<(e: { matches: boolean }) => void> = [];
  return {
    matches,
    addEventListener: vi.fn((_event: string, handler: (e: { matches: boolean }) => void) => {
      listeners.push(handler);
    }),
    removeEventListener: vi.fn(),
    // Expose for test-driven OS change simulation
    _listeners: listeners,
    _setMatches(val: boolean) {
      this.matches = val;
      listeners.forEach((fn) => fn({ matches: val }));
    },
  };
}

describe('theme-store', () => {
  let storageStub: ReturnType<typeof createStorageStub>;
  let mqlStub: ReturnType<typeof createMqlStub>;

  beforeEach(async () => {
    // Reset module cache so the store re-initializes with our stubs
    vi.resetModules();

    storageStub = createStorageStub();
    vi.stubGlobal('localStorage', storageStub);

    mqlStub = createMqlStub(false);
    vi.stubGlobal('matchMedia', vi.fn(() => mqlStub));

    // Now import — store initializer runs with stubs in place
    const mod = await import('../theme-store');
    useThemeStore = mod.useThemeStore;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ──────────────────────────────────────────────────────────────
  // Initialization
  // ──────────────────────────────────────────────────────────────

  describe('initialization', () => {
    it('defaults preference to "system" when localStorage has no key', () => {
      const state = useThemeStore.getState();
      expect(state.preference).toBe('system');
    });

    it('resolves to "light" when OS is light and preference is system', () => {
      const state = useThemeStore.getState();
      expect(state.preference).toBe('system');
      expect(state.resolved).toBe('light');
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Stored preference
  // ──────────────────────────────────────────────────────────────

  describe('stored preference overrides default', () => {
    it('resolves to "dark" when localStorage has "dark"', async () => {
      // Need to re-init with stored value in localStorage
      vi.resetModules();

      const storageWithDark = createStorageStub();
      storageWithDark._data['full-editor-theme'] = 'dark';
      storageWithDark.getItem.mockImplementation(
        (key: string) => storageWithDark._data[key] ?? null,
      );
      vi.stubGlobal('localStorage', storageWithDark);
      vi.stubGlobal('matchMedia', vi.fn(() => createMqlStub(false)));

      const mod = await import('../theme-store');
      expect(mod.useThemeStore.getState().preference).toBe('dark');
      expect(mod.useThemeStore.getState().resolved).toBe('dark');
    });

    it('resolves to "light" when localStorage has "light"', async () => {
      vi.resetModules();

      const storageWithLight = createStorageStub();
      storageWithLight._data['full-editor-theme'] = 'light';
      storageWithLight.getItem.mockImplementation(
        (key: string) => storageWithLight._data[key] ?? null,
      );
      vi.stubGlobal('localStorage', storageWithLight);
      vi.stubGlobal('matchMedia', vi.fn(() => createMqlStub(false)));

      const mod = await import('../theme-store');
      expect(mod.useThemeStore.getState().preference).toBe('light');
      expect(mod.useThemeStore.getState().resolved).toBe('light');
    });

    it('falls back to "system" for unknown localStorage values', async () => {
      vi.resetModules();

      const storageWithBad = createStorageStub();
      storageWithBad._data['full-editor-theme'] = 'invalid';
      storageWithBad.getItem.mockImplementation(
        (key: string) => storageWithBad._data[key] ?? null,
      );
      vi.stubGlobal('localStorage', storageWithBad);
      vi.stubGlobal('matchMedia', vi.fn(() => createMqlStub(false)));

      const mod = await import('../theme-store');
      expect(mod.useThemeStore.getState().preference).toBe('system');
    });
  });

  // ──────────────────────────────────────────────────────────────
  // setPreference
  // ──────────────────────────────────────────────────────────────

  describe('setPreference', () => {
    it('persists to localStorage with key "full-editor-theme"', () => {
      useThemeStore.getState().setPreference('light');
      expect(storageStub.setItem).toHaveBeenCalledWith('full-editor-theme', 'light');
    });

    it('updates preference and resolved when setting to "light"', () => {
      useThemeStore.getState().setPreference('light');
      const state = useThemeStore.getState();
      expect(state.preference).toBe('light');
      expect(state.resolved).toBe('light');
    });

    it('updates preference and resolved when setting to "dark"', () => {
      useThemeStore.getState().setPreference('dark');
      const state = useThemeStore.getState();
      expect(state.preference).toBe('dark');
      expect(state.resolved).toBe('dark');
    });

    it('resolves via OS when setting to "system" (OS=light)', () => {
      useThemeStore.getState().setPreference('system');
      const state = useThemeStore.getState();
      expect(state.preference).toBe('system');
      expect(state.resolved).toBe('light');
    });

    it('resolves via OS when setting to "system" (OS=dark)', async () => {
      // Re-init with dark OS
      vi.resetModules();
      vi.stubGlobal('localStorage', createStorageStub());
      const darkMql = createMqlStub(true);
      vi.stubGlobal('matchMedia', vi.fn(() => darkMql));

      const mod = await import('../theme-store');
      mod.useThemeStore.getState().setPreference('system');
      expect(mod.useThemeStore.getState().resolved).toBe('dark');
    });
  });

  // ──────────────────────────────────────────────────────────────
  // matchMedia listener — system mode reacts to OS changes
  // ──────────────────────────────────────────────────────────────

  describe('matchMedia listener', () => {
    it('registers a change listener on matchMedia', () => {
      expect(mqlStub.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('updates resolved when OS switches from light to dark in system mode', () => {
      // Start in system mode, light OS
      useThemeStore.getState().setPreference('system');
      expect(useThemeStore.getState().resolved).toBe('light');

      // Simulate OS switch to dark
      mqlStub._setMatches(true);
      expect(useThemeStore.getState().resolved).toBe('dark');
    });

    it('updates resolved when OS switches from dark to light in system mode', async () => {
      // Re-init with dark OS
      vi.resetModules();
      vi.stubGlobal('localStorage', createStorageStub());
      const darkMql = createMqlStub(true);
      vi.stubGlobal('matchMedia', vi.fn(() => darkMql));

      const mod = await import('../theme-store');
      mod.useThemeStore.getState().setPreference('system');
      expect(mod.useThemeStore.getState().resolved).toBe('dark');

      // Simulate OS switch to light
      darkMql._setMatches(false);
      expect(mod.useThemeStore.getState().resolved).toBe('light');
    });

    it('does NOT update resolved for OS changes when preference is explicit', () => {
      useThemeStore.getState().setPreference('light');
      expect(useThemeStore.getState().resolved).toBe('light');

      // OS change should not affect resolved when explicit
      mqlStub._setMatches(true);
      expect(useThemeStore.getState().resolved).toBe('light');
    });
  });

  // ──────────────────────────────────────────────────────────────
  // localStorage roundtrip
  // ──────────────────────────────────────────────────────────────

  describe('localStorage roundtrip', () => {
    it('writes every preference change to localStorage', () => {
      useThemeStore.getState().setPreference('dark');
      expect(storageStub.setItem).toHaveBeenCalledWith('full-editor-theme', 'dark');

      useThemeStore.getState().setPreference('system');
      expect(storageStub.setItem).toHaveBeenCalledWith('full-editor-theme', 'system');
    });
  });
});
