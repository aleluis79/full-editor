# Design: PDF Headers & Footers

## Technical Approach

Bridge the gap between frontend rendering (already working in `DocumentView.tsx` + `PaginationEngine`) and backend PDF export. Pass `header_footer` config through the export pipeline, render via ReportLab's `onPage` callback, resolve dynamic tokens with two-pass build for `{totalPages}`, and adjust margins to prevent content overlap.

## Architecture Decisions

### Decision: Token Resolution Strategy

**Choice**: Two-pass `doc.build()` with `afterFlowable` callback to capture total page count, then regex replacement for all tokens.

**Alternatives considered**:
- Single-pass with placeholder: ReportLab doesn't expose page count until after build completes
- Pre-calculate page count: Impossible without knowing content layout
- Use ReportLab's `PageCount` flowable: Only works for simple cases, not custom callbacks

**Rationale**: Two-pass is the standard ReportLab pattern for `{totalPages}`. First pass counts pages, second pass substitutes the value. Performance impact is acceptable (2x build time) and only triggers when `{totalPages}` token is present.

### Decision: Margin Adjustment Location

**Choice**: Adjust `topMargin` and `bottomMargin` in `SimpleDocTemplate` constructor based on `header.height` and `footer.height` when `enabled: true`.

**Alternatives considered**:
- Draw header/footer outside margins: Causes overlap with content
- Use `Frame` with custom bounds: Overly complex for this use case
- Manual Y-offset in callback: Fragile, breaks with ReportLab internals

**Rationale**: ReportLab's margin system is designed for this. Increasing margins reserves space; `onPage` callback draws within that reserved area. Matches frontend `PaginationEngine` behavior exactly.

### Decision: Scope vs firstPageDifferent Interaction

**Choice**: `firstPageDifferent: true` takes precedence over scope. If enabled, page 1 never shows header/footer regardless of scope value.

**Alternatives considered**:
- Combine scope and firstPageDifferent with AND logic: Confusing semantics
- Ignore firstPageDifferent when scope is `firstOnly`: Breaks user expectations

**Rationale**: `firstPageDifferent` is an explicit "skip first page" flag. Scope defines which pages to render on (all, except first, first only). When both are present, the explicit skip wins. This matches the spec requirement: "When `true`, the system MUST omit header/footer on page 1 regardless of scope."

### Decision: Token Parsing Approach

**Choice**: Regex-based token replacement: `\{(pageNumber|totalPages|date|time)\}`. Unknown tokens preserved as literals.

**Alternatives considered**:
- Custom parser with AST: Over-engineered for 4 tokens
- String interpolation: Doesn't handle unknown tokens gracefully
- ReportLab's built-in page numbering: Only handles page numbers, not date/time

**Rationale**: Simple regex is fast, testable, and matches the spec requirement to preserve unknown tokens. Date/time resolved once per export; page numbers resolved per-page in callback.

## Data Flow

```
Frontend (Toolbar.tsx)
  ↓
handleExportPDF()
  ↓ reads config.headerFooter from page-store
  ↓ converts heights px→pt (already in pt from store)
  ↓
ExportPDFData { content, paper_size, margins, header_footer }
  ↓
POST /api/export/pdf
  ↓
Backend (documents.py)
  ↓ ExportRequest validates header_footer
  ↓
PDFExporter.export(header_footer=...)
  ↓
  ├─ Adjust margins: topMargin += header.height, bottomMargin += footer.height
  ├─ Build story (content)
  ├─ Check if {totalPages} token present in runs
  │   └─ If yes: first pass to count pages
  ├─ doc.build(story, onFirstPage=callback, onLaterPages=callback)
  │   ↓
  │   callback(canvas, doc)
  │     ├─ Determine page number: canvas.getPageNumber()
  │     ├─ Check scope: all/exceptFirst/firstOnly
  │     ├─ Check firstPageDifferent: skip if page==1
  │     ├─ Resolve tokens: {pageNumber}, {totalPages}, {date}, {time}
  │     ├─ Draw header at (leftMargin, pageHeight - topMargin + header.height)
  │     └─ Draw footer at (leftMargin, bottomMargin - footer.height)
  ↓
PDF bytes → StreamingResponse → Frontend download
```

## Component Design

### Frontend Changes

#### `frontend/src/api/client.ts`

