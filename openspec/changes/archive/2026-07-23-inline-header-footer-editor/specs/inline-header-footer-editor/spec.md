# Inline Header/Footer Editor Specification

## Purpose

Contract for inline WYSIWYG editing of header/footer content on page surface with rich marks, tokens, and contextual toolbar.

## Requirements

### Requirement: Inline Editing Zones

System MUST render clickable header/footer zones on each page. Active zones MUST show dashed borders and occupy configured height.

#### Scenario: Zones visible/hidden

- GIVEN header/footer enabled/disabled
- WHEN document displayed
- THEN zones render/hide accordingly within configured heights

### Requirement: Click-to-Edit Activation

System MUST activate editing on zone click. Only one editor (header OR footer) SHALL be active. Cursor MUST be at click position.

#### Scenario: Activate/switch/exit

- GIVEN document with zones
- WHEN user clicks header, then footer, then outside
- THEN editing follows: header→footer→exit, `editingHeaderFooter` updates accordingly

### Requirement: Rich Text Marks

System MUST support bold, italic, underline, strikethrough. Marks MUST be stored as `TextRun[]` and render visually.

#### Scenario: Apply/toggle marks

- GIVEN text selected
- WHEN user triggers bold
- THEN text renders bold, `TextRun` has `bold: true`
- AND toggling again removes mark

### Requirement: Contextual Toolbar

System MUST display toolbar when zone active with mark toggles and token buttons. Toolbar MUST reflect cursor marks.

#### Scenario: Toolbar lifecycle

- GIVEN zone clicked
- WHEN toolbar displayed
- THEN shows toggles/tokens, reflects cursor marks
- AND disappears on exit

### Requirement: Token Insertion

System MUST insert tokens (`{pageNumber}`, `{totalPages}`, `{date}`, `{time}`) at cursor. Tokens MUST resolve in preview and PDF.

#### Scenario: Insert/resolve tokens

- GIVEN footer editor active
- WHEN user inserts `{pageNumber}`
- THEN token inserted at cursor, preview shows resolved value
- AND unknown tokens display as literals

### Requirement: Real-time Preview

System MUST render marks and tokens in real-time. Preview MUST match PDF output.

#### Scenario: Immediate rendering

- GIVEN user applies mark or inserts token
- WHEN editing
- THEN changes display immediately

### Requirement: Focus Management

Only one editor (main OR header/footer) MUST be active. Escape MUST exit to main. Keyboard MUST route to active editor.

#### Scenario: Focus routing

- GIVEN header editor active
- WHEN Escape pressed or user types
- THEN Escape exits to main, typing goes to header

### Requirement: Popup Cleanup

System MUST remove header/footer text inputs from `PageSettingsPopup`. Config controls MUST remain.

#### Scenario: Popup cleaned

- GIVEN PageSettingsPopup opened
- WHEN displayed
- THEN no text inputs, config controls remain
