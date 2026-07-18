# Page Layout Specification

## Purpose

Document-level page configuration — paper size, orientation, and margins. Defines how a user controls the physical dimensions and layout of printed/output pages from a popup in the toolbar.

## Requirements

### Requirement: Page Settings Popup

The system MUST provide a settings popup triggered by a gear icon in the toolbar. The popup MUST contain a paper size selector (radio group: A4, Letter, Legal), an orientation toggle (Portrait/Landscape), and four margin inputs (top, right, bottom, left) in points.

#### Scenario: Open popup from toolbar

- GIVEN the document is open and the toolbar is rendered
- WHEN the user clicks the gear icon
- THEN a popup overlay appears with paper size, orientation, and margin controls
- AND the current document values are pre-selected in each control

#### Scenario: Paper size selection

- GIVEN the settings popup is open
- WHEN the user selects "Legal" from the paper size radio group
- THEN `PaginationConfig.paperSize` is updated to `{ width: 612, height: 1008 }` (8.5 × 14 in points)

#### Scenario: Invalid margin values are clamped

- GIVEN the settings popup is open with a margin input focused
- WHEN the user enters a negative value for "Top"
- THEN the value is clamped to 0 on blur
- AND `PaginationConfig.margins.top` is stored as 0

### Requirement: Orientation

The system MUST support `'portrait'` and `'landscape'` orientation. Switching to landscape MUST swap the logical width and height derived from the paper size.

#### Scenario: Toggle to landscape

- GIVEN the document uses A4 portrait (595 × 842 points)
- WHEN the user toggles orientation to Landscape
- THEN the effective page dimensions become 842 × 595 points (width × height)
- AND `PaginationConfig.orientation` is `'landscape'`

#### Scenario: Default orientation

- GIVEN a document was created before orientation was supported (no `orientation` in saved config)
- WHEN the document is loaded
- THEN `PaginationConfig.orientation` MUST default to `'portrait'`

### Requirement: Margin Configuration

The system MUST support independent top, right, bottom, and left margin values configured through the popup. All margins SHALL be expressed in points (1 pt = 1/72 inch).

#### Scenario: Set custom margins

- GIVEN the settings popup is open
- WHEN the user sets Left to 144, Right to 72, Top to 96, Bottom to 96
- THEN `PaginationConfig.margins` is `{ top: 96, right: 72, bottom: 96, left: 144 }`

#### Scenario: Default margins

- GIVEN a document without margins in saved config
- WHEN the document is loaded
- THEN all margins MUST default to 96pt (1 inch)

#### Scenario: Margins preserve on orientation switch

- GIVEN margins are set to `{ top: 72, right: 96, bottom: 72, left: 96 }` in portrait
- WHEN the user toggles to landscape
- THEN the margin values MUST remain unchanged

### Requirement: Document Persistence

The system MUST save `paperSize`, `orientation`, and `margins` to `content.config` when the document is saved, and restore them on document load.

#### Scenario: Save and restore all layout settings

- GIVEN the user sets A4 paper, landscape orientation, and 72pt margins
- WHEN the document is saved and reloaded
- THEN `content.config` contains `paperSize: { width: 595, height: 842 }`, `orientation: "landscape"`, and `margins: { top: 72, right: 72, bottom: 72, left: 72 }`
- AND the page layout popup shows these values on reload

### Requirement: PDF Export

The system MUST pass `paper_size`, `orientation`, and `margins` to the PDF export endpoint. The backend MUST render the PDF using the requested paper size and orientation, applying the specified margins.

#### Scenario: Export landscape PDF

- GIVEN the document is set to Letter landscape (width: 792, height: 612, orientation: `'landscape'`)
- WHEN the user exports to PDF
- THEN `ExportPDFData` includes `paper_size: "Letter"`, `orientation: "landscape"`, and `margins` as specified
- AND the backend calls `reportlab.lib.pagesizes.landscape(letter)` before rendering

#### Scenario: Missing orientation in export request

- GIVEN the export request omits `orientation`
- THEN the backend MUST default to `'portrait'`
- AND render the PDF in portrait orientation
