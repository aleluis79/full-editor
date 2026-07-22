# Proposal: i18n Support (English/Spanish)

## Intent

~120 hardcoded strings in mixed English/Spanish, no language switching. Blocks Spanish-speaking users and creates maintenance debt. Add i18n infrastructure to externalize all strings and enable language selection.

## Scope

### In Scope
- react-i18next setup with i18next-browser-languagedetector
- Translation JSON files (en/es) — 8 namespaces: common, toolbar, document, share, comments, errors, login, page
- Migrate all ~120 strings across 14 frontend components to `t()` calls
- Language switcher dropdown in UserMenu component
- Auto-detect: localStorage → navigator.language → 'en' fallback
- Backend error codes kept raw, translated on frontend

### Out of Scope
- Backend-side i18n (errors stay as codes)
- Real-time language switching without page reload
- RTL/bidi support
- Community translation contribution workflow

## Capabilities

### New Capabilities
- `i18n-infrastructure`: react-i18next initialization, translation file management, language detection chain, language switcher UI

### Modified Capabilities
None — no spec-level behavioral changes. All existing specs keep their requirements; only string sourcing changes from hardcoded to `t()`.

## Approach

1. Install react-i18next + i18next-browser-languagedetector
2. Create `public/locales/{en,es}/` with 8 namespace JSON files each
3. Initialize i18n instance with detection chain, fallback 'en', ns mapping
4. Wrap app root in `I18nextProvider`
5. Replace hardcoded strings with `t('ns:key')` — one component group per pass
6. Add language switcher (dropdown) to UserMenu with `i18n.changeLanguage()`
7. Persist choice via localStorage (built into languagedetector)

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/` | Modified | ~14 components: `t()` calls replacing hardcoded strings |
| `frontend/src/components/UserMenu.tsx` | Modified | Add language switcher dropdown |
| `public/locales/{en,es}/*.json` | New | 16 translation files (8 per locale) |
| `frontend/src/i18n.ts` | New | i18n instance, config, detection |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Missing string (not extracted) | Med | Sweep with a grep for untranslated text post-migration; CI check |
| Key naming inconsistency | Med | Enforce naming convention (`snake_case`, component-prefixed) in PR review |
| Type safety loss on keys | Low | Use `react-i18next` `useTranslation` generic or i18next types plugin |

## Rollback Plan

1. Revert any file that introduced `useTranslation`/`t()` — hardcoded strings are still in git history
2. Remove `public/locales/` directory
3. Remove `react-i18next` and `i18next-browser-languagedetector` from `package.json`

No data migration needed — this is purely frontend.

## Dependencies

- `react-i18next` + `i18next` + `i18next-browser-languagedetector`

## Success Criteria

- [ ] All ~120 user-facing strings use `t()` — grep for hardcoded ES/EN strings yields zero false positives
- [ ] Language switcher appears in UserMenu and persists across page reloads
- [ ] Switching to Spanish updates all visible strings without app errors
- [ ] Auto-detection picks up browser language on first visit