Add `header_footer` to `ExportPDFData`:

```typescript
export interface ExportPDFData {
  content: Record<string, unknown>;
  paper_size?: string;
  orientation?: string;
  margins?: { top: number; right: number; bottom: number; left: number };
  page_breaks?: string[];
  header_footer?: {
    enabled: boolean;
    firstPageDifferent: boolean;
    header: { runs: Array<{ content: string; marks?: string[]; attrs?: any }>; height: number };
    footer: { runs: Array<{ content: string; marks?: string[]; attrs?: any }>; height: number };
    scope?: 'all' | 'exceptFirst' | 'firstOnly';
  };
}
```

#### `frontend/src/components/Toolbar.tsx`

Modify `handleExportPDF()` to include header_footer:

```typescript
const handleExportPDF = useCallback(async () => {
  const { document, documentTitle } = useDocumentStore.getState();
  try {
    const { paperSize, margins, orientation, headerFooter } = usePageStore.getState().config;

    const content = { children: document.children };
    const filename = `${documentTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    
    await exportPDF({
      content,
      paper_size: paperSize.name,
      orientation,
      margins: {
        top: margins.top * 72 / 96,
        right: margins.right * 72 / 96,
        bottom: margins.bottom * 72 / 96,
        left: margins.left * 72 / 96,
      },
      header_footer: headerFooter.enabled ? {
        enabled: true,
        firstPageDifferent: headerFooter.firstPageDifferent,
        header: {
          runs: headerFooter.header.runs.map(r => ({
            content: r.content,
            marks: r.marks,
            attrs: r.attrs,
          })),
          height: headerFooter.header.height,
        },
        footer: {
          runs: headerFooter.footer.runs.map(r => ({
            content: r.content,
            marks: r.marks,
            attrs: r.attrs,
          })),
          height: headerFooter.footer.height,
        },
        scope: 'all', // Default scope; can be extended later
      } : undefined,
    }, filename);
  } catch (err) {
    console.error('PDF export failed:', err);
  }
}, []);
```

### Backend Changes

#### `backend/app/api/documents.py`

Add `header_footer` to `ExportRequest`:

```python
from typing import Optional, List, Literal
from pydantic import BaseModel, Field

class HeaderFooterRun(BaseModel):
    content: str
    marks: List[str] = []
    attrs: Optional[dict] = None

class HeaderFooterContent(BaseModel):
    runs: List[HeaderFooterRun]
    height: float = Field(ge=0)

class HeaderFooterConfig(BaseModel):
    enabled: bool
    firstPageDifferent: bool = False
    header: HeaderFooterContent
    footer: HeaderFooterContent
    scope: Literal['all', 'exceptFirst', 'firstOnly'] = 'all'

class ExportRequest(BaseModel):
    content: dict
    paper_size: str = "A4"
    orientation: str = "portrait"
    margins: dict = {"top": 72, "right": 72, "bottom": 72, "left": 72}
    page_breaks: list[str] = []
    header_footer: Optional[HeaderFooterConfig] = None
```

#### `backend/app/services/pdf_export.py`

Add header/footer rendering methods:

```python
import re
from datetime import datetime
from reportlab.platypus import SimpleDocTemplate
from reportlab.lib.pagesizes import A4

