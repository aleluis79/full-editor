# Design: Spell Checker

## Technical Approach

Dedicated Web Worker loads nspell + active-language Hunspell dictionary. After a 400ms debounce on document mutations, the focused block + dirty blocks are sent to the worker. Misspellings stored in a separate Zustand store — NOT as document marks. Renderer reads both document tree and misspelling store to wrap words in `<span class="spell-misspelled">` with wavy red underline. Click/right-click triggers popover/context-menu with suggestions. User dictionary persisted via FastAPI + SQLAlchemy.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|----------|---------|----------|--------|
| Misspelling storage | New MarkType vs parallel store | MarkType pollutes document model, couples spell-check to marks, breaks history/undo. Parallel store keeps concerns separate, clears trivially on toggle. | **Parallel Zustand store** `spell-check-store.ts` |
| Worker strategy | Merge with layout worker vs dedicated | Layout worker handles text measurement — different lifecycle, concerns, and dictionary memory (~4-6MB). Merging would add complexity and coupling. | **Dedicated worker** `workers/spell-check.worker.ts` |
| Suggestion popover | Reuse link popup pattern vs new component | Link popup uses absolute-positioned div with outside-click dismiss — well-tested pattern. New component adds maintenance. | **Follow link popup** — positioned popover in Toolbar |
| API router pattern | New prefix vs follow comments | Comments use `prefix="/api"` with full paths. Consistent pattern reduces cognitive overhead. | **Match comments router** — `prefix="/api"` |
| CORS config | Add to existing origins vs separate | Main.py already has CORS middleware. No changes needed — spell check API uses same origin. | **No CORS changes** |

## Data Flow

```
User types → document-store mutation
  → useSpellCheck hook (400ms debounce)
    → spell-check.worker.ts [postMessage]
      → nspell.check(word) for each token
      → nspell.suggest(word) on miss
    → worker returns [{word,start,end,suggestions}]
  → spell-check-store.ts [set misspellings]
    → DocumentView/LayoutParagraph [subscribes to store]
      → renderTextContent() wraps words in <span class="spell-misspelled">
        → user clicks → popover shows suggestions
          → user picks → document-store.replaceSelection()
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/workers/spell-check.worker.ts` | Create | nspell + dictionary loading, check/suggest loop |
| `frontend/src/stores/spell-check-store.ts` | Create | Zustand store: misspellings map, enabled toggle, custom words |
| `frontend/src/hooks/useSpellCheck.ts` | Create | 400ms debounce, worker lifecycle, doc mutation subscription |
| `frontend/src/components/SpellCheckPopover.tsx` | Create | Suggestion popover (click) / shared context menu (right-click) |
| `frontend/src/components/DocumentView.tsx` | Modify | `renderTextContent()` reads spell-check store, wraps misspelled words |
| `frontend/src/components/TextRun.tsx` | Modify | Same wrapping for standalone TextRun path |
| `frontend/src/components/Toolbar.tsx` | Modify | Add spell check toggle button |
| `frontend/src/stores/editor-store.ts` | Modify | Add `spellCheckEnabled` toggle |
| `frontend/src/api/client.ts` | Modify | Add `fetchCustomWords`, `addCustomWord`, `deleteCustomWord` functions |
| `frontend/src/i18n/locales/en/toolbar.json` | Modify | Add spell check keys |
| `frontend/src/i18n/locales/es/toolbar.json` | Modify | Add spell check keys (es) |
| `frontend/src/index.css` | Modify | Add `.spell-misspelled` class |
| `backend/app/models/custom_word.py` | Create | SQLAlchemy model + Pydantic schemas |
| `backend/app/models/__init__.py` | Modify | Export CustomWordModel |
| `backend/app/api/custom_words.py` | Create | FastAPI CRUD router |
| `backend/app/main.py` | Modify | Register custom_words router |
| `alembic/versions/*_create_custom_words.py` | Create | Migration for custom_words table |

## Interfaces / Contracts

**Worker messages:**

```typescript
// → to worker
type SpellCheckRequest = {
  type: 'check';
  payload: {
    blocks: Array<{ id: string; text: string }>;
    lang: 'en' | 'es';
    customWords: string[];
  };
};

// ← from worker
type SpellCheckResult = {
  type: 'result';
  payload: Array<{
    blockId: string;
    misspellings: Array<{
      word: string;
      start: number;
      end: number;
      suggestions: string[];
    }>;
  }>;
};
```

**Spell check store:**

```typescript
interface SpellCheckState {
  enabled: boolean;
  misspellings: Map<string, Misspelling[]>; // blockId → misspellings
  customWords: Set<string>;
  popover: { blockId: string; start: number; end: number; suggestions: string[] } | null;

  toggle: () => void;
  setMisspellings: (blockId: string, words: Misspelling[]) => void;
  clearBlock: (blockId: string) => void;
  clearAll: () => void;
  setCustomWords: (words: string[]) => void;
  addCustomWord: (word: string) => void;
  showPopover: (opts: PopoverState) => void;
  hidePopover: () => void;
}
```

**API contract** (matches comments router pattern):

```
GET    /api/v1/custom-words     → 200, list of {id, word, lang}
POST   /api/v1/custom-words     → 201, {id, word, lang, created_at}
DELETE /api/v1/custom-words/{id} → 204
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (nspell) | Word check, suggestions, URL/number skip | Vitest with mocked dictionary |
| Unit (store) | Toggle, clear, popover state | Vitest — Zustand store |
| Unit (backend) | Model create, list, delete | pytest + SQLite |
| Integration (worker) | postMessage → response roundtrip | Vitest with worker mock |
| API (custom words) | CRUD, auth-scoping | pytest + httpx.TestClient |
| E2E | Full flow: type misspelled → underline → click → correct | Playwright (future) |

## Migration / Rollout

No existing data migration. Alembic revision creates `custom_words` table. Feature is additive and toggleable.

## Open Questions

- [ ] Dictionary loading: load at app startup vs lazy on first check? Proposal: lazy — worker loads on first `check` message.
- [ ] Context menu: build custom context menu or integrate with browser native? Decision: build custom to control suggestions list rendering.
