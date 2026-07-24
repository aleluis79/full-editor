# Design: Dark Mode & Theme System

## Technical Approach

CSS custom properties driven by `data-theme` on `<html>`, backed by a Zustand store with localStorage persistence. The codebase already uses CSS variables as design tokens — this design adds dark overrides and semantic variables to eliminate 77 hardcoded color values. No new dependencies.

## Architecture Decisions

### Decision: Store separation (state vs side-effects)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| React hook + Zustand subscribe | DOM sync in components, matches project conventions | **Chosen** |
| Side effects inside `create()` | Self-contained but breaks existing store pattern (no stores have internal effects) | Rejected |

Store is pure state + actions. Data-theme sync and matchMedia subscription live in a `useThemeInit()` hook that calls `useThemeStore.subscribe()` and `useEffect` for the MediaQueryList listener. This follows the project's pattern: all 7 existing stores are pure `create((set) => ({ ... }))`.

### Decision: CSS-only shadow strategy

**Choice**: Replace `rgba(0,0,0,x)` in shadows with `--color-shadow` variable. In `:root` it stays `rgba(0,0,0,0.08)`-style; in `[data-theme="dark"]` it becomes `rgba(255,255,255,0.06)` for subtle dark-surface depth. No compositing or mix-blend-mode tricks — pure variable swap.

### Decision: Login gradients via explicit dark palette

**Choice**: Override `.login-bg`, `.login-card`, `.login-icon`, `.login-button` under `[data-theme="dark"]` with dark-appropriate gradient stops. No attempt to automatedly darken gradients via CSS filters — explicit values give pixel-perfect control and match the light-mode approach.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/stores/theme-store.ts` | New | Zustand store: `preference`, `resolved`, `setPreference()` |
| `frontend/src/stores/__tests__/theme-store.test.ts` | New | Unit tests for preference get/set, system resolution, localStorage |
| `frontend/src/hooks/useThemeInit.ts` | New | DOM sync hook: subscribe to `resolved` → `data-theme`, matchMedia listener |
| `frontend/src/hooks/__tests__/useThemeInit.test.ts` | New | Integration: store change updates `document.documentElement.dataset.theme` |
| `frontend/src/components/UserMenu.tsx` | Modify | Add theme toggle (3 buttons) next to language switcher |
| `frontend/src/components/__tests__/UserMenu.test.tsx` | Modify | Add theme toggle assertions (3 buttons, active state, labels) |
| `frontend/src/index.css` | Modify | `[data-theme="dark"]` block, 10 semantic vars in `:root`, replace 77 hardcoded values |
| `frontend/index.html` | Modify | Inline flicker-prevention script before `<script type="module">` |
| `frontend/src/i18n/locales/en/common.json` | Modify | Add `theme`, `themeLight`, `themeDark`, `themeSystem` |
| `frontend/src/i18n/locales/es/common.json` | Modify | Add `theme`, `themeLight`, `themeDark`, `themeSystem` |

## Theme Store Interface

```ts
type ThemePreference = 'light' | 'dark' | 'system';
type ThemeMode = 'light' | 'dark';

interface ThemeState {
  preference: ThemePreference;
  resolved: ThemeMode;
  setPreference: (pref: ThemePreference) => void;
}
```

Initialization order within `create()`: (1) read `localStorage.getItem('full-editor-theme')`, validate to union type, default `'system'`; (2) resolve via `window.matchMedia('(prefers-color-scheme: dark)')`; (3) return both values. `setPreference` writes to localStorage, resolves, and calls `set()`.

## CSS Variable Architecture

**Existing 13 (light-only, unchanged):** `--color-bg`, `--color-surface`, `--color-text`, `--color-text-secondary`, `--color-border`, `--color-accent`, `--color-accent-hover`, `--color-danger`, `--color-danger-bg`, `--color-page`, `--color-cursor`, `--color-selection`, `--color-active-border`.

**New 10 semantic variables (added to `:root`):**

| Variable | Light value | Dark value | Replaces |
|----------|-------------|------------|----------|
| `--color-accent-bg` | `#dbeafe` | `#1e3a5f` | toolbar-active, picker-active, setting-active |
| `--color-info-bg` | `#f0f9ff` | `#0c2d48` | share-permission.read, shared-badge |
| `--color-info-text` | `#0369a1` | `#7cc4f0` | share-permission.read text |
| `--color-success-bg` | `#f0fdf4` | `#0a2e1a` | share-permission.write |
| `--color-success-text` | `#15803d` | `#6ee7a7` | permission.write text, resolved-badge |
| `--color-warning-bg` | `#fef3cd` | `#3d3100` | read-only banner |
| `--color-warning-text` | `#856404` | `#fcd34d` | read-only banner text |
| `--color-glass-surface` | `rgba(255,255,255,0.95)` | `rgba(30,41,59,0.92)` | `.app-top-bar`, `.login-card` |
| `--color-on-accent` | `#ffffff` | `#ffffff` | text on accent backgrounds |
| `--color-shadow` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.06)` | shadow composition |

## Flicker Prevention (index.html)

Blocking `<script>` inserted in `<head>`, before any stylesheet or module script:

```
1. Read localStorage.getItem('full-editor-theme')
2. If 'light' or 'dark' → use as-is
3. If 'system' or absent → matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
4. Set document.documentElement.dataset.theme = resolved
```

This runs synchronously before first paint. No CSS flashes.

## UserMenu Integration

Toggle placed as a new `.user-menu-theme` div between `.user-menu-lang` and the logout button. Three `<button>` elements (☀️ Light / 🌙 Dark / 💻 System), same `.active` pattern as language buttons. Uses `useThemeStore(s => s.preference)` for active state, `useThemeStore(s => s.setPreference)` for click handler. Labels via `t('common:themeLight')` etc.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | Store: preference get/set, system resolution, localStorage roundtrip | Vitest + `vi.stubGlobal` for matchMedia |
| Unit | Store: matchMedia listener triggers resolved update (system mode) | Vitest with `vi.fn()` on addEventListener |
| Integration | `useThemeInit` hook: store `resolved` change → `data-theme` on `<html>` | React Testing Library |
| Component | UserMenu: 3 buttons, active class, click calls setPreference, locale labels | React Testing Library + i18n provider |
| Visual | Light mode screenshot comparison | Manual verification |
| Visual | Dark mode across authenticated views + login | Manual cross-check |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. Feature is additive — light-mode `:root` is unchanged, dark mode activates only with `data-theme="dark"`. Rollback: remove `[data-theme="dark"]` block, delete `theme-store.ts`, revert `UserMenu` toggle, remove inline script. Zero schema changes.
