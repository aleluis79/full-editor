## Exploration: dark-mode

### Current State

The frontend is a React 19 + Vite 8 + Zustand 5 application using a single 2600-line `index.css` file with CSS custom properties on `:root`. Keycloak-based auth, i18next for internationalization (en/es, 8 namespaces). No theme system exists — the app is light-mode only. Color tokens are well-structured via CSS variables, but ~77 hardcoded color values (hex, `white`, `rgba(...)`) are scattered throughout the stylesheet.

### Affected Areas

- **`frontend/src/index.css`** — 2600 lines of global CSS; `:root` block defines 13 color variables; ~77 hardcoded color values need theming. Shadows use `rgba(0,0,0,...)`.
- **`frontend/src/components/UserMenu.tsx`** — Top bar component with language switcher + logout; natural location for a theme toggle.
- **`frontend/src/App.tsx`** — Renders `UserMenu` in the top bar of authenticated views; a theme provider/effect could live here.
- **`frontend/src/main.tsx`** — Bootstrap: `StrictMode` → `ReactKeycloakProvider` → `App`. Theme initialization before mount needs consideration.
- **`frontend/index.html`** — `<html>` element is the target for `data-theme` attribute. Also needs `color-scheme: light dark` meta tag.
- **`frontend/src/stores/`** — No settings/preferences store exists; a new `theme-store.ts` is needed.
- **`frontend/src/i18n/locales/{en,es}/common.json`** — Need theme-related i18n keys (e.g., `theme`, `themeLight`, `themeDark`, `themeSystem`).

### CSS Custom Properties in `:root`

| Variable | Light value | Dark value needed? |
|---|---|---|
| `--color-bg` | `#f3f4f6` | Yes |
| `--color-surface` | `#ffffff` | Yes |
| `--color-text` | `#1f2937` | Yes |
| `--color-text-secondary` | `#6b7280` | Yes |
| `--color-border` | `#e5e7eb` | Yes |
| `--color-accent` | `#2563eb` | Yes (possibly lighten) |
| `--color-accent-hover` | `#1d4ed8` | Yes |
| `--color-danger` | `#dc2626` | Probably same or slightly lighter |
| `--color-danger-bg` | `#fef2f2` | Yes (dark red tint) |
| `--color-page` | `#ffffff` | Yes |
| `--color-cursor` | `#000000` | Yes |
| `--color-selection` | `rgba(0,120,215,0.3)` | Maybe (might work cross-theme) |
| `--color-active-border` | `#2563eb` | Yes |

**Hardcoded value categories** (77 lines):

1. **Semantic colors that should become variables** (the biggest concern):
   - `#dbeafe` (active/selected tint, 7 occurrences) → needs `--color-accent-bg` or similar
   - `#fef2f2` (danger surface, 3 occurrences) → already covered by `--color-danger-bg`
   - `#f0f9ff` / `#0369a1` (info badges) → needs `--color-info-bg` / `--color-info-text`
   - `#f0fdf4` / `#15803d` (success badges) → needs `--color-success-bg` / `--color-success-text`
   - `#d1fae5` / `#065f46` (resolved state) → similar to success
   - `#fef3cd` / `#ffc107` / `#856404` (warning/readonly banner) → needs `--color-warning-*`
   - `#e74c3c` (spellcheck error) → needs `--color-spell-error`
   - `#cbd5e1` (ruler hover) → could use existing `--color-border`
   - `#fca5a5` / `#fecaca` (danger border) → needs `--color-danger-border`
   - `#f8fafc` / `#e2e8f0` / `#f1f5f9` (login page gradients) → needs `--color-login-bg-*`

2. **Keyword `white`** (12 occurrences) — used for text on accent/dark backgrounds; needs a `--color-on-accent` variable or similar inverted text var.

3. **`#fff`** (5 occurrences) — same as `white`.

4. **`rgba(255,255,255,...)`** (3 occurrences) — glassmorphism surfaces on login card and top bar; needs a `--color-glass-surface` var.

