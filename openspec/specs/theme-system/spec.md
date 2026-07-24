# theme-system Specification

## Purpose

Theme engine providing light, dark, and system-following modes via CSS custom properties + `data-theme` on `<html>`, driven by a Zustand store with localStorage persistence and i18n-aware toggle UI.

## Requirements

### Requirement: Theme Store

The system MUST provide a Zustand store with a `'light' | 'dark' | 'system'` preference persisted to `localStorage.setItem('full-editor-theme')`, and a resolved `'light' | 'dark'` mode derived from `window.matchMedia('(prefers-color-scheme: dark)')`. The store MUST subscribe to matchMedia changes and clean up listeners on teardown.

#### Scenario: Defaults to system on first visit

- GIVEN localStorage has no `full-editor-theme`
- WHEN the store initializes
- THEN preference is `'system'` and resolved mode matches the OS scheme

#### Scenario: Stored preference overrides default

- GIVEN localStorage `full-editor-theme` is `'dark'`
- WHEN the store initializes
- THEN preference is `'dark'` and resolved mode is `'dark'`

#### Scenario: setPreference persists and resolves

- GIVEN preference is `'system'`
- WHEN `setPreference('light')` is called
- THEN preference is `'light'`, resolved mode is `'light'`, and localStorage key is `'light'`

#### Scenario: System mode reacts to OS changes

- GIVEN preference is `'system'` and OS is light
- WHEN the OS switches to dark
- THEN resolved mode updates to `'dark'` reactively via matchMedia listener

### Requirement: data-theme Attribute

The system MUST set `document.documentElement.dataset.theme` to the resolved mode (`'light'` | `'dark'`) on every resolved-mode change.

#### Scenario: Store change updates DOM

- GIVEN `<html>` has `data-theme="light"`
- WHEN the resolved mode changes to `'dark'`
- THEN `document.documentElement.dataset.theme` is `'dark'`

### Requirement: CSS Theme Engine

The system MUST provide `[data-theme="dark"]` overrides for all 13 existing `:root` color variables. It MUST introduce these semantic CSS variables to replace ~77 hardcoded color values: `--color-accent-bg`, `--color-info-bg`, `--color-info-text`, `--color-success-bg`, `--color-success-text`, `--color-warning-bg`, `--color-warning-text`, `--color-glass-surface`, `--color-on-accent`, `--color-shadow`.

#### Scenario: Light mode is visually unchanged

- GIVEN `data-theme="light"`
- WHEN any component renders
- THEN all colors match the current production appearance

#### Scenario: Dark overrides apply

- GIVEN `data-theme="dark"`
- THEN backgrounds invert to dark, text to light, shadows use `--color-shadow`, and semantic variables map to dark-appropriate values

### Requirement: Theme Toggle in UserMenu

The UserMenu component MUST render a three-button toggle (Light/Dark/System) calling `setPreference`. The active preference button MUST carry an `active` class. Labels MUST use `t('common:themeLight')`, `t('common:themeDark')`, `t('common:themeSystem')`.

#### Scenario: Renders three themed options

- GIVEN the UserMenu renders
- THEN Light, Dark, and System buttons are visible

#### Scenario: Click updates store and active state

- GIVEN Light is active
- WHEN the user clicks Dark
- THEN `setPreference('dark')` is called and the Dark button gains `active` class

#### Scenario: Labels respect locale

- GIVEN locale `'en'` → labels: "Light", "Dark", "System"
- GIVEN locale `'es'` → labels: "Claro", "Oscuro", "Sistema"

### Requirement: Flicker Prevention

The system MUST include an inline blocking `<script>` in `index.html` before `<script type="module">` that reads `full-editor-theme` from localStorage, resolves system mode via `matchMedia` when needed, and sets `data-theme` on `<html>` before first paint.

#### Scenario: No flash of wrong theme

- GIVEN localStorage has `full-editor-theme` = `'dark'`
- WHEN the page loads
- THEN `data-theme="dark"` is set before React content renders

### Requirement: i18n Theme Keys

The system MUST define keys `theme`, `themeLight`, `themeDark`, `themeSystem` in `frontend/src/i18n/locales/{en,es}/common.json`.

#### Scenario: English translations

- THEN `t('common:theme')` → "Theme", `t('common:themeLight')` → "Light", `t('common:themeDark')` → "Dark", `t('common:themeSystem')` → "System"

#### Scenario: Spanish translations

- THEN `t('common:theme')` → "Tema", `t('common:themeLight')` → "Claro", `t('common:themeDark')` → "Oscuro", `t('common:themeSystem')` → "Sistema"

### Requirement: Existing Tests Preserved

All existing tests MUST continue to pass after the theme system is implemented.

#### Scenario: Full suite green

- GIVEN the theme system is fully implemented
- WHEN `make test` is run
- THEN all pre-existing tests pass with zero failures

---
*See tasks.md for required tests: theme-store unit tests (preference get/set, system detection, matchMedia listener), UserMenu toggle component tests (three options, selection updates store, locale labels), and integration test (store change updates `data-theme` on `document.documentElement`).*
