# Tasks: i18n Support (English/Spanish)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 700–1000 |
| 400-line budget risk | High |
| Chained PRs recommended | No |
| Suggested split | Single PR (size:exception) |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Base | Notes |
|------|------|------|-------|
| 1 | Deps + i18n config + types | main | Foundation — install, create index.ts, types.ts, main.tsx import |
| 2 | All 16 translation JSONs | Unit 1 | en/es × 8 namespaces, extracted from existing components |
| 3 | All ~14 component migrations | Unit 2 | LoginPage, UserMenu, DocumentManager, Toolbar, ShareDialog, PageSettingsPopup, CommentSidebar, CommentThread, Editor, stores |
| 4 | CSS + tests + polish | Unit 3 | Lang switcher styles, unit/integration tests, Suspense verification |

## Phase 1: Foundation

- [x] 1.1 Run `npm install i18next react-i18next i18next-browser-languagedetector`
- [x] 1.2 Create `frontend/src/i18n/index.ts` — i18n init with detection chain, 8 ns resources, en/es imports
- [x] 1.3 Create `frontend/src/i18n/types.ts` — TS module augmentation for all 8 namespaces
- [x] 1.4 Modify `frontend/src/main.tsx` — add `import './i18n'`

## Phase 2: Translation Assets

- [x] 2.1 Create `en/common.json` + `es/common.json` (~10 keys: loading, save, cancel, delete, close, back, confirm, yes, no, readOnly)
- [x] 2.2 Create `en/toolbar.json` + `es/toolbar.json` (~30 keys: toolbar tooltips, block picker, link popup)
- [x] 2.3 Create `en/document.json` + `es/document.json` (~10 keys: headers, empty states, buttons)
- [x] 2.4 Create `en/share.json` + `es/share.json` (~12 keys: dialog labels, permissions, states)
- [x] 2.5 Create `en/comments.json` + `es/comments.json` (~15 keys: sidebar, thread actions)
- [x] 2.6 Create `en/errors.json` + `es/errors.json` (~8 keys: ERROR_LOAD_DOC, ERROR_SAVE, ERROR_NETWORK, etc.)
- [x] 2.7 Create `en/login.json` + `es/login.json` (~6 keys: title, subtitle, button, footer)
- [x] 2.8 Create `en/page.json` + `es/page.json` (~10 keys: settings labels)

## Phase 3: Core Implementation — Component Migration

- [x] 3.1 Migrate `LoginPage.tsx` — replace strings with `t('login:*')`
- [x] 3.2 Migrate `UserMenu.tsx` — `t('common:*')` labels + add EN/ES language switcher buttons
- [x] 3.3 Migrate `DocumentManager.tsx` — replace mixed en/es strings with `t('document:*')`
- [x] 3.4 Migrate `Toolbar.tsx` — replace ~25 `title` attrs, block picker, link popup with `t('toolbar:*')`
- [x] 3.5 Migrate `ShareDialog.tsx` — replace strings with `t('share:*')`
- [x] 3.6 Migrate `PageSettingsPopup.tsx` — replace labels with `t('page:*')`
- [x] 3.7 Migrate `CommentSidebar.tsx` — headers, empty states → `t('comments:*')`
- [x] 3.8 Migrate `CommentThread.tsx` — action labels → `t('comments:*')`
- [x] 3.9 Migrate `Editor.tsx` — read-only banner → `t('document:readOnly')`
- [x] 3.10 Migrate `document-store.ts` — error strings → `ERROR_*` codes
- [x] 3.11 Migrate `api/client.ts` — error strings → `ERROR_*` codes

## Phase 4: Styling & Polish

- [x] 4.1 Add `.user-menu-lang` styles in `frontend/src/index.css`
- [x] 4.2 Verify Suspense need in App.tsx (confirmed — none needed, bundled JSON init before createRoot)

## Phase 5: Testing

- [x] 5.1 Unit test: stores throw `ERROR_*` codes, not English strings
- [ ] 5.2 Unit test: verify all `t('ns:key')` calls exist in JSON files
- [ ] 5.3 Integration test: switch to ES, assert DOM text is Spanish
- [ ] 5.4 Integration test: mock `navigator.language`, assert initial language
