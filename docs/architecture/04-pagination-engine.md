# Pagination Engine

## Input

Layout blocks (from Layout Engine) with known heights.

## Output

Pages with distributed blocks.

```typescript
interface Page {
  index: number;
  width: number;
  height: number;
  contentArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  blocks: LayoutBlock[];
  header?: HeaderFooterLayout;
  footer?: HeaderFooterLayout;
  pageNumber: number;
}
```

## Algorithm: Greedy with Look-Ahead

```
for each block:
  if block fits in current page:
    add to current page
  else:
    look-ahead: would moving a previous block to next page reduce whitespace?
    if yes:
      move block to next page
    else:
      create new page, add block there
```

## Paper Sizes

```typescript
const PAPER_SIZES = {
  A4: { width: 210, height: 297 },      // mm
  LETTER: { width: 216, height: 279 },   // mm
  LEGAL: { width: 216, height: 356 },    // mm
  // All converted to pixels at render time
};
```

## Margins

```typescript
interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// Content area = page size - margins - header height - footer height
```

## Headers and Footers

Per-section. Sections inherit from parent if not defined.

```typescript
interface HeaderFooterLayout {
  content: LayoutBlock[];
  height: number;
}
```

## Page Numbering

Calculated after block distribution. Available in header/footer templates as `{pageNumber}`.

## Incremental Pagination

When a block's height changes:
1. Check if current page still fits
2. If not → push overflow to next page
3. If next page overflows → propagate forward
4. Create/remove pages as needed
5. Update page numbers
