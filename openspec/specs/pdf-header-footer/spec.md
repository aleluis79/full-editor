# PDF Header/Footer Specification

## Purpose

Contract for rendering configurable headers/footers in exported PDFs, including dynamic tokens, page-scoping, and margin adjustment.

## Requirements

### Requirement: Data Transmission

The system MUST transmit `header_footer` config (runs, scope, `firstPageDifferent`, heights in pt) from `ExportPDFData` to the backend. The backend `ExportRequest` SHALL accept `header_footer` as optional.

#### Scenario: Config present

- GIVEN header/footer configured in the UI
- WHEN PDF export is triggered
- THEN payload includes `header_footer` and backend accepts it

#### Scenario: Config absent

- GIVEN no header/footer configured
- WHEN PDF export is triggered
- THEN `header_footer` is null/omitted; export proceeds without it

### Requirement: Rendering

The system MUST render header at top and footer at bottom of each applicable page using ReportLab `onPage` callback. The system MUST render styled runs (bold, italic, underline, strikethrough) in preview and PDF. Each `TextRun` with marks SHALL use corresponding font style.

_(Previously: Rendering only supported plain text without marks.)_

#### Scenario: Rendered on applicable pages

- GIVEN header runs ["Report Title"], footer runs ["Confidential"], scope "all"
- WHEN PDF is generated
- THEN every page shows header and footer

#### Scenario: Empty runs

- GIVEN header runs are empty
- WHEN PDF is generated
- THEN no header drawn; footer still renders if configured

#### Scenario: Render with marks

- GIVEN header with styled runs
- WHEN PDF generated or preview displayed
- THEN marks render correctly, preview matches PDF

#### Scenario: Empty/plain runs

- GIVEN header runs empty or plain text
- WHEN PDF generated
- THEN renders as before (backward compatible)

### Requirement: Page Scope

The system MUST support: `all`, `exceptFirst` (skip page 1), `firstOnly` (page 1 only).

#### Scenario: exceptFirst skips page 1

- GIVEN scope `exceptFirst`, header ["Title"]
- WHEN 3-page PDF generated
- THEN pages 2-3 show "Title"; page 1 does not

#### Scenario: firstOnly renders page 1 only

- GIVEN scope `firstOnly`, footer ["Draft"]
- WHEN 3-page PDF generated
- THEN only page 1 shows "Draft"

### Requirement: firstPageDifferent

When `true`, the system MUST omit header/footer on page 1 regardless of scope.

#### Scenario: Enabled

- GIVEN `firstPageDifferent: true`, scope "all", header ["Title"]
- WHEN 3-page PDF generated
- THEN page 1 has no header; pages 2-3 display it

#### Scenario: Disabled

- GIVEN `firstPageDifferent: false`, scope "all"
- WHEN 3-page PDF generated
- THEN all pages display the header

### Requirement: Dynamic Functions

The system MUST resolve `{pageNumber}`, `{totalPages}`, `{date}`, `{time}` in run content. Unknown tokens MUST be preserved as literals. `{totalPages}` requires two-pass build.

#### Scenario: Page tokens

- GIVEN footer "Page {pageNumber} of {totalPages}"
- WHEN 5-page PDF generated
- THEN page 1→"Page 1 of 5", page 3→"Page 3 of 5", page 5→"Page 5 of 5"

#### Scenario: Date/time tokens

- GIVEN header "Exported {date} at {time}"
- WHEN generated on 2026-07-23 14:30
- THEN header shows "Exported 2026-07-23 at 14:30" (format MAY vary)

#### Scenario: Unknown token

- GIVEN header "Version {version}"
- WHEN generated
- THEN displays "Version {version}" unchanged

### Requirement: Margin Adjustment

When active, system MUST add header height to `topMargin` and footer height to `bottomMargin`. Heights MUST NOT exceed half the page height.

#### Scenario: Margins expanded

- GIVEN header 30pt, footer 20pt
- WHEN PDF generated
- THEN topMargin +30pt, bottomMargin +20pt; no content overlap

#### Scenario: Zero height

- GIVEN header height 0pt
- WHEN PDF generated
- THEN topMargin unchanged

#### Scenario: Excessive height

- GIVEN header height > half page height
- WHEN PDF generated
- THEN system SHOULD clamp to safe limit and log warning

### Requirement: Backward Compatibility

The system MUST produce identical output when `header_footer` is null vs. feature not present.

#### Scenario: Null config

- GIVEN `header_footer` is null
- WHEN PDF generated
- THEN output is byte-equivalent to pre-feature exports
