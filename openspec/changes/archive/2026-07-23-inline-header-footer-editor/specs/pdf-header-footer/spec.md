# Delta for PDF Header/Footer

## MODIFIED Requirements

### Requirement: Rendering

System MUST render header/footer at page top/bottom using ReportLab `onPage`. System MUST render styled runs (bold, italic, underline, strikethrough) in preview and PDF. Each `TextRun` with marks SHALL use corresponding font style.

(Previously: Rendering only supported plain text without marks.)

#### Scenario: Render with marks

- GIVEN header with styled runs
- WHEN PDF generated or preview displayed
- THEN marks render correctly, preview matches PDF

#### Scenario: Empty/plain runs

- GIVEN header runs empty or plain text
- WHEN PDF generated
- THEN renders as before (backward compatible)
