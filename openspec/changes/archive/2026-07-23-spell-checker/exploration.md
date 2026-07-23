## Exploration: Spell Checker for Full Editor

### Current State
How the system works today relevant to spell checking:

1. **Document Model**: TextRun nodes store text content with marks (bold, italic, etc.) and attrs (font, color, etc.). There is NO spelling annotation mechanism yet.
2. **Text Rendering**: LayoutParagraph in DocumentView.tsx renders TextRun children as spans. Marks drive CSS styles (fontWeight, fontStyle, textDecoration). Each run is rendered as a single `<span>` or `<a>` element with inline styles.
3. **Typing Flow**: Editor.tsx captures keyboard via hidden textarea → handleKeyDown → insertText (document-store) → applyInsertText (immutable ops) → React re-render → layout worker recalculates.
4. **i18n**: i18next with en + es namespaces already set up. Language is detected via localStorage → navigator → htmlTag.
5. **Auth**: Keycloak-based, UserInfo has id/keycloakId/email/displayName in auth-store.ts.
6. **Backend API Pattern**: FastAPI routers with SQLAlchemy models, auth via get_current_user dependency injection. Test pattern uses SQLite in-memory with TestClient.
7. **Layout Worker**: Already uses layout.worker.ts with OffscreenCanvas for text measurement. Pattern exists for Web Worker communication.
8. **Toolbar**: Toolbar.tsx uses Zustand stores for all state. Toggle buttons follow `toolbar-btn-active` pattern with i18n translation keys.
9. **Tests**: Frontend uses Vitest with describe/it/expect pattern. Tests are co-located in `core/__tests__/`. Backend uses pytest with conftest fixtures.

### Affected Areas
- `frontend/src/core/types.ts` — Add MarkType 'misspelled' or a new misspelling annotation system
- `frontend/src/components/DocumentView.tsx` — LayoutParagraph.renderTextContent() needs to render wavy underlines for misspelled ranges
- `frontend/src/components/TextRun.tsx` — Same rendering change for standalone TextRun component
- `frontend/src/stores/editor-store.ts` — Add spellCheckEnabled toggle state
- `frontend/src/stores/document-store.ts` — Optionally trigger spell check debounce after insertText/deleteText
- `frontend/src/workers/layout.worker.ts` — Or new spell-check.worker.ts for spell checking logic
- `frontend/src/components/Toolbar.tsx` — Add spell check toggle button
- `frontend/src/api/client.ts` — Add custom-words API functions
- `frontend/src/i18n/locales/en/toolbar.json` — Add spellcheck-related translation keys
- `frontend/src/i18n/locales/es/toolbar.json` — Same for Spanish
- `frontend/src/i18n/types.ts` — Augment with new namespace or keys
- `backend/app/models/` — Add CustomWord SQLAlchemy model
- `backend/app/api/` — Add custom-words API endpoints router
- `backend/app/main.py` — Register new router
- `backend/tests/` — Add tests for custom-words API
- `frontend/src/core/__tests__/` — Add tests for spell checking logic

### Approaches

1. **nspell + dictionary-en/dictionary-es (Recommended)**
   - npm packages: `nspell` (~25KB), `dictionary-en` (~1.5MB), `dictionary-es` (~800KB)
   - Uses Hunspell .aff + .dic files (same as LibreOffice, Firefox, Chrome)
   - Properly handles affix rules: plurals, conjugations, compound words, accents
   - Runs naturally in a Web Worker via postMessage
   - nspell provides `correct(word)` and `suggest(word)` APIs
   - Pros: Battle-tested, handles bilingual check properly, accurate suggestions, good API
   - Cons: Dictionary files are large (~2.3MB combined), need async loading strategy
   - Effort: Medium

2. **typo-js**
   - npm: `typo-js` (~15KB), also uses .aff/.dic files
   - Simpler JS-only Hunspell implementation
   - Pros: Same dictionary format, simpler API, runs in workers
   - Cons: Less maintained (last update 2021), fewer features than nspell
   - Effort: Medium

3. **Custom lightweight checker (Damerau-Levenshtein + word lists)**
   - Build word frequency lists from npm word-list and español word lists
   - Build a Trie for lookup, Damerau-Levenshtein for suggestions
   - Pros: Full control, potentially smaller bundle, no external dependency
   - Cons: No affix support (must store every inflected form), suggestions are less accurate, significant custom code, poor handling of Spanish verb conjugations (~50 forms per verb)
   - Effort: High

### Recommendation
**nspell + dictionary-en/dictionary-es** is the recommended approach because:
- It's the same engine used by Firefox and LibreOffice — proven accuracy
- Proper handling of Spanish: accents, ¿/¡, verb conjugations, gender/number agreement
- Worker-friendly: dictionaries load once, check runs async
- Suggestions are high quality (Hunspell uses n-gram similarity with phonetic rules)
- The bundle size concern is mitigated by deferring dictionary load and using IndexedDB for caching

### Key Design Decisions
1. **Web Worker**: Create a dedicated `spell-check.worker.ts` separate from layout worker. The worker loads both en and es dictionaries, receives `{text: string, lang: 'en'|'es'}` messages, returns `[{word, offset, suggestions[]}]`.
2. **Debounce**: 400ms debounce after the last document mutation (matching the existing BATCH_TIMEOUT_MS pattern at 300ms).
3. **Storage**: Spell check results stored in a new Zustand `spell-check-store.ts` — `{misspellings: Map<string, Misspelling[]>, enabled: boolean}`.
4. **Language Detection**: Use i18next `language` property to determine which dictionary to check against. If the user switches languages, reload dictionary.
5. **Wavy Underline**: Add CSS class `spell-misspelled` with `text-decoration: underline wavy red; text-underline-position: under;`. Render.splitTextRange() in LayoutParagraph to wrap misspelled words in `<span className="spell-misspelled">`.
6. **Suggestion Popover**: On click (or right-click) on a misspelled word, show a popover. After user selects a suggestion, apply a `replaceText` operation in document-store.
7. **User Dictionary**: Backend table `custom_words(user_id, word, lang)`. API endpoints per backend pattern. Frontend syncs on login and when adding words. For non-authenticated users, store in localStorage.

### Risks
- **Dictionary Size**: 2.3MB combined for en+es dictionaries. Load only the active language dictionary. Use IndexedDB for caching between sessions. Show a loading state while dictionaries initialize.
- **Worker Memory**: Dictionary data stays in the worker's JS heap — could be ~4-6MB after parsing. Acceptable for a desktop editor but worth monitoring.
- **Performance with Large Docs**: Spell checking an entire 100-page document on every keystroke would be slow. Solution: only re-check modified blocks (track dirty blocks), or check the paragraph the user is currently editing.
- **Dictionary Loading**: The .aff/.dic files need to be bundled or fetched at runtime. Since the frontend uses Vite, we can import the npm dictionary packages directly — Vite will bundle them. But they're large for the dev server. Consider dynamic imports.
- **Interaction with Composition**: When the user is using IME for CJK characters or Spanish accents via dead keys, spell check should NOT fire during composition (already tracked via isComposingRef).
- **URLs and Mixed Content**: The spell checker should skip URLs, email addresses, and mixed-language content. nspell doesn't handle this — we need pre-processing to tokenize correctly.
- **TDD Impact**: Strict TDD mode means we need test specs BEFORE implementation. The spell check core logic is testable without DOM (pure functions), but worker integration requires mocking.

### Ready for Proposal
Yes — the exploration is complete. The orchestrator should proceed with `sdd-propose` to define scope, approach, and rollback plan.
