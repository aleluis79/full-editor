# Tasks: UI Modernization

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1300–1600 |
| 400-line budget risk | High |
| Chained PRs recommended | No |
| PR split | Single PR |
| Strategy | single-pr-default |
| Chain | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

## Phase 1: Foundation — Design Tokens & Icon Infrastructure

- [x] 1.1 Rewrite `:root` in `index.css` with token categories (spec §1). Preserve existing `--page-*` and `--color-*` layout vars
- [x] 1.2 Create `icons/Icon.tsx` base wrapper: `viewBox="0 0 24 24"`, `className`, `size` props (design §Interfaces)
- [x] 1.3 Create 22 SVG icon components in `icons/`: Bold, Italic, Underline, Strikethrough, Superscript, Subscript, Link, Image, Table, ListUl, ListOl, AlignLeft/Center/Right, ClearFormatting, Save, Pdf, Back, Plus, Delete, ColorPicker, HighlightPicker
- [x] 1.4 Create `icons/index.ts` barrel re-export for all icon components

## Phase 2: CSS Restructure — Apply Tokens to Components

- [x] 2.1 Rewrite toolbar CSS with tokens: 4 button states, separators, selects, color labels (spec T6)
- [x] 2.2 Update page card CSS: `--shadow-md`, `--radius-md`, preserve `--color-page` (spec P1–P3)
- [x] 2.3 Update block visuals: paragraph hover/active accent bg, headings, blockquote accent border, HR border color, image/table borders (spec B1–B7)
- [x] 2.4 Update document manager CSS with tokens: cards shadow, new-btn accent, delete danger, empty/error states (spec D1–D5)
- [x] 2.5 Update lists, cursor, selection, add transition tokens (spec L1–L3, S1–S3, §8)
- [x] 2.6 Update ruler, table picker, block picker with token colors (spec P5)
- [x] 2.7 Remove deprecated CSS classes: `.align-icon`, `.align-line`, `.toolbar-list-icon`, `.pdf-icon`

## Phase 3: Inline Style Migration

- [x] 3.1 Toolbar: migrate link popup `style={{}}` (position, bg, border, shadow, padding, gap) to `.link-popup`, `.link-popup-input` CSS classes (spec T3)
- [x] 3.2 Toolbar: migrate block picker `style={{}}` (position, bg, border, shadow, item font/size/padding) to `.block-picker-popover`, `.block-picker-item` classes (spec T3)
- [x] 3.3 Toolbar: migrate misc button styles (clear-formatting span, color highlight remove, block-selector btn) to CSS classes
- [x] 3.4 DocumentView: migrate static layout styles on page div, page-content, header, footer to CSS classes. Keep dynamic `width`/`height`/`top`/`left` inline
- [x] 3.5 Page.tsx: migrate `position: relative` inline styles to CSS classes

## Phase 4: Emoji → SVG Icon Migration

- [x] 4.1 Toolbar: replace text-formatting emoji/characters (B/I/U/S/X²/X₂) with Bold/Italic/Underline/Strikethrough/Superscript/Subscript SVG icons
- [x] 4.2 Toolbar: replace action icons (←, 💾, 🔗, ↺, 🖼️, ⊞, PDF badge) with Back/Save/Link/ClearFormatting/Image/Table/Pdf SVG icons
- [x] 4.3 Toolbar: replace alignment div-based icons (`span.align-icon`) with AlignLeft/AlignCenter/AlignRight SVG icons
- [x] 4.4 Toolbar: replace bullet (•) and numbered (1.) list icons with ListUl/ListOl SVG icons
- [x] 4.5 DocumentManager: replace delete ✕ with Delete SVG icon

## Phase 5: Testing & Verification

- [ ] 5.1 Run `make frontend-build` — verify compilation succeeds
- [x] 5.2 Run existing test suite — verify zero behavioral regressions
- [ ] 5.3 Manual visual check: toolbar states, page cards, popups, blocks, doc manager
- [ ] 5.4 Manual keyboard shortcut regression: Ctrl+B/I/U, Ctrl+K, all editing operations
