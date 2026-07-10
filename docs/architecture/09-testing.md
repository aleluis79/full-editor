# Testing Strategy

## 4 Testing Levels

### Level 1: Unit Tests — Operations (~60%)

Each operation tested in isolation.

```typescript
test('InsertText inserts text at correct position', () => {
  const doc = createDocument([{ type: 'paragraph', children: [
    { type: 'text', content: 'Hello' }
  ]}]);

  const op = new InsertText('p1', 3, 'lo');
  const diff = op.apply(doc);

  expect(doc.getBlock('p1').textContent).toBe('Helolo');
  expect(diff).toEqual({ type: 'insert', path: ['p1', 0], before: 3, after: 'lo' });
});
```

### Level 2: Unit Tests — Layout (~25%)

Each layout strategy tested with fixed constraints.

```typescript
test('ParagraphLayout wraps text correctly', () => {
  const layout = new ParagraphLayout(mockMetrics);
  const result = layout.measure(paragraph, { width: 400, height: Infinity });

  expect(result.lines).toHaveLength(3);
  expect(result.lines[0].width).toBeLessThanOrEqual(400);
});
```

### Level 3: Integration Tests (~10%)

Full pipeline: insert → layout → pagination → verification.

### Level 4: Visual Regression Tests (~5%)

Screenshot comparison against golden files.

## Metrics: Mock for Unit Tests

```typescript
const mockMetrics = {
  measureText: (text: string, font: string) => ({
    width: text.length * 7.2,
    height: 14,
  })
};
```

Real metrics only for visual regression tests.

## Test Runners

- **Vitest**: Unit and integration tests (native Vite, ESM-first)
- **Playwright**: E2E tests (full browser experience)

## Coverage Targets

- Operations: 90%+ (critical path)
- Layout: 80%+
- Integration: 60%+
- E2E: Critical user flows only
