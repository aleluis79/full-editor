"""PDF Export Service using ReportLab."""
from reportlab.lib.pagesizes import A4, LETTER, LEGAL
from reportlab.lib.pagesizes import landscape as rl_landscape
from reportlab.lib.units import inch, mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image,
    PageBreak,
)
from reportlab.lib import colors
from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime
import io


# Paper sizes mapping
PAPER_SIZES = {
    "A4": A4,
    "LETTER": LETTER,
    "LEGAL": LEGAL,
}


# ── Font family mapping (common to ReportLab PDF fonts) ────────
_REPORTLAB_FONTS = {
    "Helvetica": "Helvetica",
    "Arial": "Helvetica",
    "Verdana": "Helvetica",
    "Tahoma": "Helvetica",
    "Trebuchet MS": "Helvetica",
    "sans-serif": "Helvetica",
    "Times New Roman": "Times-Roman",
    "Times": "Times-Roman",
    "Georgia": "Times-Roman",
    "Palatino": "Times-Roman",
    "serif": "Times-Roman",
    "Courier New": "Courier",
    "Courier": "Courier",
    "monospace": "Courier",
}


def _map_font(family: str) -> str:
    """Map a font family to the closest ReportLab built-in font."""
    return _REPORTLAB_FONTS.get(family, "Helvetica")


