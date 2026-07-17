# Proposal: UI Modernization

## Intent

Current interface works but looks dated — emoji icons, flat grays, minimal transitions, basic shadows, inline styles throughout. This is a pure visual refresh with zero functionality changes: modernize the word processor aesthetic while keeping every feature, shortcut, and editing behavior identical.

## Scope

### In Scope
- CSS redesign (index.css) — color palette, shadows, borders, page cards, focus/active states
- Emoji toolbar icons → inline SVG icon components (`src/components/icons/`)
- Animation/transition micro-interactions (hover, focus, active, selection)
- Modern page card design (deeper shadows, refined border-radius, paper feel)
- Toolbar visual refinement (spacing, dividers, hover/active states)
- Consolidated design tokens via CSS custom properties
- Selection overlay styling improvements
- Inline `style={}` props → CSS classes (Toolbar popups, DocumentView, Paragraph)

### Out of Scope
- No functionality changes, new features, or component logic
- No editor engine changes (layout, pagination, commands, operations)
- No dark mode (future consideration)
- No backend, API, or store changes
- No React/TypeScript version bumps or new dependencies

## Capabilities

> Pure visual redesign — no behavioral spec changes.

### New Capabilities
- None

### Modified Capabilities
- None

## Approach

1. Refactor index.css: define cohesive design tokens via `:root` custom properties (colors, shadows, radii, spacing, timing)
2. Update color palette: warmer neutrals, deeper accents, better contrast hierarchy
3. Replace emoji toolbar icons with inline SVG icon components
4. Add CSS transitions/animations for hover, focus, active, page entry
5. Refine page card shadows, document manager cards, page ruler
6. Polish selection highlights, blockquote borders, table visuals, resize handles
7. Move inline styles from Toolbar, DocumentView, and Paragraph into CSS classes

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/index.css` | Major rewrite | Design token system, new palette, shadows, animations |
| `frontend/src/components/Toolbar.tsx` | Modified | Emoji → SVG icons; inline styles → CSS classes |
| `frontend/src/components/DocumentView.tsx` | Modified | Inline styles → CSS classes |
| `frontend/src/components/Paragraph.tsx` | Modified | Inline styles → CSS classes |
| `frontend/src/components/Page.tsx` | Modified | Page card styling refinements |
| `frontend/src/components/SelectionOverlay.tsx` | Modified | Selection visual refinement |
| `frontend/src/components/icons/*` | New | SVG icon components for toolbar |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| CSS refactor breaks existing layout | Low | Keep class names stable; test after each change batch |
| SVG icons shift toolbar dimensions | Low | Use consistent viewBox + size; test all font sizes |
| Inline style removal misses dynamic values | Low | Only target static layout styles; leave dynamic JS-driven styles |

## Rollback Plan

Git revert all CSS changes, icon components, and inline-style removals. Since no store or operation logic changes, rollback is zero-risk.

## Dependencies

- None

## Success Criteria

- [ ] Toolbar renders SVG icons instead of emojis — all buttons functional
- [ ] New color palette applied site-wide with no visual regressions
- [ ] Page cards show modern shadows and refined border-radius
- [ ] All transitions feel smooth on hover, focus, and active states
- [ ] No inline styles in Toolbar, DocumentView, or Paragraph render output
- [ ] All existing tests pass (vitest, frontend build)
- [ ] All keyboard shortcuts and editing operations unchanged
- [ ] Visual diff shows cosmetic-only changes
