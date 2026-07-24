import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

/**
 * useThemeInit hook tests — RED → GREEN → TRIANGULATE → REFACTOR
 *
 * Tests that the hook synchronizes the Zustand theme store's `resolved`
 * value to `document.documentElement.dataset.theme`, and manages
 * matchMedia listener lifecycle.
 *
 * Uses the REAL theme-store module with stubbed browser APIs
 * (localStorage + matchMedia) rather than mocking the store directly.
 */

let useThemeInit: () => void;
let useThemeStore: typeof import('../../stores/theme-store').useThemeStore;

describe('useThemeInit', () => {
  beforeEach(async () => {
    vi.resetModules();

    // Stub localStorage
    const storageData: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => storageData[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storageData[key] = value;
      }),
      removeItem: vi.fn(),
    });

    // Stub matchMedia
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));

    // Reset document state
    document.documentElement.removeAttribute('data-theme');

    // Dynamic imports after stubs are in place
    const storeMod = await import('../../stores/theme-store');
    useThemeStore = storeMod.useThemeStore;

    const hookMod = await import('../useThemeInit');
    useThemeInit = hookMod.useThemeInit;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute('data-theme');
  });

  // ────────────────────────────────────────────────────────────────
  // DOM sync
  // ────────────────────────────────────────────────────────────────

  it('sets data-theme="light" on documentElement when resolved is light', () => {
    // Force store to light
    useThemeStore.setState({ resolved: 'light', preference: 'light' });

    renderHook(() => useThemeInit());

    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('sets data-theme="dark" on documentElement when resolved is dark', () => {
    useThemeStore.setState({ resolved: 'dark', preference: 'dark' });

    renderHook(() => useThemeInit());

    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('updates data-theme when the store resolved value changes', () => {
    useThemeStore.setState({ resolved: 'light', preference: 'light' });

    const { rerender } = renderHook(() => useThemeInit());
    expect(document.documentElement.dataset.theme).toBe('light');

    // Simulate a store change — the subscribe callback fires on setState
    useThemeStore.setState({ resolved: 'dark', preference: 'dark' });
    rerender();

    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  // ────────────────────────────────────────────────────────────────
  // matchMedia lifecycle
  // ────────────────────────────────────────────────────────────────

  it('registers a matchMedia change listener on mount', () => {
    renderHook(() => useThemeInit());

    const matchMediaMock = window.matchMedia as ReturnType<typeof vi.fn>;
    // First call is from store init, second is from the hook's useEffect
    const callCount = matchMediaMock.mock.calls.length;
    const lastResult = matchMediaMock.mock.results[callCount - 1]
      ?.value as { addEventListener: ReturnType<typeof vi.fn> };

    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
    expect(lastResult).toBeDefined();
    expect(lastResult.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('removes matchMedia listener on unmount', () => {
    const { unmount } = renderHook(() => useThemeInit());

    const matchMediaMock = window.matchMedia as ReturnType<typeof vi.fn>;
    const callCount = matchMediaMock.mock.calls.length;
    const lastResult = matchMediaMock.mock.results[callCount - 1]
      ?.value as { removeEventListener: ReturnType<typeof vi.fn> };

    unmount();

    expect(lastResult.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  // ────────────────────────────────────────────────────────────────
  // Edge cases
  // ────────────────────────────────────────────────────────────────

  it('handles matchMedia not being available gracefully', async () => {
    vi.resetModules();

    // No matchMedia stub — it will be undefined
    vi.stubGlobal('matchMedia', undefined);
    const storageData: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn((key: string, value: string) => {
        storageData[key] = value;
      }),
      removeItem: vi.fn(),
    });

    const storeMod = await import('../../stores/theme-store');
    storeMod.useThemeStore.setState({ resolved: 'light', preference: 'light' });

    const hookMod = await import('../useThemeInit');

    expect(() => {
      renderHook(() => hookMod.useThemeInit());
    }).not.toThrow();

    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