class PDFExporter:
    """Export document content to PDF."""
    
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
        # Will be set during export()
        self._page_width = 595
        self._page_height = 842  # A4 default height
        self._left_margin = 72
        self._right_margin = 72
        self._header_footer_config = None
        self._total_pages = None
    
    def _setup_custom_styles(self):
        """Setup custom paragraph styles."""
        self.styles.add(ParagraphStyle(
            name='Heading1Custom',
            parent=self.styles['Heading1'],
            fontSize=24,
            spaceAfter=0,
        ))
        self.styles.add(ParagraphStyle(
            name='Heading2Custom',
            parent=self.styles['Heading2'],
            fontSize=18,
            spaceAfter=0,
        ))
        self.styles.add(ParagraphStyle(
            name='Heading3Custom',
            parent=self.styles['Heading3'],
            fontSize=15,
            spaceAfter=0,
        ))
        self.styles.add(ParagraphStyle(
            name='BodyTextCustom',
            parent=self.styles['Normal'],
            fontSize=12,
            leading=18,
            spaceAfter=0,
        ))
        self.styles.add(ParagraphStyle(
            name='BlockquoteCustom',
            parent=self.styles['Normal'],
            fontSize=12,
            leading=16,
            leftIndent=20,
            rightIndent=20,
            textColor=colors.grey,
        ))
    
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
        """
        Export document content to PDF.
        
        Args:
            content: Document content dictionary
            filename: Output filename
            paper_size: Paper size (A4, LETTER, LEGAL)
            orientation: Page orientation ('portrait' or 'landscape')
            margins: Margins in points {top, right, bottom, left}
            page_breaks: Block IDs where explicit page breaks should occur
            header_footer: Optional header/footer configuration
        
        Returns:
            PDF file as bytes
        """
        if margins is None:
            margins = {"top": 72, "right": 72, "bottom": 72, "left": 72}
        if page_breaks is None:
            page_breaks = []
        
        # Get page size — normalize to uppercase (frontend sends "Legal", keys are "LEGAL")
        page_size = PAPER_SIZES.get(paper_size.upper(), A4)
        
        # Apply landscape if requested
        if orientation == "landscape":
            page_size = rl_landscape(page_size)
        
        # Store page dimensions for child methods
        self._page_width = page_size[0]
        self._page_height = page_size[1]
        self._left_margin = margins.get("left", 72)
        self._right_margin = margins.get("right", 72)
        
        # Adjust margins for header/footer
        top_margin, bottom_margin = self._adjust_margins(margins, header_footer)
        
        if header_footer and header_footer.get("enabled"):
            self._header_footer_config = header_footer
        
        # Create PDF in memory
        buffer = io.BytesIO()
        
        # Create document
        doc = SimpleDocTemplate(
            buffer,
            pagesize=page_size,
            rightMargin=self._right_margin,
            leftMargin=self._left_margin,
            topMargin=top_margin,
            bottomMargin=bottom_margin,
        )
        
        # Build story (content) with page breaks
        story = self._build_story(content, page_breaks)
        
        # Check if {totalPages} token is present
        needs_total_pages = self._has_total_pages_token()
        
        if needs_total_pages:
            # First pass: count pages
            self._total_pages = self._count_pages(doc, story)
            # Rebuild story since _count_pages consumed it (ReportLab modifies flowables during build)
            story = self._build_story(content, page_breaks)
        
        # Second pass: build with header/footer callback
        if self._header_footer_config:
            doc.build(
                story,
                onFirstPage=self._render_header_footer,
                onLaterPages=self._render_header_footer,
            )
        else:
            doc.build(story)
        
        # Get PDF bytes
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        # Reset state
        self._header_footer_config = None
        self._total_pages = None
        
        return pdf_bytes
    
    def _build_story(self, content: Dict[str, Any], page_breaks: list[str] = None) -> List:
        """Build PDF story from document content, inserting page breaks where specified."""
        if page_breaks is None:
            page_breaks = []
        
        break_set = set(page_breaks)
        story = []
        
        # Process document children
        children = content.get("children", [])
        
        for child in children:
            block_type = child.get("type", "")
            block_id = child.get("id", "")
            
            if block_type == "paragraph":
                story.extend(self._process_paragraph(child))
            elif block_type == "heading":
                story.extend(self._process_heading(child))
            elif block_type == "list":
                story.extend(self._process_list(child))
            elif block_type == "blockquote":
                story.extend(self._process_blockquote(child))
            elif block_type == "horizontalRule":
                story.append(Spacer(1, 12))
                story.append(Paragraph("─" * 50, self.styles['Normal']))
                story.append(Spacer(1, 12))
            elif block_type == "image":
                story.extend(self._process_image(child))
            elif block_type == "table":
                story.extend(self._process_table(child))
            
            # Insert page break after this block if it's a break point
            if block_id in break_set:
                story.append(PageBreak())
        
        return story
    
    def _alignment_from_block(self, block: Dict[str, Any]) -> int:
        """Map block attrs.textAlign to ReportLab alignment constant."""
        attrs = block.get("attrs", {}) or {}
        align = attrs.get("textAlign", "left")
        mapping = {
            "left": TA_LEFT,
            "center": TA_CENTER,
            "right": TA_RIGHT,
            "justify": TA_JUSTIFY,
        }
        return mapping.get(align, TA_LEFT)

    def _line_height_from_block(self, block: Dict[str, Any], default: float = 1.5) -> float:
        """Get per-block lineHeight from attrs, falling back to given default."""
        attrs = block.get("attrs", {}) or {}
        return attrs.get("lineHeight", default)

    def _process_paragraph(self, block: Dict[str, Any]) -> List:
        """Process paragraph block. Empty paragraphs become blank lines."""
        text = self._extract_text(block)
        block_lh = self._line_height_from_block(block, 1.5)
        # Only add half-leading when the user explicitly set a non-default
        # lineHeight — otherwise keep the original pagination intact.
        if text:
            align = self._alignment_from_block(block)
            max_fs = self._max_font_size_in_block(block)
            style = ParagraphStyle(
                'BodyTextAligned',
                parent=self.styles['BodyTextCustom'],
                alignment=align,
                leading=max_fs * block_lh,
                fontSize=min(12, max_fs),
            )
            return [Paragraph(text, style)]
        # Empty paragraph → blank line using a spacer the height of one text line
        return [Spacer(1, max(self.styles['BodyTextCustom'].leading or 16, self._max_font_size_in_block(block) * block_lh))]
    
    def _process_heading(self, block: Dict[str, Any]) -> List:
        """Process heading block."""
        level = block.get("level", 1)
        text = self._extract_text(block)
        align = self._alignment_from_block(block)
        block_lh = self._line_height_from_block(block, 1.3)

        style_map = {
            1: self.styles['Heading1Custom'],
            2: self.styles['Heading2Custom'],
            3: self.styles['Heading3Custom'],
        }
        base = style_map.get(level, self.styles['Heading1Custom'])
        # Use the heading's inherent font size (from its level) as the base,
        # then consider any larger custom fontSize from individual runs
        heading_base_fs = {1: 24, 2: 18, 3: 15}.get(level, 24)
        max_run_fs = self._max_font_size_in_block(block)
        effective_fs = max(heading_base_fs, max_run_fs)
        style = ParagraphStyle(
            'HeadingAligned',
            parent=base,
            alignment=align,
            leading=effective_fs * block_lh,
            fontSize=effective_fs,
        )
        
        if text:
            return [Paragraph(text, style)]
        return []
    
    def _max_font_size_in_block(self, block: Dict[str, Any]) -> int:
        """Find the maximum font size across all text runs in a block."""
        max_size = 12  # default body font size
        children = block.get("children", [])
        for child in children:
            if child.get("type") == "text":
                attrs = child.get("attrs") or {}
                fs = attrs.get("fontSize")
                if fs and isinstance(fs, (int, float)):
                    max_size = max(max_size, int(fs))
            elif child.get("type") in ("paragraph", "heading", "listItem"):
                max_size = max(max_size, self._max_font_size_in_block(child))
        return max_size
    
    def _process_list(self, block: Dict[str, Any]) -> List:
        """Process list block."""
        story = []
        items = block.get("children", [])
        ordered = block.get("ordered", False)
        
        for i, item in enumerate(items):
            text = self._extract_text(item)
            if text:
                prefix = f"{i + 1}." if ordered else "•"
                story.append(Paragraph(f"{prefix} {text}", self.styles['BodyTextCustom']))
        
        return story
    
    def _process_blockquote(self, block: Dict[str, Any]) -> List:
        """Process blockquote block."""
        text = self._extract_text(block)
        if text:
            return [Paragraph(f"<i>\"{text}\"</i>", self.styles['BlockquoteCustom'])]
        return []
    
    def _process_image(self, block: Dict[str, Any]) -> List:
        """Process image block."""
        src = block.get("src", "")
        width = block.get("width", 300)
        height = block.get("height", 200)
        
        # Map URL path to filesystem path if it's a local upload
        if src.startswith("/uploads/"):
            from ..config import UPLOAD_DIR as _UPLOAD_DIR
            filename = Path(src).name
            src = str(_UPLOAD_DIR / filename)
        
        # Scale to fit page content width, preserving aspect ratio
        content_width = self._page_width - self._left_margin - self._right_margin
        scale = min(1, content_width / width) if width > 0 else 1
        scaled_w = width * scale
        scaled_h = height * scale
        
        # Resolve alignment from block attrs
        attrs = block.get("attrs") or {}
        align_map = {"left": "LEFT", "center": "CENTER", "right": "RIGHT"}
        h_align = align_map.get(attrs.get("textAlign", "left"), "LEFT")
        
        try:
            img = Image(src, width=scaled_w, height=scaled_h, hAlign=h_align)
            return [img]
        except Exception:
            return [Paragraph(f"[Image: {src}]", self.styles['Normal'])]
    
    def _cell_to_paragraph(self, cell: Dict[str, Any]) -> Paragraph:
        """Convert a table cell's content into a ReportLab Paragraph with markup."""
        align_map = {'left': TA_LEFT, 'center': TA_CENTER, 'right': TA_RIGHT}
        children = cell.get("children", [])
        
        # Determine alignment from first paragraph that has it
        align_val = TA_LEFT
        for p in children:
            p_attrs = p.get("attrs") or {}
            if p_attrs.get("textAlign"):
                align_val = align_map.get(p_attrs["textAlign"], TA_LEFT)
                break
        
        # Build XML-style markup for runs
        parts = []
        for p in children:
            runs = p.get("children", [])
            for run in runs:
                content = run.get("content", "")
                # Escape HTML entities BEFORE wrapping with formatting tags
                content = content.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                marks = run.get("marks", [])
                attrs = run.get("attrs", {}) or {}
                # Wrap in formatting tags
                text = content
                if 'bold' in marks:
                    text = f'<b>{text}</b>'
                if 'italic' in marks:
                    text = f'<i>{text}</i>'
                if 'underline' in marks:
                    text = f'<u>{text}</u>'
                if 'strikethrough' in marks:
                    text = f'<strike>{text}</strike>'
                if 'superscript' in marks:
                    text = f'<super>{text}</super>'
                if 'subscript' in marks:
                    text = f'<sub>{text}</sub>'
                # Apply link wrapping
                href = run.get("href", "")
                if "link" in marks and href:
                    text = f'<a href="{href}">{text}</a>'
                # Apply background color
                bg = attrs.get("backgroundColor")
                if bg and isinstance(bg, str):
                    text = f'<span backcolor="{bg}">{text}</span>'
                # Apply inline font attrs (size, family, color)
                font_attrs = []
                fs = attrs.get("fontSize")
                if fs is not None:
                    font_attrs.append(f'size="{fs}"')
                ff = attrs.get("fontFamily")
                if ff is not None and isinstance(ff, str):
                    mapped = _map_font(ff)
                    font_attrs.append(f'face="{mapped}"')
                color = attrs.get("color")
                if color and isinstance(color, str):
                    font_attrs.append(f'color="{color}"')
                if font_attrs:
                    text = f'<font {" ".join(font_attrs)}>{text}</font>'
                parts.append(text)
            # Add newline between paragraphs
            parts.append('<br/>')
        
        body = ''.join(parts)
        if body.endswith('<br/>'):
            body = body[:-5]
        if not body:
            body = ' '
        
        # Find max font size in cell to set appropriate leading
        cell_max_fs = 10
        cell_lh = 1.4
        for p in children:
            cell_max_fs = max(cell_max_fs, self._max_font_size_in_block(p))
            p_attrs = p.get("attrs", {}) or {}
            p_lh = p_attrs.get("lineHeight")
            if p_lh is not None:
                cell_lh = p_lh
        
        style = ParagraphStyle(
            'CellPara',
            fontName='Helvetica',
            fontSize=min(10, cell_max_fs),
            leading=cell_max_fs * cell_lh,
            alignment=align_val,
            spaceBefore=0,
            spaceAfter=0,
        )
        return Paragraph(body, style)
    
    def _process_table(self, block: Dict[str, Any]) -> List:
        """Process table block."""
        rows = block.get("rows", [])
        column_widths = block.get("columnWidths", [])
        if not rows:
            return []
        
        # Convert column widths from px to pt
        content_width = self._page_width - self._left_margin - self._right_margin
        raw_widths = [float(w) * 0.75 for w in column_widths] if column_widths else None
        if raw_widths:
            total = sum(raw_widths)
            if total > content_width:
                scale = content_width / total
                col_widths = [w * scale for w in raw_widths]
            else:
                col_widths = raw_widths
        
        # Determine table alignment from block attrs
        align_map = {'left': 'LEFT', 'center': 'CENTER', 'right': 'RIGHT'}
        attrs = block.get("attrs", {}) or {}
        h_align = align_map.get(attrs.get("textAlign", "left"), 'LEFT')
        
        # Build table data with Paragraph objects (supports bold/italic markup)
        table_data = []
        for ri, row in enumerate(rows):
            row_data = []
            for ci, cell in enumerate(row.get("cells", [])):
                if cell.get("colSpan", 1) > 0:
                    para = self._cell_to_paragraph(cell)
                    row_data.append(para)
            if row_data:
                table_data.append(row_data)
        
        if not table_data:
            return []
        
        # Create table with explicit column widths
        table = Table(table_data, colWidths=col_widths, hAlign=h_align)
        
        # Build style commands
        style_cmds = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]
        
        style = TableStyle(style_cmds)
        table.setStyle(style)
        
        return [table]
    
    def _extract_text(self, node: Dict[str, Any]) -> str:
        """Extract text content from a node, recursing into block children."""
        children = node.get("children", [])
        text_parts = []
        
        for child in children:
            child_type = child.get("type")
            
            # Skip non-content types
            if child_type == "listItem":
                # List items contain block children (paragraphs) — recurse
                text_parts.append(self._extract_text(child))
                continue
            
            if child_type in ("paragraph", "heading"):
                # Block types — recurse into their text runs
                text_parts.append(self._extract_text(child))
                continue
            
            if child_type == "text":
                content = child.get("content", "")
                # Escape HTML entities BEFORE wrapping with formatting tags,
                # otherwise bare "<" chars crash ReportLab's XML parser.
                content = content.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                marks = child.get("marks", [])
                attrs = child.get("attrs", {}) or {}
                
                # Apply marks
                if "bold" in marks:
                    content = f"<b>{content}</b>"
                if "italic" in marks:
                    content = f"<i>{content}</i>"
                if "underline" in marks:
                    content = f"<u>{content}</u>"
                if "strikethrough" in marks:
                    content = f"<strike>{content}</strike>"
                if "superscript" in marks:
                    content = f"<super>{content}</super>"
                if "subscript" in marks:
                    content = f"<sub>{content}</sub>"
                
                # Apply link wrapping (before font attrs so font tags nest inside link)
                href = child.get("href", "")
                if "link" in marks and href:
                    content = f'<a href="{href}">{content}</a>'
                
                # Apply background color via ReportLab <span backcolor="...">
                bg = attrs.get("backgroundColor")
                if bg and isinstance(bg, str):
                    content = f'<span backcolor="{bg}">{content}</span>'

                # Apply inline style tags from attrs (font size, family, color)
                font_attrs = []
                fs = attrs.get("fontSize")
                if fs is not None:
                    font_attrs.append(f'size="{fs}"')
                ff = attrs.get("fontFamily")
                if ff is not None and isinstance(ff, str):
                    mapped = _map_font(ff)
                    font_attrs.append(f'face="{mapped}"')
                color = attrs.get("color")
                if color and isinstance(color, str):
                    font_attrs.append(f'color="{color}"')
                
                if font_attrs:
                    content = f'<font {" ".join(font_attrs)}>{content}</font>'
                
                text_parts.append(content)
        
        return "".join(text_parts)
    
    def _render_header_footer(self, canvas, doc):
        """
        Callback for SimpleDocTemplate.build() to render header/footer on each page.
        
        Determines if header/footer should render based on scope and firstPageDifferent,
        then calls _draw_header_footer for each section.
        """
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
        """
        Draw header or footer content on canvas.
        
        Args:
            canvas: ReportLab canvas object
            doc: ReportLab document object
            config: Header or footer config dict with 'runs' and 'height'
            is_header: True for header, False for footer
            page_num: Current page number
        """
        runs = config.get("runs", [])
        height = config.get("height", 36)
        attrs = config.get("attrs", {})
        text_align = attrs.get("textAlign", "left")
        
        # Build styled text from runs
        styled_text = self._build_header_footer_text(runs, page_num)
        
        # Calculate position
        if is_header:
            # Header: top of page, within top margin
            # doc.topMargin already includes header_height from _adjust_margins
            y = self._page_height - doc.topMargin
        else:
            # Footer: bottom of page, within bottom margin
            # doc.bottomMargin already includes footer_height from _adjust_margins
            y = doc.bottomMargin
        
        # Map alignment
        align_map = {
            "left": TA_LEFT,
            "center": TA_CENTER,
            "right": TA_RIGHT,
        }
        alignment = align_map.get(text_align, TA_LEFT)
        
        # Create paragraph style
        style = ParagraphStyle(
            'HeaderFooterStyle',
            parent=self.styles['Normal'],
            fontSize=10,
            leading=12,
            alignment=alignment,
        )
        
        # Create paragraph and draw it
        para = Paragraph(styled_text, style)
        para_width = self._page_width - doc.leftMargin - doc.rightMargin
        para.wrapOn(canvas, para_width, height)
        
        # Adjust y position based on header/footer
        # For header: draw at y (top of content area), paragraph extends upward into margin
        # For footer: draw at y - height (below content area), paragraph extends upward into margin
        if is_header:
            draw_y = y
        else:
            draw_y = y - height
        
        para.drawOn(canvas, doc.leftMargin, draw_y)
    
    def _has_total_pages_token(self) -> bool:
        """
        Check if any run in header or footer contains {totalPages} token.
        
        Returns:
            True if {totalPages} found, False otherwise
        """
        if not self._header_footer_config:
            return False
        
        for section in ["header", "footer"]:
            runs = self._header_footer_config.get(section, {}).get("runs", [])
            for run in runs:
                if "{totalPages}" in run.get("content", ""):
                    return True
        return False
    
    def _count_pages(self, doc: SimpleDocTemplate, story: List) -> int:
        """
        First pass: build to temporary buffer to count pages.
        
        Args:
            doc: ReportLab document template
            story: List of flowables
        
        Returns:
            Number of pages in the document
        """
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
        
        # Parse PDF to count pages (fallback method since PyPDF2 not available)
        temp_buffer.seek(0)
        pdf_content = temp_buffer.read()
        # Count /Type /Page entries (excluding /Type /Pages which is the parent)
        page_count = pdf_content.count(b'/Type /Page') - pdf_content.count(b'/Type /Pages')
        temp_buffer.close()
        
        return max(1, page_count)  # At least 1 page
    
    def _adjust_margins(self, margins: Dict, header_footer: Dict) -> tuple[float, float]:
        """
        Adjust top/bottom margins to reserve space for header/footer.
        
        Args:
            margins: Original margins dict with 'top' and 'bottom' keys
            header_footer: Header/footer config dict
        
        Returns:
            Tuple of (top_margin, bottom_margin) adjusted for header/footer
        """
        top_margin = margins.get("top", 72)
        bottom_margin = margins.get("bottom", 72)
        
        if header_footer and header_footer.get("enabled"):
            # Reserve at most 1/3 of page height for header/footer combined
            # to ensure content area remains usable
            max_total = self._page_height / 3
            
            header_height = header_footer["header"]["height"]
            footer_height = header_footer["footer"]["height"]
            
            # If combined height exceeds max, scale both proportionally
            total_hf = header_height + footer_height
            if total_hf > max_total and total_hf > 0:
                scale = max_total / total_hf
                header_height *= scale
                footer_height *= scale
            
            top_margin += header_height
            bottom_margin += footer_height
        
        return top_margin, bottom_margin
    
    def _resolve_tokens(self, runs: List[Dict], page_num: int) -> str:
        """
        Resolve dynamic tokens in header/footer runs.
        
        Replaces {pageNumber}, {totalPages}, {date}, {time} with actual values.
        Unknown tokens are preserved as literals.
        
        Args:
            runs: List of run dicts with 'content' key
            page_num: Current page number
        
        Returns:
            Concatenated text with tokens resolved
        """
        text_parts = []
        now = datetime.now()  # Cached for consistency across runs
        
        for run in runs:
            content = run.get("content", "")
            
            # Replace known tokens
            content = content.replace("{pageNumber}", str(page_num))
            
            if self._total_pages is not None:
                content = content.replace("{totalPages}", str(self._total_pages))
            
            content = content.replace("{date}", now.strftime("%d/%m/%Y"))
            content = content.replace("{time}", now.strftime("%H:%M"))
            
            # Unknown tokens remain unchanged (no regex needed)
            text_parts.append(content)
        
        return "".join(text_parts)
    
    def _build_header_footer_text(self, runs: List[Dict], page_num: int) -> str:
        """
        Build styled HTML text from header/footer runs with token resolution.
        
        Similar to _extract_text but for header/footer runs.
        Applies marks (bold, italic, underline) and resolves tokens.
        
        Args:
            runs: List of run dicts with 'content', 'marks', and 'attrs'
            page_num: Current page number for token resolution
        
        Returns:
            HTML string with styles applied
        """
        text_parts = []
        now = datetime.now()
        
        for run in runs:
            content = run.get("content", "")
            
            # Resolve tokens first
            content = content.replace("{pageNumber}", str(page_num))
            if self._total_pages is not None:
                content = content.replace("{totalPages}", str(self._total_pages))
            content = content.replace("{date}", now.strftime("%d/%m/%Y"))
            content = content.replace("{time}", now.strftime("%H:%M"))
            
            # Escape HTML entities
            content = content.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            
            marks = run.get("marks", [])
            attrs = run.get("attrs", {}) or {}
            
            # Apply marks
            if "bold" in marks:
                content = f"<b>{content}</b>"
            if "italic" in marks:
                content = f"<i>{content}</i>"
            if "underline" in marks:
                content = f"<u>{content}</u>"
            
            # Apply font attributes
            font_attrs = []
            fs = attrs.get("fontSize")
            if fs is not None:
                font_attrs.append(f'size="{fs}"')
            ff = attrs.get("fontFamily")
            if ff is not None and isinstance(ff, str):
                mapped = _map_font(ff)
                font_attrs.append(f'face="{mapped}"')
            color = attrs.get("color")
            if color and isinstance(color, str):
                font_attrs.append(f'color="{color}"')
            
            if font_attrs:
                content = f'<font {" ".join(font_attrs)}>{content}</font>'
            
            text_parts.append(content)
        
        return "".join(text_parts)


# Global exporter instance
exporter = PDFExporter()
