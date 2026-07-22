# Design: i18n Support (English/Spanish)

## Technical Approach

Add react-i18next + i18next-browser-languagedetector to externalize ~120 hardcoded strings across 14 components + 2 stores. Translation JSON files live under `frontend/src/i18n/locales/` (build-time imported, not runtime-fetched) so TypeScript validates key shapes and bundler inlines them. Error stores emit codes (not strings); UI layer translates them via `t()`.

References: `openspec/specs/i18n-infrastructure/spec.md`, `openspec/changes/i18n-support/spec.md`.

## Architecture Decisions

### Decision: Translation file location

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `public/locales/{locale}/*.json` (runtime fetch) + i18next-http-backend | Async loading, no type safety, extra HTTP requests | ❌ Rejected |
| `src/i18n/locales/{locale}/*.json` (build-time import) | Bundled in JS, synchronous init, type-safe via TS module augmentation | ✅ Chosen |

Rationale: No backend i18n, small JSON payloads (~2KB each), bundler inlines them into the JS chunk. Avoids async loading complexity and enables compile-time key checking.

### Decision: I18nextProvider vs implicit init

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Wrap `<I18nextProvider i18n={i18n}>` in main.tsx | Explicit provider, works without module init | ❌ Rejected |
| `initReactI18next` plugin (import `./i18n` in main.tsx) | Simpler, `useTranslation` works globally, no provider needed | ✅ Chosen |

Rationale: `initReactI18next` binds the i18n instance to React context internally. The import side-effect in `main.tsx` is sufficient.

### Decision: Type safety for translation keys

Use `react-i18next`'s type augmentation via a `resources` declaration that maps our key structure. This gives compile-time errors for missing keys without adding a code generation step.

### Decision: Error handling pattern

Stores (`document-store.ts`, `api/client.ts`) use machine-readable error codes as strings. Components catch errors and call `t('errors:ERROR_CODE')`. API client errors stay as codes — only the UI layer translates them.

## Data Flow

```
Browser language → LanguageDetector → localStorage/navigator → i18n.init(lng)
                                                                    │
                                    ┌───────────────────────────────┤
                                    ↓                               ↓
                            en/*.json (import)              es/*.json (import)
                                    │                               │
                                    └────────── i18n instance ──────┘
                                                    │
                          ┌─────────────────────────┼─────────────────────────┐
                          ↓                         ↓                         ↓
                     Components (t())          Stores (error codes)     UserMenu (changeLanguage)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/i18n/index.ts` | Create | i18n init, LanguageDetector, 8 ns resources (en/es) |
| `frontend/src/i18n/types.ts` | Create | Type augmentation for `react-i18next` resource keys |
| `frontend/src/i18n/locales/en/common.json` | Create | ~10 shared strings (loading, save, cancel, etc.) |
| `frontend/src/i18n/locales/en/toolbar.json` | Create | ~30 toolbar tooltips + block picker labels |
| `frontend/src/i18n/locales/en/document.json` | Create | ~10 doc manager strings |
| `frontend/src/i18n/locales/en/share.json` | Create | ~12 share dialog strings |
| `frontend/src/i18n/locales/en/comments.json` | Create | ~15 comment UI strings |
| `frontend/src/i18n/locales/en/errors.json` | Create | ~8 error messages (ERROR_* codes) |
| `frontend/src/i18n/locales/en/login.json` | Create | ~6 login page strings |
| `frontend/src/i18n/locales/en/page.json` | Create | ~10 page settings strings |
| `frontend/src/i18n/locales/es/*.json` | Create | Same structure, Spanish translations |
| `frontend/src/main.tsx` | Modify | Add `import './i18n'` |
| `frontend/src/App.tsx` | Modify | Wrap content in `<Suspense>` (or remove if synchronous — see open questions) |
| `frontend/src/components/LoginPage.tsx` | Modify | Replace hardcoded strings with `t('login:*')` |
| `frontend/src/components/UserMenu.tsx` | Modify | Add language switcher buttons, `t()` for labels |
| `frontend/src/components/Toolbar.tsx` | Modify | Replace ~25 `title` attrs + block picker labels with `t('toolbar:*')` |
| `frontend/src/components/ShareDialog.tsx` | Modify | Replace strings with `t('share:*')` |
| `frontend/src/components/PageSettingsPopup.tsx` | Modify | Replace labels with `t('page:*')` |
| `frontend/src/components/DocumentManager.tsx` | Modify | Replace strings with `t('document:*')` |
| `frontend/src/components/CommentSidebar.tsx` | Modify | Replace strings with `t('comments:*')` |
| `frontend/src/components/CommentThread.tsx` | Modify | Replace action labels with `t('comments:*')` |
| `frontend/src/components/Editor.tsx` | Modify | Read-only banner text → `t('document:read_only')` |
| `frontend/src/stores/document-store.ts` | Modify | Error messages → `ERROR_*` codes |
| `frontend/src/api/client.ts` | Modify | Error messages → `ERROR_*` codes |
| `frontend/src/index.css` | Modify | Add `.user-menu-lang` styles |

## Interfaces / Contracts

```typescript
// frontend/src/i18n/types.ts — Type augmentation for type-safe keys
import 'react-i18next';
import enCommon from './locales/en/common.json';
import enToolbar from './locales/en/toolbar.json';
import enDocument from './locales/en/document.json';
import enShare from './locales/en/share.json';
import enComments from './locales/en/comments.json';
import enErrors from './locales/en/errors.json';
import enLogin from './locales/en/login.json';
import enPage from './locales/en/page.json';

declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof enCommon;
      toolbar: typeof enToolbar;
      document: typeof enDocument;
      share: typeof enShare;
      comments: typeof enComments;
      errors: typeof enErrors;
      login: typeof enLogin;
      page: typeof enPage;
    };
  }
}
```

**Error code contract** (stores → UI):
- Stores (document-store, API client) throw `new Error('ERROR_CODE')`
- Components catch and call `t('errors:ERROR_CODE')`
- `en/errors.json` / `es/errors.json` map codes to user-facing strings

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Store error codes | Assert stores throw `'ERROR_*'` codes, not English strings |
| Unit | Translation key coverage | Script that reads all `t('ns:key')` calls and checks key existence in JSON |
| Integration | Language switcher | Visit page, switch to ES, assert DOM text is Spanish |
| Integration | Detection chain | Mock `navigator.language`, assert correct initial language |

## Migration / Rollout

No migration required. Old hardcoded strings remain in git history. Feature flag not needed — deployment replaces all strings atomically.

## Open Questions

- [ ] **Suspense vs sync**: Since JSON is bundled, translations load synchronously. Do we still need `<Suspense>` in App.tsx? The init runs in `main.tsx` before `createRoot`, so likely no Suspense needed. Verify at implementation.
- [ ] **Vite tree-shaking**: Confirm imported JSON objects survive tree-shaking correctly when spread into the `resources` config. May need explicit `import` statements per locale.
