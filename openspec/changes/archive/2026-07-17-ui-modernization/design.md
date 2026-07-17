# Design: UI Modernization

## Technical Approach

Pure CSS-and-component visual refresh: restructure `index.css` into a token-driven system via `:root` custom properties, replace emoji toolbar icons with inline SVG icon components, and migrate static inline `style={{}}` props to CSS classes. Zero functionality or behavioral changes — every feature, shortcut, and editing operation stays identical.

## Architecture Decisions

### Decision: Token System → CSS Custom Properties

Avoids new deps (CSS-in-JS, Sass). Custom properties cascade natively, work in DevTools, and compose at runtime. No dark mode planned, so runtime theming isn't needed.

### Decision: Icon Approach → Hand-written Inline SVGs

No external icon library (Heroicons/Lucide would add 25+ kB). 22 small SVGs, tree-shake naturally, zero deps. Each wraps a shared `Icon` base component with `viewBox="0 0 24 24"`.

### Decision: Inline Style Scope

Static layout props (border, padding, bg, shadow, absolute positioning) → CSS class. Dynamic props (`top: layout.y`, `color: effectiveAttrs.color`, `fontFamily: run.fontFamily`) → stay inline. Layout-critical `position: relative` on absolutely-positioned parents may stay.

## Data Flow

No data flow changes. The rendering pipeline (State → Operations → Layout → Render) is untouched. CSS cascades normally; SVG icons replace emoji text nodes at the same DOM position.

```
[CSS custom properties :root]
  └── CSS cascade → .toolbar, .page, .paragraph, etc.
                      └── inline style overrides (dynamic only)

[Icon component] → renders <svg> instead of emoji/text
  Class name ────→ CSS applies sizing/color via currentColor
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/index.css` | Rewrite | Token system, new palette, animations, reorganized sections |
| `frontend/src/components/icons/index.ts` | Create | Re-exports all icon components |
| `frontend/src/components/icons/Icon.tsx` | Create | Base `Icon` wrapper: `viewBox="0 0 24 24"`, `className?`, `size?` |
| `frontend/src/components/icons/{Bold,Italic,Underline,Strikethrough,Superscript,Subscript,Link,Image,Table,ListUl,ListOl,AlignLeft,AlignCenter,AlignRight,ClearFormatting,Save,Pdf,Back,Plus,Delete,ColorPicker,HighlightPicker}.tsx` | Create (22 files) | One SVG icon per toolbar button |
| `frontend/src/components/Toolbar.tsx` | Modify | Emoji → SVG icons; inline styles → CSS classes; clear formatting span → icon |
| `frontend/src/components/DocumentView.tsx` | Modify | Inline styles on PageRenderer divs → CSS classes (static props only) |
| `frontend/src/components/Paragraph.tsx` | Modify | Inline styles on cursor span → CSS classes |
| `frontend/src/components/Page.tsx` | Modify | Inline styles on page divs → CSS classes (static props only) |
| `frontend/src/components/SelectionOverlay.tsx` | Modify | Inline styles → CSS classes |

## Interfaces / Contracts

### Icon Component Pattern

```tsx
// Base wrapper
interface IconProps {
  className?: string;
  size?: number;  // width=height, default 24
}

// Each icon component:
// export function Bold({ className, size = 24 }: IconProps) { ... }
// uses: <Icon className={className} size={size}><path d="..."/></Icon>
```

See spec §1 for full token table. Key additions to `:root`: `--color-bg: #f3f4f6`, `--color-surface`, `--color-text-secondary: #6b7280`, `--color-accent: #2563eb`, `--shadow-sm/md/lg`, `--radius-sm/md/lg`, `--space-1` through `--space-6` (4px base), `--transition-fast/normal`, `--font-ui`. Existing vars (`--page-width`, `--page-height`, `--page-margin`, `--color-page`, `--color-cursor`, `--color-selection`, `--color-active-border`) preserved unchanged.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Build | Compilation succeeds | `make frontend-build` |
| Unit | Icon components render correct SVG | Vitest: snapshot each icon at default size |
| Visual | No visual regressions | Manual review per component: toolbar, page, doc-manager |
| Functional | All toolbar buttons still trigger correct operations | Existing test suite — no behavioral changes expected |
| Keyboard | All shortcuts still functional | Manual regression: Ctrl+B, Ctrl+I, etc. |

## Migration / Rollout

No migration required. Single commit changes CSS, components, and icon files. Rollback is `git revert` — zero risk since no store or operation logic changes.

## Open Questions

None — spec, tokens, and migration plan are fully defined.
