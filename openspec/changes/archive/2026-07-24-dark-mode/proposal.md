# Proposal: Dark Mode & Theme System

## Intent

The frontend has no dark mode. A 2600-line CSS file uses 13 custom properties plus 77 hardcoded color values — all light-mode only. Users need light, dark, and system-following modes with zero flicker on load.

## Scope

### In Scope
- CSS custom property refactor: `[data-theme="dark"]` overrides for all existing variables + ~10 new semantic variables replacing hardcoded values
- Zustand `theme-store` with `'light' | 'dark' | 'system'` preference + resolved mode
- localStorage persistence (`full-editor-theme` key)
- Flicker-mitigation inline `<script>` in `index.html`
- 3-button toggle in `UserMenu` alongside language switcher
- i18n keys: `theme`, `themeLight`, `themeDark`, `themeSystem` in `common.json` (en + es)

### Out of Scope
- Per-user server-persisted preferences, theme editor, animation polish

## Capabilities

### New Capabilities
- `theme-system`: CSS custom property theme engine driven by `data-theme` attribute + Zustand store. Supports light, dark, and system-following modes with localStorage persistence and i18n-aware toggle UI.

### Modified Capabilities
None — existing specs (user-auth, i18n-infrastructure) are unchanged.

## Approach

**CSS Custom Properties + `data-theme` on `<html>`** — the codebase already uses CSS variables as design tokens. Add `[data-theme="dark"]` overrides. Introduce semantic variables (`--color-accent-bg`, `--color-info-bg`, `--color-success-bg`, `--color-warning-bg`, `--color-glass-surface`, `--color-on-accent`, `--color-shadow`) for the 77 hardcoded values.

Theme lifecycle: Zustand reads localStorage → resolves system mode via `matchMedia` → sets `data-theme` on `<html>`. Inline `<script>` in `<head>` sets `data-theme` before React mounts to prevent flicker. Login gradients get dark palette equivalents. Glassmorphism surfaces invert. Shadows switch to colored/lighter variants.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/index.css` | Modified | `[data-theme="dark"]` block, ~10 new variables, replace 77 hardcoded values |
| `frontend/src/stores/theme-store.ts` | New | Zustand: preference + resolved theme + `matchMedia` listener |
| `frontend/src/components/UserMenu.tsx` | Modified | 3-button theme toggle |
| `frontend/index.html` | Modified | Inline flicker script + `color-scheme` meta |
| `frontend/src/i18n/locales/*/common.json` | Modified | 4 theme i18n keys per language |

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Visual regressions from variable replacement | Medium | Light-mode screenshot comparison; all existing tests pass |
| Shadow invisibility on dark surfaces | High | `--color-shadow` with lighter/colored dark variant |
| Login gradient break in dark mode | Medium | Explicit dark gradient alternatives |
| Flicker on system mode load | Low | Inline script reads localStorage before DOM paint |
| `matchMedia` listener leak | Low | Cleanup on store teardown |

## Rollback Plan

Remove `[data-theme="dark"]` block and `data-theme` application. Delete `theme-store.ts`. Revert `UserMenu` toggle. Remove inline script from `index.html`. Light-mode `:root` is unchanged.

## Dependencies

None — no new npm packages. Uses existing Zustand 5, React 19, i18next, Vite 8.

## Success Criteria

- [ ] All existing tests pass
- [ ] Light mode renders identically to production
- [ ] Dark mode renders correctly across authenticated views + login page
- [ ] Theme switch is instant (no reload)
- [ ] System mode follows OS preference changes in real-time
- [ ] No flicker on page load in any mode
