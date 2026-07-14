# External Links Specification

## Purpose

Allow users to add clickable hyperlinks to document text. Links are stored as an `href` attribute on `TextRun` runs with a `'link'` mark. The feature spans types, operations, rendering, layout, toolbar, keyboard, and PDF export.

## Requirements

### Requirement: Core Types — href on TextRun

The `MarkType` union MUST include `'link'`. The `TextRun` interface MUST have an optional `href?: string` field. The `createTextRun` helper in `document.ts` MUST accept and forward `href`.

#### Scenario: TextRun with link mark and href

- GIVEN a TextRun with `marks: ['link']` and `href: 'https://example.com'`
- WHEN the run is serialized or traversed
- THEN the href field is preserved alongside other marks

#### Scenario: TextRun without link

- GIVEN a TextRun created without href
- THEN `href` is undefined
- AND the run renders as plain text

### Requirement: SetLinkOp and RemoveLinkOp

The system MUST provide `SetLinkOp` (sets `href` on a range) and `RemoveLinkOp` (removes `href` from a range). Both MUST reuse `splitRunsAtRange` from operations.ts, the same splitting mechanism used by `ToggleMarkOp`.

#### Scenario: Set link on selected text

- GIVEN a paragraph with runs spanning offsets 0-10
- WHEN SetLinkOp is applied with range 3-7 and href "https://example.com"
- THEN the run(s) covering offsets 3-7 are split at boundaries
- AND those runs get `marks: ['link']` and `href: 'https://example.com'`

#### Scenario: Remove link from linked text

- GIVEN a paragraph with a run that has `marks: ['link']` and `href: 'https://example.com'`
- WHEN RemoveLinkOp is applied over the linked range
- THEN the `href` is removed from the affected runs
- AND `'link'` is removed from marks
- AND the text content is unchanged

### Requirement: Toolbar and Keyboard Shortcut

The toolbar MUST include a link button. When clicked with selected text, it MUST show a URL popup dialog (input + OK/Cancel). `Ctrl+K` MUST also trigger the URL popup when text is selected. When cursor is inside a link without selection, `Ctrl+K` or the toolbar button MUST remove the link.

#### Scenario: Add link via toolbar button

- GIVEN the user has selected text in the editor
- WHEN the user clicks the toolbar link button and enters "https://example.com" and presses OK
- THEN a SetLinkOp is applied with that href

#### Scenario: Add link via Ctrl+K

- GIVEN the user has selected text
- WHEN the user presses Ctrl+K and enters a URL
- THEN a SetLinkOp is applied with that href

#### Scenario: Remove link via Ctrl+K on linked text

- GIVEN the cursor is inside linked text with no selection
- WHEN the user presses Ctrl+K
- THEN a RemoveLinkOp is applied for the link run's range
- AND the link is removed

### Requirement: Rendering as Anchor Element

`TextRun.tsx` MUST render a run with `marks: ['link']` and `href` as an `<a>` element with `href={href}`. The link MUST be styled blue and underlined. Other marks (bold, italic) MUST still apply inside the anchor.

#### Scenario: Render linked run as anchor

- GIVEN a TextRun with `marks: ['link']` and `href: 'https://example.com'`
- WHEN TextRun.tsx renders
- THEN it renders `<a href="https://example.com" style="color: blue; text-decoration: underline;">` wrapping the content

#### Scenario: Combined marks with link

- GIVEN a TextRun with `marks: ['bold', 'link']` and `href: 'https://x.com'`
- WHEN TextRun.tsx renders
- THEN it renders `<a href="..." style="...">` with `fontWeight: 'bold'`

### Requirement: Layout and PDF Export

`PositionedRun` in layout types MUST include `href?: string`. The layout engine MUST propagate `href` from TextRun to PositionedRun. `_extract_text` in `pdf_export.py` MUST generate `<a href="...">` markup when a text run has `href`.

#### Scenario: href propagates through layout

- GIVEN a TextRun with `href: 'https://example.com'`
- WHEN the layout engine processes the block
- THEN the resulting PositionedRun for that text includes `href: 'https://example.com'`

#### Scenario: PDF export renders clickable link

- GIVEN a paragraph containing a run with `href: 'https://example.com'`
- WHEN `_extract_text` processes the run
- THEN the returned string contains `<a href="https://example.com">content</a>`

### Requirement: Edge Cases

The system MUST handle these boundary conditions gracefully.

#### Scenario: Empty URL is rejected

- GIVEN the user entered an empty or whitespace-only URL in the dialog
- WHEN the user presses OK
- THEN no operation is applied
- AND the dialog closes without modifying the document

#### Scenario: Empty selection does not trigger SetLinkOp

- GIVEN the cursor is at a position with no selection (anchor === focus)
- WHEN the user clicks the link button or presses Ctrl+K
- THEN no SetLinkOp is created
- AND if the cursor is not inside a link, nothing happens

#### Scenario: Remove link on partial selection within a linked run

- GIVEN linked text "hello world" with a single link
- WHEN the user selects only "world" and triggers link removal
- THEN only the "world" portion is unlinked (run is split)
- AND "hello " remains linked
