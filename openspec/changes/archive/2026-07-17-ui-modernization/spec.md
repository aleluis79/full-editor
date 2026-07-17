# Delta: UI Modernization — Visual Design Spec

## Purpose

Pure visual refresh of the word processor. No behavioral, feature, keyboard, or editing changes. All modifications target CSS and visual rendering only.

## 1. Design Token System

The `:root` block in `index.css` MUST define these token categories as CSS custom properties.

| Token Category | Required Variables | Purpose |
|----------------|--------------------|---------|
| **Colors** | `--color-bg`, `--color-surface`, `--color-text`, `--color-text-secondary`, `--color-border`, `--color-accent`, `--color-accent-hover`, `--color-danger`, `--color-danger-bg` | Warm neutral palette (not flat grays), distinct accent for interactive elements |
| **Shadows** | `--shadow-sm`, `--shadow-md`, `--shadow-lg` | Page cards, popovers, floating elements |
| **Radii** | `--radius-sm`, `--radius-md`, `--radius-lg` | Toolbar (md), page (sm/md), buttons (sm), popups (lg) |
| **Spacing** | `--space-1` through `--space-6` (4px base) | Consistent gaps, paddings, margins |
| **Transitions** | `--transition-fast`, `--transition-normal` | Duration + easing pairs for hover/focus/active |
| **UI Font** | `--font-ui` | System font stack for toolbar, labels, manager |

## 2. Toolbar Visual Specs

| # | Requirement | Strength |
|---|-------------|----------|
| T1 | All emoji/character toolbar icons MUST be replaced with SVG icon components in `src/components/icons/` | MUST |
| T2 | Each SVG icon MUST use a consistent `viewBox="0 0 24 24"` and accept a `className` prop | MUST |
| T3 | All static `style={{}}` props in Toolbar popups (link, block picker, color) MUST be moved to CSS classes | MUST |
| T4 | `position: relative` on link and table button groups MAY remain inline (layout-critical) | MAY |
| T5 | Dynamic styles driven by state (`color` picker, `fontFamily` select) SHALL remain inline | SHALL |
| T6 | Toolbar buttons MUST show 4 distinct states: default, hover, active, disabled, active-toggle | MUST |

### Scenario: SVG icon renders without emoji fallback
- GIVEN Toolbar component renders
- WHEN inspecting any toolbar button
- THEN the button contains an SVG element inside, not an emoji or character icon

### Scenario: Popup inline styles migrated to classes
- GIVEN link popup is open
- WHEN inspecting `<div className="link-popup">`
- THEN all positioning, background, border, padding, and shadow come from `.link-popup` CSS, not `style={{}}`

### Scenario: Active toggle button visual
- GIVEN user clicks Bold button
- WHEN button enters `toolbar-btn-active` state
- THEN background MUST be accent-colored, border MUST be accent-colored, text MUST be accent-colored

## 3. Page / Document Visual Specs

| # | Requirement | Strength |
|---|-------------|----------|
| P1 | Page cards MUST use `--shadow-md` (deeper than current `0 2px 8px`) | MUST |
| P2 | Page border-radius MUST change from `2px` to `--radius-md` | MUST |
| P3 | Page background MUST remain `--color-page` (white) | MUST |
| P4 | `marginBottom: 20` on page divs SHALL remain inline (dynamic, JS-driven) | SHALL |
| P5 | Page ruler SHALL use token colors for tick marks, labels, and margins | SHALL |

### Scenario: Page card visual refresh
- GIVEN document view renders pages
- WHEN inspecting a `.page` div
- THEN `box-shadow` uses `--shadow-md`, `border-radius` uses `--radius-md`

## 4. Block Visual Specs

| # | Requirement | Strength |
|---|-------------|----------|
| B1 | Paragraph hover/active backgrounds MUST use token accent color at 3%/5% opacity | MUST |
| B2 | Heading scale (H1/H2/H3) MUST use a refined typography palette with `--color-text` | MUST |
| B3 | Blockquote MUST use accent-color left border, subtle tinted background | MUST |
| B4 | Horizontal rule MUST use `--color-border` instead of hardcoded `#ccc` | MUST |
| B5 | Image block active border, resize handles MUST use accent token | MUST |
| B6 | Table borders, header bg, cell active bg MUST use token colors | MUST |
| B7 | Selected table outline MUST use accent token | MUST |

### Scenario: Blockquote uses tokens
- GIVEN a blockquote block renders
- WHEN inspecting `.blockquote-block`
- THEN `border-left-color` uses `--color-accent`, `background` uses a tint of accent

## 5. Document Manager Visual Specs

| # | Requirement | Strength |
|---|-------------|----------|
| D1 | Doc cards MUST use `--shadow-sm` resting, `--shadow-md` on hover | MUST |
| D2 | New document button MUST use `--color-accent` background, `--color-accent-hover` on hover | MUST |
| D3 | Delete button MUST use `--color-danger` text on hover, `--color-danger-bg` background | MUST |
| D4 | Empty state MUST use `--color-text-secondary` for text | MUST |
| D5 | Error state MUST use `--color-danger` for border and text, `--color-danger-bg` for background | MUST |

## 6. List Visual Specs

| # | Requirement | Strength |
|---|-------------|----------|
| L1 | Bullet markers and numbered prefixes MUST use `--color-text-secondary` | MUST |
| L2 | List item indentation MUST use `--space-6` as base padding | MUST |
| L3 | List nested levels SHOULD increase indent by `--space-4` per level | SHOULD |

## 7. Selection and Cursor Visuals

| # | Requirement | Strength |
|---|-------------|----------|
| S1 | Cursor blink animation duration MUST remain `1.06s`, easing `step-end` | MUST |
| S2 | Selection highlight color `--color-selection` MUST be an accent-tinted transparent blue | MUST |
| S3 | Multi-block selection overlay SHALL use the same `--color-selection` background | SHALL |

## 8. Animation & Transition Specs

| Requirement | Strength |
|-------------|----------|
| All color/bg changes (hover, focus, active) MUST use `--transition-fast` (`.15s ease`) | MUST |
| All shadow changes (page hover, card hover) MUST use `--transition-normal` (`.2s ease`) | MUST |
| Page entry animation MAY fade in with `opacity 0→1` over `--transition-normal` | MAY |

## 9. Inline Style Migration — Classification

| Category | Examples | Action |
|----------|----------|--------|
| **Static layout** | popup borders, padding, background, box-shadow | MUST move to CSS class |
| **Static positioning** | `position: absolute`, `top: 100%`, `left: 0`, `zIndex: 1000` | MUST move to CSS class |
| **Dynamic JS-driven** | `top: layout.y`, `left: cursorRect.x`, `textAlign: block.attrs.textAlign` | SHALL remain inline |
| **State-driven styling** | `color: effectiveAttrs.color`, `fontFamily: run.attrs.fontFamily` | SHALL remain inline |
| **Layout-critical** | `position: relative` on container of absolutely-positioned children | MAY remain inline |

## Requirements Summary

| Domain | Added | Modified | Removed |
|--------|-------|----------|---------|
| Visual Design | 9 token categories, 20+ new CSS classes | All existing CSS vars, all button icons | All inline styles (except dynamic) |
