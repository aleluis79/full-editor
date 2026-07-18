# Tasks: Line Spacing Toolbar

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~120–180 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Foundation

- [x] 1.1 Add `lineHeight?: number` to `BlockAttrs` in `frontend/src/core/types.ts`
- [x] 1.2 Reject non-positive `lineHeight` in `setBlockAttrs` at `frontend/src/stores/document-store.ts` (~line 891)
- [x] 1.3 Derive `currentLineHeight` from cursor block's `attrs.lineHeight` in `Toolbar.tsx`

## Phase 2: Layout Engine

- [x] 2.1 In `layoutParagraph` (`engine.ts:153`), override `constraints.lineHeight` with `paragraph.attrs.lineHeight` when set
- [x] 2.2 In `layoutHeading` (`engine.ts:176`), merge `heading.attrs.lineHeight` into `headingConstraints` when set
- [x] 2.3 In `layoutTableCell` (`engine.ts:283`), read per-paragraph `attrs.lineHeight` for cell height calculation

## Phase 3: Rendering

- [x] 3.1 Add `lineHeight: block.attrs?.lineHeight` to the inline style block at `DocumentView.tsx` ~line 633

## Phase 4: Icon

- [x] 4.1 Create `frontend/src/components/icons/LineHeight.tsx` with SVG icon (vertical arrows + lines)
- [x] 4.2 Export `LineHeight` from `frontend/src/components/icons/index.ts`

## Phase 5: Toolbar Popup

- [x] 5.1 Import `LineHeight`, add `showLineSpacing` state + ref + outside-click `useEffect` in `Toolbar.tsx`
- [x] 5.2 Add line spacing button and popup with preset buttons (1.0, 1.15, 1.5, 2.0, 2.5, 3.0) + active-state highlight
- [x] 5.3 Wire preset click handlers: `setBlockAttrs`/`setBlockAttrsRange` for apply, re-click active preset toggles off

## Phase 6: Store History

- [x] 6.1 Update `description` in both `setBlockAttrs` (~line 913) and `setBlockAttrsRange` (~line 967) to describe both `lineHeight` and `textAlign`

## Phase 7: Tests

- [x] 7.1 Test popup opens/closes on button click and outside click closes it
- [x] 7.2 Test preset selection applies `lineHeight` via store and active preset toggles off
- [x] 7.3 Test `lineHeight` inline style is applied in DocumentView when set
