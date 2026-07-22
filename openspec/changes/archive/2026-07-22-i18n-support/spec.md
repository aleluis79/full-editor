# Delta: i18n Support

## ADDED Requirements

### New Capability: i18n-infrastructure

Full specification at `openspec/specs/i18n-infrastructure/spec.md`. This change adds the entire i18n pipeline — initialization, detection, persistence, language switcher, type safety, and the requirement that all components use `t()`.

### Component-Level Translation Requirements

Every component with user-facing strings MUST migrate hardcoded text to `t()` calls. Each entry below adds this requirement to the referenced component or store.

| Component / Module | Namespace | Key Pattern | Notes |
|---|---|---|---|
| LoginPage | `login` | `login:*` | All login form strings |
| UserMenu | `common` | `common:*` | Menu labels + language switcher |
| Toolbar | `toolbar` | `toolbar:*` | Tooltips, labels, block picker |
| ShareDialog | `share` | `share:*` | Share dialog strings |
| PageSettingsPopup | `page` | `page:*` | Page settings labels |
| CommentSidebar | `comments` | `comments:*` | Sidebar headers, empty states |
| CommentThread | `comments` | `comments:reply`, `comments:delete`, `comments:resolve` | Action labels |
| Editor | `document` | `document:read_only` | Read-only banner |
| DocumentManager | `document` | `document:*` | List headers, action text |
| DocumentStore (Zustand) | `errors` | `errors:*` | User-facing error messages |
| API Client | `errors` | `errors:*` | API error strings (codes translated to messages) |
| ImageInsertDialog / ImagePaste | `common` | `common:image_size_error`, `common:image_format_error`, `common:upload_failed` | Validation error messages (shared) |
| BlockLineHeight | `toolbar` | `toolbar:line_height_label` | History description string |

#### Scenario: All component strings extracted

- GIVEN the i18n system is active
- WHEN each component above renders in English
- THEN all strings map to valid `t()` calls in the en translation files
- AND no hardcoded strings appear in rendered output

#### Scenario: Spanish switch covers all components

- GIVEN the user switches to Spanish
- WHEN each component above renders
- THEN all strings render in Spanish (all keys have es translations)
- AND no fallback-to-English keys leak except for intentionally untranslated content

## RENAMED Requirements

None existing specs are renamed by this change.

## REMOVED Requirements

None existing requirements are removed by this change.
