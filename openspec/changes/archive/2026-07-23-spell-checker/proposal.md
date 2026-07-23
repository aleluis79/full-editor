# Proposal: Spell Checker

## Intent

Add in-editor spell checking with nspell + Hunspell dictionaries in a Web Worker. Users get real-time wavy-underline feedback for misspelled words, click/right-click suggestion popovers, and a personal dictionary synced to their account.

## Scope

### In Scope
- nspell worker with en/es dictionaries
- Misspelling detection + wavy red underline rendering
- Suggestion popover on click / context menu on right-click
- Toolbar toggle button (enabled by default)
- Backend `CustomWord` model + CRUD API
- i18n keys for en/es toolbar namespace
- TDD tests: Vitest (frontend core), pytest (backend API)

### Out of Scope
- Per-block language detection (uses interface language only)
- Document-level "Ignore All" (only persistent "Add to Dictionary")
- Spell check for PDF export
- Spell check during IME composition

## Capabilities

### New Capabilities
- `spell-check`: nspell-based spell checking in Web Worker, misspelling annotation, wavy underline rendering, suggestion popover, toolbar toggle, user dictionary API integration

### Modified Capabilities
- None — new feature, no existing spec behavior changes

## Approach

Dedicated Web Worker loads nspell + active-language dictionary. 400ms debounce after document mutation triggers check on the current block. Results stored in a new Zustand store. LayoutParagraph wraps misspelled words in `<span class="spell-misspelled">` with wavy red underline. Click/right-click opens popover with nspell suggestions → `replaceText` op. Custom words API (FastAPI + SQLAlchemy) for persistent user dictionary.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `core/types.ts` | Modified | Misspelling annotations |
| `DocumentView.tsx` | Modified | Wavy underline rendering |
| `TextRun.tsx` | Modified | Standalone wavy underline |
| `stores/spell-check-store.ts` | **New** | Zustand misspelling store |
| `stores/editor-store.ts` | Modified | `spellCheckEnabled` toggle |
| `workers/spell-check.worker.ts` | **New** | nspell Web Worker |
| `Toolbar.tsx` | Modified | Toggle + suggestion popover |
| `api/client.ts` | Modified | Custom words API functions |
| `i18n/locales/*/toolbar.json` | Modified | New translation keys |
| `models/custom_word.py` | **New** | SQLAlchemy model |
| `api/custom_words.py` | **New** | FastAPI router |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Dictionary size (~2.3MB) | Med | Load only active language, dynamic import |
| Worker heap (~4-6MB) | Low | Acceptable; monitor |
| Large doc perf | Low | Check only dirty blocks |
| IME interference | Low | Skip during composition |

## Rollback Plan

Disable spell check toggle — clears all misspelling state. Remove store subscription, worker postMessage calls, and CSS class. Revert toolbar button. Delete `CustomWord` model + API via Alembic migration.

## Dependencies

- nspell, dictionary-en, dictionary-es (npm)
- PostgreSQL migration for `custom_words` table

## Success Criteria

- [ ] Misspelled words show wavy red underline within 500ms of typing pause
- [ ] Clicking misspelled word shows suggestion popover
- [ ] Selecting a suggestion replaces the word in the document
- [ ] "Add to Dictionary" persists across page reloads via API
- [ ] Disabling toggle removes all underlines and stops checking
- [ ] All frontend + backend tests pass
