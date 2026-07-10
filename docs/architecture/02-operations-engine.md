# Operations Engine + History Engine

## Operation Types

Atomic operations:
- `InsertText(nodeId, offset, text)`
- `DeleteText(nodeId, offset, direction)`
- `SplitBlock(nodeId, offset)`
- `MergeBlocks(nodeId, nextNodeId)`
- `ApplyMark(nodeId, start, end, mark)`
- `RemoveMark(nodeId, start, end, mark)`
- `InsertBlock(afterNodeId, type, content)`
- `DeleteBlock(nodeId)`
- `MoveBlock(nodeId, afterNodeId)`

Compound operations (list of atomics):
- `Paste(content)` → InsertText + SplitBlock + ApplyMark
- `FormatBlock(type)` → InsertBlock + DeleteBlock + ApplyMark
- `Cut(range)` → Copy + DeleteText

## Diff Structure

```typescript
interface Diff {
  type: string;
  path: string[];    // route to affected node
  before: any;       // value before mutation
  after: any;        // value after mutation
}
```

Each atomic operation applies the mutation AND returns a Diff.

## History Stack

```typescript
interface HistoryEntry {
  id: string;
  timestamp: number;
  diffs: Diff[];         // flattened diffs (compound = multiple atomics)
  metadata?: {
    source: "keyboard" | "clipboard" | "formatting";
    userIntent?: string;
  };
}
```

- Undo stack + Redo stack
- New operation empties the redo stack
- Configurable limit (500 entries or 10MB of diffs)

## Batch by Input Session

Keystrokes are grouped into one operation while the user keeps typing in the same node.

Rules:
- Same node + continuous input = same operation
- Click elsewhere = new session
- Paste = separate operation
- Formatting change = separate operation

## Undo Flow

```
User presses Ctrl+Z
  → Pop last HistoryEntry from undo stack
  → For each Diff in entry (reversed):
    - Apply diff.before to the document
  → Push entry to redo stack
  → Re-layout affected blocks
  → Re-paginate if needed
  → Update cursor position
```
