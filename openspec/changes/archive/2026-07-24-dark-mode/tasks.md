# Tasks: Dark Mode & Theme System

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~530 |
| 400-line budget risk | Medium |
| 800-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | single-pr |
| Suggested split | Single PR |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Theme foundation + CSS engine + UI toggle | PR 1 | `npx vitest run frontend/src/stores/__tests__/theme-store frontend/src/components/__tests__/UserMenu` | `make dev` then toggle Light/Dark/System in UserMenu | Remove `theme-store.ts`, `useThemeInit.ts`, revert `UserMenu.tsx`, `index.html`, `index.css` |

## Phase 1: Foundation

- [x] 1.1 Add i18n keys (`theme`, `themeLight`, `themeDark`, `themeSystem`) to `frontend/src/i18n/locales/en/common.json` and `frontend/src/i18n/locales/es/common.json`
- [x] 1.2 Create `frontend/src/stores/theme-store.ts` — Zustand store with `preference`/`resolved`/`setPreference`, localStorage key `full-editor-theme`, matchMedia resolve
- [x] 1.3 Create `frontend/src/stores/__tests__/theme-store.test.ts` — unit tests: default system, stored override, setPreference persist+resolve, matchMedia listener (`vi.stubGlobal`)
- [x] 1.4 Add 10 semantic vars to `:root` in `frontend/src/index.css` and create `[data-theme="dark"]` block with dark value overrides

## Phase 2: Core Implementation

- [x] 2.1 Create `frontend/src/hooks/useThemeInit.ts` — subscribe to `resolved` → set `document.documentElement.dataset.theme`, mount matchMedia listener, cleanup on unmount
- [x] 2.2 Create `frontend/src/hooks/__tests__/useThemeInit.test.ts` — integration: store `resolved` change updates `data-theme` on `<html>`
- [x] 2.3 Add blocking inline flicker-prevention `<script>` to `frontend/index.html` before `<script type="module">`
- [x] 2.4 Replace ~77 hardcoded color values in `frontend/src/index.css` with the 10 semantic variables from 1.4

## Phase 3: UI Integration

- [x] 3.1 Add theme toggle (Light/Dark/System buttons) to `UserMenu.tsx` — placed between `.user-menu-lang` and logout, using `useThemeStore` and `t('common:themeLight')` etc.
- [x] 3.2 Add theme toggle tests to `frontend/src/components/__tests__/UserMenu.test.tsx` — 3 buttons, active class, click calls `setPreference`, locale labels

## Phase 4: Verification

- [x] 4.1 Run `make test` — confirm all existing tests pass with zero failures
- [x] 4.2 Light-mode visual check — confirm no visual regressions vs production
- [x] 4.3 Dark-mode manual check — toggle to dark, verify backgrounds invert, text is light, shadows use `--color-shadow`
