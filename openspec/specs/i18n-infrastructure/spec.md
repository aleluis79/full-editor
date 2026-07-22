# i18n Infrastructure Specification

## Purpose

Internationalization system for English/Spanish — auto-detection, persisted preference, and runtime language switching via react-i18next.

## Requirements

### Requirement: i18n Initialization

The frontend MUST initialize react-i18next with i18next-browser-languagedetector, 8 namespaces (common, toolbar, document, share, comments, errors, login, page), and JSON resource files for en/es locales.

#### Scenario: First visit with Spanish browser

- GIVEN a user visits for the first time
- AND their browser language is set to Spanish
- WHEN the app loads
- THEN all UI text appears in Spanish

#### Scenario: Unsupported locale falls back to English

- GIVEN a user visits for the first time
- AND their browser language is unsupported (e.g., French)
- WHEN the app loads
- THEN all UI text appears in English

### Requirement: Language Detection Chain

The system MUST detect language in this order: `localStorage.getItem('i18nextLng')` → `navigator.language` → `'en'`.

#### Scenario: Return visit uses persisted choice

- GIVEN a user previously switched to Spanish
- AND their browser language is English
- WHEN they return to the app
- THEN the UI appears in Spanish (read from localStorage)

### Requirement: Language Switcher

The UserMenu MUST include a language switcher showing the current language label, with a click action to switch.

#### Scenario: Switch language persists

- GIVEN a user is viewing the app in English
- WHEN they select Spanish from the language switcher
- THEN all UI text changes to Spanish immediately
- AND `localStorage.getItem('i18nextLng')` returns `'es'`

### Requirement: Type-Safe Translation Keys

Translation keys MUST be TypeScript-augmented so that invalid keys produce compile-time errors via an i18n types resource module.

#### Scenario: Invalid key flagged at compile time

- GIVEN a component calls `t('nonexistent:typo_key')`
- WHEN TypeScript compiles
- THEN a type error is raised

### Requirement: All Components Use t()

Every frontend component MUST use `t('ns:key')` for user-facing strings. Hardcoded English or Spanish strings MUST NOT appear in rendered output.

#### Scenario: Zero untranslated strings

- GIVEN the i18n system is active
- WHEN any component renders
- THEN no hardcoded text appears in the DOM
- AND all user-facing strings come from translation files
