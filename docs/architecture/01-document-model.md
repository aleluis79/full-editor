# Document Model

## Structure

Deep tree with sections. Each node has unique ID, type, attributes, styles, children, metadata.

```
Document
├── Section
│   ├── Heading
│   ├── Paragraph
│   ├── Table
│   ├── Image
│   └── List
```

## Text Representation: Runs

Text is represented as a tree of inline nodes (runs), not flat text with mark ranges.

```typescript
// Each paragraph contains children (runs)
{
  id: "p1",
  type: "paragraph",
  children: [
    { type: "text", content: "Hello " },
    { type: "text", content: "bold", marks: ["bold"] },
    { type: "text", content: " world" }
  ]
}
```

**Why runs over flat text + mark ranges:**
- Inserting a character only affects ONE run
- Styles attach to content, not fragile offsets
- Natural for inline elements (images, formulas)
- This is the model Word, Google Docs, and ProseMirror use

## Node Interface

```typescript
interface DocumentNode {
  id: string;              // UUID v7 or timestamp-based
  type: string;            // 'document' | 'section' | 'paragraph' | 'heading' | 'text' | ...
  children?: DocumentNode[];
  marks?: string[];        // ['bold', 'italic', 'underline', ...]
  attrs?: Record<string, any>;
  content?: string;        // text content for text nodes
}
```

## Mutability: Mutable + Operations Pattern

Mutable model for performance. Operations produce diffs for history.

```typescript
interface Operation {
  type: string;
  apply(doc: Document): Diff;  // mutates doc, returns diff
}

interface Diff {
  type: string;
  path: string[];  // path to affected node
  before: any;     // value before
  after: any;      // value after
}
```

Undo = mechanical diff revert (apply `before` instead of `after`).

## Sections

Sections can nest. Each section can define its own header/footer. Sections inherit from parent if not defined.

```typescript
{
  id: "s1",
  type: "section",
  attrs: { header: {...}, footer: {...} },
  children: [
    { type: "heading", content: "Chapter 1", attrs: { level: 1 } },
    { type: "paragraph", children: [...] }
  ]
}
```