class PDFExporter:
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
        self._page_width = 595
        self._page_height = 842  # A4 default
        self._left_margin = 72
        self._right_margin = 72
        self._header_footer_config = None
        self._total_pages = None
    
    def export(
        self,
        content: Dict[str, Any],
        filename: str = "document.pdf",
        paper_size: str = "A4",
        orientation: str = "portrait",
        margins: Dict[str, float] = None,
        page_breaks: list[str] = None,
        header_footer: Dict[str, Any] = None,
    ) -> bytes:
        """Export with header/footer support."""
        if margins is None:
            margins = {"top": 72, "right": 72, "bottom": 72, "left": 72}
        if page_breaks is None:
            page_breaks = []
        
        # Get page size
        page_size = PAPER_SIZES.get(paper_size.upper(), A4)
        if orientation == "landscape":
            page_size = rl_landscape(page_size)
        
        self._page_width = page_size[0]
        self._page_height = page_size[1]
        self._left_margin = margins.get("left", 72)
        self._right_margin = margins.get("right", 72)
        
        # Adjust margins for header/footer
        top_margin = margins.get("top", 72)
        bottom_margin = margins.get("bottom", 72)
        
        if header_footer and header_footer.get("enabled"):
            header_height = header_footer["header"]["height"]
            footer_height = header_footer["footer"]["height"]
            
            # Clamp heights to half page height
            max_height = self._page_height / 2
            header_height = min(header_height, max_height)
            footer_height = min(footer_height, max_height)
            
            top_margin += header_height
            bottom_margin += footer_height
            
            self._header_footer_config = header_footer
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=page_size,
            rightMargin=self._right_margin,
            leftMargin=self._left_margin,
            topMargin=top_margin,
            bottomMargin=bottom_margin,
        )
        
        story = self._build_story(content, page_breaks)
        
        # Check if {totalPages} token is present
        needs_total_pages = self._has_total_pages_token()
        
        if needs_total_pages:
            # First pass: count pages
            self._total_pages = self._count_pages(doc, story)
        
        # Second pass: build with header/footer callback
        doc.build(
            story,
            onFirstPage=self._render_header_footer,
            onLaterPages=self._render_header_footer,
        )
        
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        self._header_footer_config = None
        self._total_pages = None
        
        return pdf_bytes
    
    def _has_total_pages_token(self) -> bool:
        """Check if any run contains {totalPages} token."""
        if not self._header_footer_config:
            return False
        
        for section in ["header", "footer"]:
            runs = self._header_footer_config.get(section, {}).get("runs", [])
            for run in runs:
                if "{totalPages}" in run.get("content", ""):
                    return True
        return False
    
    def _count_pages(self, doc: SimpleDocTemplate, story: List) -> int:
        """First pass: build to temporary buffer to count pages."""
        temp_buffer = io.BytesIO()
        temp_doc = SimpleDocTemplate(
            temp_buffer,
            pagesize=doc.pagesize,
            rightMargin=doc.rightMargin,
            leftMargin=doc.leftMargin,
            topMargin=doc.topMargin,
            bottomMargin=doc.bottomMargin,
        )
        temp_doc.build(story)
        
        # Read PDF to count pages (using PyPDF2 or pdfplumber)
        temp_buffer.seek(0)
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(temp_buffer)
            return len(reader.pages)
        except ImportError:
            # Fallback: parse PDF manually for /Type /Page entries
            temp_buffer.seek(0)
            pdf_content = temp_buffer.read()
            return pdf_content.count(b'/Type /Page') - pdf_content.count(b'/Type /Pages')
        finally:
            temp_buffer.close()
    
    def _render_header_footer(self, canvas, doc):
        """Callback for SimpleDocTemplate.build() to render header/footer."""
        if not self._header_footer_config:
            return
        
        page_num = canvas.getPageNumber()
        config = self._header_footer_config
        scope = config.get("scope", "all")
        first_page_different = config.get("firstPageDifferent", False)
        
        # Determine if this page should show header/footer
        should_render = True
        if first_page_different and page_num == 1:
            should_render = False
        elif scope == "exceptFirst" and page_num == 1:
            should_render = False
        elif scope == "firstOnly" and page_num > 1:
            should_render = False
        
        if not should_render:
            return
        
        # Render header
        header_config = config.get("header", {})
        if header_config.get("runs"):
            self._draw_header_footer(
                canvas, doc, header_config, is_header=True, page_num=page_num
            )
        
        # Render footer
        footer_config = config.get("footer", {})
        if footer_config.get("runs"):
            self._draw_header_footer(
                canvas, doc, footer_config, is_header=False, page_num=page_num
            )
    
    def _draw_header_footer(
        self, canvas, doc, config: Dict, is_header: bool, page_num: int
    ):
        """Draw header or footer content on canvas."""
        runs = config.get("runs", [])
        height = config.get("height", 36)
        
        # Resolve tokens in runs
        resolved_text = self._resolve_tokens(runs, page_num)
        
        # Calculate position
        if is_header:
            # Header: top of page, within top margin
            y = self._page_height - doc.topMargin + height / 2
        else:
            # Footer: bottom of page, within bottom margin
            y = doc.bottomMargin - height / 2
        
        x = doc.leftMargin
        
        # Draw text (simplified: concatenate all runs)
        # TODO: Apply marks (bold, italic) and attrs (fontSize, fontFamily, color)
        canvas.saveState()
        canvas.setFont("Helvetica", 10)
        canvas.drawString(x, y, resolved_text)
        canvas.restoreState()
    
    def _resolve_tokens(self, runs: List[Dict], page_num: int) -> str:
        """Resolve dynamic tokens in runs."""
        text_parts = []
        
        for run in runs:
            content = run.get("content", "")
            
            # Replace tokens
            content = content.replace("{pageNumber}", str(page_num))
            
            if self._total_pages is not None:
                content = content.replace("{totalPages}", str(self._total_pages))
            
            # Date/time tokens (resolved once per export)
            now = datetime.now()
            content = content.replace("{date}", now.strftime("%Y-%m-%d"))
            content = content.replace("{time}", now.strftime("%H:%M"))
            
            # Unknown tokens preserved as-is (regex doesn't match them)
            text_parts.append(content)
        
        return "".join(text_parts)