5. **`rgba(0,0,0,...)`** (shadows/overlays, ~12 occurrences) — shadows need tweaking in dark mode (they're invisible on dark backgrounds); overlays like `rgba(0,0,0,0.4)` still work.

6. **`#0f172a` / `#64748b` / `#94a3b8`** (login page typography) — hardcoded, should use `--color-text` / `--color-text-secondary`.

7. **`rgba(37,99,235,...)`** (accent-based alpha, ~10 occurrences) — fine to keep; the base color `37,99,235` is `--color-accent`, so these can become `rgba(var(--color-accent-rgb), ...)` if needed or stay as-is since alpha interacts differently with dark backgrounds.

### Zustand Stores

| Store | File | Key state |
|---|---|---|
| `useAuthStore` | `auth-store.ts` | `isAuthenticated`, `isInitialized`, `user`, `token` |
| `useDocumentStore` | `document-store.ts` | Document CRUD, history, editor operations |
| `useEditorStore` | `editor-store.ts` | Cursor, selection, sticky marks, spellCheck toggle |
| `usePageStore` | `page-store.ts` | Pagination, paper config, headers/footers |
| `useCommentStore` | `comment-store.ts` | Comments CRUD, visibility |
| `useSpellCheckStore` | `spell-check-store.ts` | Spell state, misspellings |
| `useLayoutStore` | `layout-store.ts` | Layout engine, constraints |

**No settings/preferences store.** A new `theme-store.ts` should be created.

### i18n Structure

- **Languages**: `en`, `es`
- **Namespaces** (8): `common`, `toolbar`, `document`, `share`, `comments`, `errors`, `login`, `page`
- **Detection**: `localStorage → navigator → htmlTag → 'en' fallback`
- **Cache**: localStorage (`i18nextLng` key)
- **`common.json`** (en): 15 keys — `loading`, `save`, `cancel`, `delete`, `close`, `back`, `confirm`, `yes`, `no`, `readOnly`, `unknownUser`, `signOut`, `ok`. No theme keys.
- **`common.json`** (es): Same 15 keys, Spanish translations.

New i18n keys needed in `common.json`: `theme`, `themeLight`, `themeDark`, `themeSystem`.

### UI Component — Theme Toggle Location

The `UserMenu` component (`frontend/src/components/UserMenu.tsx`) renders in the top bar for all authenticated views. It currently displays:
- Avatar + display name
- Language switcher (EN/ES buttons)
- Logout button

The theme toggle should live alongside the language switcher — same visual pattern (small active/inactive buttons). This is a natural UX fit since both are user preferences.

### Approaches

1. **CSS Custom Properties + `data-theme` on `<html>`** — Add `[data-theme="dark"]` block in `index.css` overriding all color variables. Store preference in a new Zustand `theme-store`. Apply `data-theme` via a `useEffect` in `App.tsx` or a dedicated hook. Use `window.matchMedia('(prefers-color-scheme: dark)')` for system mode. Add `color-scheme: light dark` to `:root`.
   - **Pros**: Zero runtime CSS-in-JS overhead. Works with existing variable-based architecture. Vite outputs unchanged. No new dependencies. Standard web approach.
   - **Cons**: Must manually define dark values for every variable. ~77 hardcoded values need auditing and possibly new variables. Login page gradients need rethinking for dark mode.
   - **Effort**: Medium

2. **CSS-in-JS ThemeProvider** — Wrap app in a ThemeProvider (e.g., Emotion, styled-components, or custom Context). Define theme objects in TS. Components consume via hook.
   - **Pros**: Type-safe. Dynamic. All styling is colocated.
   - **Cons**: Adds dependency (~15KB). Performance overhead at scale. Requires refactoring 2600 lines of CSS into styled components or CSS-in-JS objects. Completely foreign to the current architecture.
   - **Effort**: Very High

3. **Two CSS files (light.css, dark.css) + dynamic `<link>` swap** — Maintain two stylesheets and toggle which one is active.
   - **Pros**: Clean separation. No runtime variable computation.
   - **Cons**: Duplicate maintenance. Sync issues between files. Doesn't solve the hardcoded value problem.
   - **Effort**: Low (short-term), High (long-term maintenance)

### Recommendation

**Approach 1: CSS Custom Properties + `data-theme`** is the clear winner. The codebase already uses CSS variables extensively as a design token system. The pattern of `:root` for light + `[data-theme="dark"]` for dark is the most idiomatic approach for a vanilla CSS architecture. 

Specifically:

1. **New store**: `frontend/src/stores/theme-store.ts` with Zustand — stores `'light' | 'dark' | 'system'` and `'light' | 'dark'` (resolved).
2. **New hook**: `frontend/src/hooks/useTheme.ts` (or inline in App) — applies `data-theme` on `<html>`, listens to `matchMedia` changes.
3. **CSS**: Add `[data-theme="dark"]` block in `index.css`. Add new semantic variables (`--color-accent-bg`, `--color-info-bg`, etc.) for currently-hardcoded values. Add `color-scheme: light dark`.
4. **UI**: Add 3-button toggle (☀️ / 🌙 / 🖥️) in `UserMenu` next to the language switcher.
5. **i18n**: Add `themeLight`, `themeDark`, `themeSystem` to `common.json` (en + es).
6. **Persistence**: localStorage key `full-editor-theme`; same pattern as i18n's `i18nextLng`.

### Risks

- **77 hardcoded colors** — not all must become variables. Colors used on `--color-accent`/`--color-surface` backgrounds that invert correctly in dark mode can stay. Colors like `#dbeafe` (active state tint) must become variables because the tint must shift in dark mode from light-blue to dark-blue.
- **Login page** has complex `radial-gradient` and `linear-gradient` backgrounds — these need separate dark variants. Glassmorphism `rgba(255,255,255,0.85)` must invert to dark translucent.
- **Shadows** (`rgba(0,0,0,...)`) are invisible on dark surfaces — need rethinking. Options: use lighter shadows, colored shadows, or remove shadows in dark mode.
- **Inline React styles** — TSX components may have inline `style={{color: ...}}` or `style={{background: ...}}` that bypass CSS variables. Need to audit all TSX files for inline color values.
- **`prefers-color-scheme`** — `matchMedia` listener must be set up and torn down properly to avoid memory leaks.
- **Flicker on load** — `system` mode may flash light theme before JS executes. Mitigation: set `data-theme` via inline `<script>` in `index.html` reading from localStorage.
- **`color-scheme` vs `data-theme`** — The `color-scheme` CSS property controls native browser UI (scrollbars, form controls). Must be set to `light dark` on `:root` and swapped to `light` or `dark` based on resolved theme.

### Ready for Proposal

Yes — the architecture is well-understood, the approach is clear, and the risks are known. The proposal should scope which hardcoded values become variables vs. stay hardcoded, define the dark mode color palette, and specify the theme store + toggle UI shape.
