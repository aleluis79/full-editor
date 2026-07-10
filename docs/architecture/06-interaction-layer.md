# Interaction Layer

## Hit Testing

Via Layout Engine (coordinate mapping), NOT via DOM elementFromPoint.

```typescript
function findPosition(x: number, y: number): LogicalPosition {
  // 1. Find page (y / pageHeight)
  // 2. Find block within page
  // 3. Find line within block
  // 4. Find run and exact offset within line
  return { nodeId, offset };
}
```

## Cursor Movement: Visual

Arrow keys move cursor visually, not by logical character.

```typescript
function nextVisualPosition(
  cursor: CursorPosition,
  direction: 'left' | 'right' | 'up' | 'down'
): CursorPosition {
  // Layout Engine maps visual position to logical position
}
```

## Selection: Anchor + Focus

```typescript
interface Selection {
  anchor: LogicalPosition;  // where selection started
  focus: LogicalPosition;   // where cursor is now
}
```

Visual selection = rects from Layout Engine covering start to end.

Always contiguous (non-contiguous selection deferred to future extension).

## Keyboard Handling

| Key | Operation |
|---|---|
| Printable character | InsertText |
| Backspace | DeleteText (backward) |
| Delete | DeleteText (forward) |
| Enter | SplitBlock |
| Tab | InsertTab / IndentList |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl+C | Copy |
| Ctrl+V | Paste |
| Ctrl+X | Cut |
| Ctrl+B | ToggleMark('bold') |
| Ctrl+I | ToggleMark('italic') |
| Ctrl+U | ToggleMark('underline') |

## Mouse Handling

| Event | Action |
|---|---|
| Click | Position cursor (hit test) |
| Double click | Select word |
| Triple click | Select paragraph |
| Click + drag | Select range |
| Scrollbar click | Navigate page |

Mouse is ONLY input — never touches document directly.

## Input Flow

```
User clicks at (x, y)
  → hitTest(x, y) → LogicalPosition { nodeId, offset }
  → Set cursor to position
  → Layout Engine calculates screen position
  → Renderer draws cursor overlay
```