```

## Interfaces / Contracts

### API Contract

**Request** (POST `/api/export/pdf`):

```json
{
  "content": { "children": [...] },
  "paper_size": "A4",
  "orientation": "portrait",
  "margins": { "top": 72, "right": 72, "bottom": 72, "left": 72 },
  "page_breaks": ["block-id-1", "block-id-2"],
  "header_footer": {
    "enabled": true,
    "firstPageDifferent": false,
    "header": {
      "runs": [
        { "content": "Report Title", "marks": ["bold"], "attrs": { "fontSize": 12 } }
      ],
      "height": 36
    },
    "footer": {
      "runs": [
        { "content": "Page {pageNumber} of {totalPages}", "marks": [], "attrs": {} }
      ],
      "height": 24
    },
    "scope": "all"
  }
}
```

**Response**: PDF binary stream (`application/pdf`)

### TypeScript Interfaces

```typescript
// frontend/src/api/client.ts
export interface HeaderFooterRun {
  content: string;
  marks?: string[];
  attrs?: Record<string, any>;
}

export interface HeaderFooterContent {
  runs: HeaderFooterRun[];
  height: number;
}

export interface HeaderFooterPayload {
  enabled: boolean;
  firstPageDifferent: boolean;
  header: HeaderFooterContent;
  footer: HeaderFooterContent;
  scope?: 'all' | 'exceptFirst' | 'firstOnly';
}

export interface ExportPDFData {
  content: Record<string, unknown>;
  paper_size?: string;
  orientation?: string;
  margins?: { top: number; right: number; bottom: number; left: number };
  page_breaks?: string[];
  header_footer?: HeaderFooterPayload;
}
```

### Pydantic Models

```python
# backend/app/api/documents.py
class HeaderFooterRun(BaseModel):
    content: str
    marks: List[str] = []
    attrs: Optional[dict] = None

class HeaderFooterContent(BaseModel):
    runs: List[HeaderFooterRun]
    height: float = Field(ge=0)

class HeaderFooterConfig(BaseModel):
    enabled: bool
    firstPageDifferent: bool = False
    header: HeaderFooterContent
    footer: HeaderFooterContent
    scope: Literal['all', 'exceptFirst', 'firstOnly'] = 'all'

class ExportRequest(BaseModel):
    content: dict
    paper_size: str = "A4"
    orientation: str = "portrait"
    margins: dict = {"top": 72, "right": 72, "bottom": 72, "left": 72}
    page_breaks: list[str] = []
    header_footer: Optional[HeaderFooterConfig] = None
```

## Algorithm Design

### Token Resolution Algorithm

```python
def _resolve_tokens(self, runs: List[Dict], page_num: int) -> str:
    """
    Resolve dynamic tokens in header/footer runs.
    
    Algorithm:
    1. Iterate through each run
    2. For each run's content, replace known tokens:
       - {pageNumber} → current page number (int)
       - {totalPages} → total page count (int, from first pass)
       - {date} → export date (YYYY-MM-DD)
       - {time} → export time (HH:MM)
    3. Unknown tokens (e.g., {version}) are preserved as literals
    4. Concatenate all resolved runs
    
    Time complexity: O(R * T) where R = number of runs, T = tokens per run
    Space complexity: O(N) where N = total text length
    """
    text_parts = []
    now = datetime.now()  # Cached for consistency across runs
    
    for run in runs:
        content = run.get("content", "")
        
        # Replace known tokens
        content = content.replace("{pageNumber}", str(page_num))
        
        if self._total_pages is not None:
            content = content.replace("{totalPages}", str(self._total_pages))
        
        content = content.replace("{date}", now.strftime("%Y-%m-%d"))
        content = content.replace("{time}", now.strftime("%H:%M"))
        
        # Unknown tokens remain unchanged (no regex needed)
        text_parts.append(content)
    
    return "".join(text_parts)
