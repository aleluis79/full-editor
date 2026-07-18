# Block Line-Height Specification

## Purpose

Per-block line height control via `BlockAttrs.lineHeight`, toolbar popup UI, and layout engine integration — following the text alignment pattern.

## Requirements

### Requirement: Block Line-Height Attribute

`BlockAttrs` MUST support an optional `lineHeight` field of type `number` with positive float values. When absent, the layout engine default applies.

#### Scenario: Setting lineHeight stores the value

- GIVEN a block with no explicit lineHeight
- WHEN `setBlockAttrs({ lineHeight: 2.0 })` is called
- THEN the block's attrs contain `lineHeight: 2.0`

#### Scenario: Non-positive values rejected

- GIVEN a block
- WHEN `setBlockAttrs({ lineHeight: 0 })` is called
- THEN the operation MUST NOT update attrs

### Requirement: Toolbar Line Spacing Popup

The toolbar MUST have a button opening a popup with preset values 1.0, 1.15, 1.5, 2.0, 2.5, 3.0. The popup MUST show no active indicator when the current block lacks explicit lineHeight. Clicking a preset applies it; clicking the active preset again removes it. The popup MUST close on outside click and after selection.

#### Scenario: Selecting a preset applies lineHeight

- GIVEN a block with no explicit lineHeight
- WHEN the user opens the popup and clicks "2.0"
- THEN the block receives `lineHeight: 2.0`
- AND the popup closes

#### Scenario: Active preset toggles off

- GIVEN a block with `lineHeight: 1.5`
- WHEN the user clicks the active 1.5 preset
- THEN lineHeight is removed from the block's attrs
- AND the popup closes

#### Scenario: Outside click closes popup

- GIVEN the popup is open
- WHEN the user clicks outside it
- THEN the popup closes with no change

### Requirement: Per-Block Rendering

The document view MUST apply the block's lineHeight as inline CSS `line-height`. The layout engine MUST use the block's lineHeight for layout calculations when set.

#### Scenario: Inline style applied

- GIVEN a block with `lineHeight: 2.0`
- WHEN the document view renders the block
- THEN the element has `style.lineHeight` set to `"2.0"`

#### Scenario: Default when lineHeight absent

- GIVEN a block with no lineHeight
- WHEN the document view renders the block
- THEN no inline lineHeight style is applied
- AND the layout engine uses its default line height

### Requirement: Multi-Block Selection

Applying lineHeight to a multi-block selection MUST affect all selected blocks via `setBlockAttrsRange`.

#### Scenario: Line height applied to all selected blocks

- GIVEN three adjacent paragraphs selected
- WHEN the user selects preset 1.5
- THEN all three blocks receive `lineHeight: 1.5`

### Requirement: History and Undo

Setting lineHeight MUST create an undoable history entry. The history description SHOULD distinguish lineHeight changes from textAlign changes.

#### Scenario: Undo reverts lineHeight

- GIVEN a block with no lineHeight
- WHEN the user selects preset 2.0 and triggers undo
- THEN the block's lineHeight is removed

#### Scenario: History description is distinct

- GIVEN a block
- WHEN the user sets lineHeight to 1.5
- THEN the history entry description includes "line height" (e.g., "Set line height to 1.5")
