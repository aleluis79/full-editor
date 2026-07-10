"""PDF Export Service using ReportLab."""
from reportlab.lib.pagesizes import A4, LETTER, LEGAL
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
from typing import Dict, Any, List
import io


# Paper sizes mapping
PAPER_SIZES = {
    "A4": A4,
    "LETTER": LETTER,
    "LEGAL": LEGAL,
}


class PDFExporter:
    """Export document content to PDF."""
    
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Setup custom paragraph styles."""
        self.styles.add(ParagraphStyle(
            name='Heading1Custom',
            parent=self.styles['Heading1'],
            fontSize=24,
            spaceAfter=12,
        ))
        self.styles.add(ParagraphStyle(
            name='Heading2Custom',
            parent=self.styles['Heading2'],
            fontSize=18,
            spaceAfter=10,
        ))
        self.styles.add(ParagraphStyle(
            name='Heading3Custom',
            parent=self.styles['Heading3'],
            fontSize=14,
            spaceAfter=8,
        ))
        self.styles.add(ParagraphStyle(
            name='BodyTextCustom',
            parent=self.styles['Normal'],
            fontSize=12,
            leading=16,
            spaceAfter=8,
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
        margins: Dict[str, float] = None,
    ) -> bytes:
        """
        Export document content to PDF.
        
        Args:
            content: Document content dictionary
            filename: Output filename
            paper_size: Paper size (A4, LETTER, LEGAL)
            margins: Margins in points {top, right, bottom, left}
        
        Returns:
            PDF file as bytes
        """
        if margins is None:
            margins = {"top": 72, "right": 72, "bottom": 72, "left": 72}
        
        # Create PDF in memory
        buffer = io.BytesIO()
        
        # Get page size
        page_size = PAPER_SIZES.get(paper_size, A4)
        
        # Create document
        doc = SimpleDocTemplate(
            buffer,
            pagesize=page_size,
            rightMargin=margins.get("right", 72),
            leftMargin=margins.get("left", 72),
            topMargin=margins.get("top", 72),
            bottomMargin=margins.get("bottom", 72),
        )
        
        # Build story (content)
        story = self._build_story(content)
        
        # Generate PDF
        doc.build(story)
        
        # Get PDF bytes
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        return pdf_bytes
    
    def _build_story(self, content: Dict[str, Any]) -> List:
        """Build PDF story from document content."""
        story = []
        
        # Process document children
        children = content.get("children", [])
        
        for child in children:
            block_type = child.get("type", "")
            
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
        
        return story
    
    def _process_paragraph(self, block: Dict[str, Any]) -> List:
        """Process paragraph block."""
        text = self._extract_text(block)
        if text:
            return [Paragraph(text, self.styles['BodyTextCustom'])]
        return []
    
    def _process_heading(self, block: Dict[str, Any]) -> List:
        """Process heading block."""
        level = block.get("level", 1)
        text = self._extract_text(block)
        
        style_map = {
            1: self.styles['Heading1Custom'],
            2: self.styles['Heading2Custom'],
            3: self.styles['Heading3Custom'],
        }
        style = style_map.get(level, self.styles['Heading1Custom'])
        
        if text:
            return [Paragraph(text, style)]
        return []
    
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
        
        # Scale to fit page
        max_width = 400
        scale = min(1, max_width / width)
        width = width * scale
        height = height * scale
        
        try:
            img = Image(src, width=width, height=height)
            return [img]
        except Exception:
            return [Paragraph(f"[Image: {src}]", self.styles['Normal'])]
    
    def _process_table(self, block: Dict[str, Any]) -> List:
        """Process table block."""
        rows = block.get("rows", [])
        if not rows:
            return []
        
        # Convert to ReportLab table format
        table_data = []
        for row in rows:
            row_data = []
            for cell in row.get("cells", []):
                if cell.get("colSpan", 1) > 0:
                    text = self._extract_text(cell)
                    row_data.append(text)
            if row_data:
                table_data.append(row_data)
        
        if not table_data:
            return []
        
        # Create table
        table = Table(table_data)
        
        # Add style
        style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ])
        table.setStyle(style)
        
        return [table]
    
    def _extract_text(self, node: Dict[str, Any]) -> str:
        """Extract text content from a node."""
        children = node.get("children", [])
        text_parts = []
        
        for child in children:
            if child.get("type") == "text":
                content = child.get("content", "")
                marks = child.get("marks", [])
                
                # Apply marks
                if "bold" in marks:
                    content = f"<b>{content}</b>"
                if "italic" in marks:
                    content = f"<i>{content}</i>"
                if "underline" in marks:
                    content = f"<u>{content}</u>"
                if "strikethrough" in marks:
                    content = f"<strike>{content}</strike>"
                
                text_parts.append(content)
        
        return "".join(text_parts)


# Global exporter instance
exporter = PDFExporter()