```

### Two-Pass Build Algorithm

```python
def export(self, ..., header_footer=None):
    """
    Two-pass build for {totalPages} resolution.
    
    Algorithm:
    1. Check if {totalPages} token exists in any run
    2. If yes:
       a. First pass: build to temporary buffer
       b. Parse PDF to count pages (PyPDF2 or manual parsing)
       c. Store count in self._total_pages
    3. Second pass: build to final buffer with header/footer callback
       - Callback uses self._total_pages for {totalPages} replacement
    4. If no {totalPages} token: single pass (no overhead)
    
    Performance:
    - Without {totalPages}: 1x build time
    - With {totalPages}: 2x build time + page count parsing (~10ms)
    """
    needs_total_pages = self._has_total_pages_token()
    
    if needs_total_pages:
        # First pass
        self._total_pages = self._count_pages(doc, story)
    
    # Second pass (or only pass if no {totalPages})
    doc.build(story, onFirstPage=callback, onLaterPages=callback)
```

### Margin Adjustment Algorithm

```python
def _adjust_margins(self, margins: Dict, header_footer: Dict) -> Tuple[float, float]:
    """
    Adjust top/bottom margins to reserve space for header/footer.
    
    Algorithm:
    1. Start with base margins from request
    2. If header_footer.enabled:
       a. Extract header.height and footer.height
       b. Clamp each to max_height = page_height / 2 (safety limit)
       c. Add header.height to top_margin
       d. Add footer.height to bottom_margin
    3. Return (top_margin, bottom_margin)
    
    Safety:
    - Heights clamped to half page height to prevent content overflow
    - Zero heights don't affect margins
    - Negative heights rejected by Pydantic validation (ge=0)
    """
    top_margin = margins.get("top", 72)
    bottom_margin = margins.get("bottom", 72)
    
    if header_footer and header_footer.get("enabled"):
        max_height = self._page_height / 2
        
        header_height = min(header_footer["header"]["height"], max_height)
        footer_height = min(header_footer["footer"]["height"], max_height)
        
        top_margin += header_height
        bottom_margin += footer_height
    
    return top_margin, bottom_margin
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/api/client.ts` | Modify | Add `header_footer` field to `ExportPDFData` interface with nested types for runs, heights, scope |
| `frontend/src/components/Toolbar.tsx` | Modify | Update `handleExportPDF()` to read `headerFooter` from `page-store` and include in export payload |
| `backend/app/api/documents.py` | Modify | Add `HeaderFooterRun`, `HeaderFooterContent`, `HeaderFooterConfig` Pydantic models; add `header_footer` field to `ExportRequest` |
| `backend/app/services/pdf_export.py` | Modify | Add `_has_total_pages_token()`, `_count_pages()`, `_render_header_footer()`, `_draw_header_footer()`, `_resolve_tokens()` methods; update `export()` signature and logic |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| **Unit (Backend)** | Token resolution | Test `_resolve_tokens()` with various token combinations, unknown tokens, empty runs |
| **Unit (Backend)** | Margin adjustment | Test `_adjust_margins()` with zero heights, excessive heights, disabled config |
| **Unit (Backend)** | Scope logic | Test page rendering decisions for `all`, `exceptFirst`, `firstOnly` with `firstPageDifferent` |
| **Unit (Backend)** | Two-pass build | Test `_count_pages()` returns correct count; test single-pass when no `{totalPages}` |
| **Integration (Backend)** | Full export pipeline | Test `export()` with header_footer config produces valid PDF with headers/footers |
| **Integration (Backend)** | Backward compatibility | Test `export()` with `header_footer=None` produces byte-equivalent output to pre-feature version |
| **Integration (Frontend)** | Payload construction | Test `handleExportPDF()` includes correct `header_footer` in request |
| **E2E** | End-to-end export | Configure header/footer in UI, export PDF, verify content appears in PDF viewer |
| **E2E** | Dynamic tokens | Configure `{pageNumber}` and `{totalPages}`, export multi-page PDF, verify correct values |
| **E2E** | Scope variations | Test `exceptFirst` skips page 1, `firstOnly` shows only page 1 |

### Test Cases (Backend pytest)

```python
def test_resolve_tokens_page_number():
    exporter = PDFExporter()
    runs = [{"content": "Page {pageNumber}"}]
    result = exporter._resolve_tokens(runs, page_num=3)
    assert result == "Page 3"

