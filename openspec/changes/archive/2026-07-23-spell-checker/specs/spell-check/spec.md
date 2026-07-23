# Spell Check Specification

## Purpose

Real-time spell checking via nspell in a Web Worker. Detects misspelled words, renders wavy red underlines, shows suggestions on click/right-click, and persists a per-user custom dictionary via API.

## Requirements

### Requirement: Spell Check Execution

Run in a Web Worker debounced by 400ms after the last mutation. Check against the active i18next language dictionary (en/es). Skip during IME composition (`isComposingRef`). Skip URLs, emails, and numeric tokens. Check only the focused block + dirty blocks.

| Scenario | Given | When | Then |
|----------|-------|------|------|
| Pause triggers check | User typing lang="en" | Pauses 400ms | Worker gets block text + "en" dict |
| IME skips | `isComposingRef=true` | Mutation occurs | No message to worker |
| Skips URLs/numbers | Text "Visit https://x.com for 100" | Worker checks | Neither token flagged |

### Requirement: Misspelling Detection

Worker returns `{word, start, end, suggestions[]}` with block-relative offsets. Store in `stores/spell-check-store.ts`.

| Scenario | Given | When | Then |
|----------|-------|------|------|
| Structured results | Block "Ths is a tset" | Worker finishes | Returns `[{word:"Ths",start:0,end:3,suggestions:["This","The"]}, {word:"tset",start:10,end:14,suggestions:["test","set"]}]` |

### Requirement: Error Visualization

Render misspelled words with `text-decoration: underline wavy red`. Correcting clears the underline. Disabling clears all.

| Scenario | Given | When | Then |
|----------|-------|------|------|
| Wavy underline | Misspelling at [0,3] | Block renders | Chars 0-3 are `<span class="spell-misspelled">` with wavy red |
| Correct clears | "Ths" underlined | User picks "This" | `replaceText("Ths"→"This")`, misspelling removed from store |

### Requirement: Suggestion Interaction

Click misspelled word → popover with suggestions + "Add to Dictionary". Right-click → context menu with same. Suggestion click calls `replaceText`. Show "No suggestions" when empty.

| Scenario | Given | When | Then |
|----------|-------|------|------|
| Click shows popover | "tset" underlined | User left-clicks | Popover shows "test", "set", "Add to Dictionary" |
| Suggestion replaces | Popover open | User clicks "test" | `replaceText({blockId, start:10, end:14, text:"test"})` called |

### Requirement: Toolbar Toggle

Toggle button in toolbar, enabled by default. Disabling clears store and stops worker messages.

| Scenario | Given | When | Then |
|----------|-------|------|------|
| Toggle disables | Enabled with underlines | User clicks toggle | Store cleared, no more worker messages, toggle disabled |

### Requirement: User Dictionary (Frontend)

Fetch custom words from `GET /api/v1/custom-words` on init. "Add to Dictionary" POSTs the word. SHOULD filter suggestions to exclude user-added words.

| Scenario | Given | When | Then |
|----------|-------|------|------|
| Custom words on init | User has ["opencode","typescript"] in backend | Spell check inits | Dictionary includes them, not flagged |

### Requirement: User Dictionary (Backend)

Table `custom_words(id, user_id, word, lang, created_at)`. Endpoints: `GET /api/v1/custom-words` (200 list), `POST /api/v1/custom-words` (201 created), `DELETE /api/v1/custom-words/{id}` (204 deleted). Scope by `user_id` from Keycloak JWT. Return 401 for unauthenticated, 404 for non-existent/non-owned.

| Scenario | Given | When | Then |
|----------|-------|------|------|
| Add word | Authenticated | POST `{"word":"opencode","lang":"en"}` | Status 201, body has word with `id` |
| Unauthenticated | No JWT | GET `/api/v1/custom-words` | Status 401 |

### Requirement: i18n

Add keys in toolbar namespace: `spellCheckEnable`, `spellCheckDisable`, `suggest`, `addToDictionary`, `noSuggestions`. En and es translations.

| Scenario | Given | When | Then |
|----------|-------|------|------|
| Correct label | Lang="en" | Toolbar renders | Toggle shows `spellCheckEnable` label |