def test_resolve_tokens_total_pages():
    exporter = PDFExporter()
    exporter._total_pages = 10
    runs = [{"content": "of {totalPages}"}]
    result = exporter._resolve_tokens(runs, page_num=1)
    assert result == "of 10"

def test_resolve_tokens_unknown_preserved():
    exporter = PDFExporter()
    runs = [{"content": "Version {version}"}]
    result = exporter._resolve_tokens(runs, page_num=1)
    assert result == "Version {version}"

def test_margin_adjustment_with_header_footer():
    exporter = PDFExporter()
    exporter._page_height = 842  # A4
    margins = {"top": 72, "bottom": 72}
    header_footer = {
        "enabled": True,
        "header": {"height": 36},
        "footer": {"height": 24},
    }
    top, bottom = exporter._adjust_margins(margins, header_footer)
    assert top == 108  # 72 + 36
    assert bottom == 96  # 72 + 24

def test_margin_adjustment_excessive_height_clamped():
    exporter = PDFExporter()
    exporter._page_height = 842
    margins = {"top": 72, "bottom": 72}
    header_footer = {
        "enabled": True,
        "header": {"height": 500},  # > 842/2
        "footer": {"height": 24},
    }
    top, bottom = exporter._adjust_margins(margins, header_footer)
    assert top == 72 + 421  # clamped to 421
    assert bottom == 96

def test_scope_except_first():
    exporter = PDFExporter()
    exporter._header_footer_config = {
        "enabled": True,
        "scope": "exceptFirst",
        "firstPageDifferent": False,
        "header": {"runs": [{"content": "Title"}], "height": 36},
        "footer": {"runs": [], "height": 0},
    }
    # Page 1: should not render
    # Page 2: should render
    # (Test via mock canvas in actual test)

def test_first_page_different_overrides_scope():
    exporter = PDFExporter()
    exporter._header_footer_config = {
        "enabled": True,
        "scope": "all",
        "firstPageDifferent": True,
        "header": {"runs": [{"content": "Title"}], "height": 36},
        "footer": {"runs": [], "height": 0},
    }
    # Page 1: should not render (firstPageDifferent wins)
    # Page 2: should render
```

### Test Cases (Frontend Vitest)

```typescript
test('handleExportPDF includes header_footer when enabled', async () => {
  // Mock page-store with headerFooter enabled
  // Call handleExportPDF()
  // Verify exportPDF() called with header_footer in payload
});

test('handleExportPDF omits header_footer when disabled', async () => {
  // Mock page-store with headerFooter.enabled = false
  // Call handleExportPDF()
  // Verify exportPDF() called without header_footer
});
```

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. Feature is backward compatible:
- `header_footer` defaults to `None` in `ExportRequest`
- Existing exports without `header_footer` work identically
- No database changes
- No frontend state migration (config already exists in `page-store`)

Rollout: Deploy backend first (accepts optional field), then frontend (starts sending field).

## Open Questions

- [ ] **Run formatting**: Should header/footer runs support marks (bold, italic) and attrs (fontSize, fontFamily, color)? Current design concatenates text without formatting. If yes, need to apply ReportLab XML markup similar to `_extract_text()`.
- [ ] **Alignment**: Should headers/footers support text alignment (left, center, right)? Current design uses `drawString()` (left-aligned). If yes, need `drawCentredString()` or `drawRightString()` based on config.
- [ ] **Page number position**: Frontend has `pageNumberPosition` config (bottom-center, top-right, etc.). Should this be respected in PDF export, or is it separate from header/footer runs?
- [ ] **Performance**: Two-pass build doubles export time when `{totalPages}` is present. Acceptable tradeoff, or need optimization (e.g., cache page count for identical content)?
