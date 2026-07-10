# Renderer

## Core Principle

The renderer ONLY draws. It NEVER calculates layout. It NEVER modifies the document.

## Technology: DOM (HTML/CSS)

Chosen over Canvas because:
- Native text rendering (subpixel, hinting, ligatures)
- Native selection with Shift+click
- Native copy/paste
- Accessibility (screen readers) for free
- Browser zoom works

## Virtualization: By Page

Only visible pages are rendered in the DOM. Others are height placeholders.

```typescript
function renderVisiblePages(pages: Page[], viewport: Rect) {
  return pages.map(page => {
    if (isInView(page, viewport)) {
      return renderPage(page);
    } else {
      return <div style={{ height: page.height }} />;
    }
  });
}
```

## Page Structure

```typescript
function renderPage(page: Page) {
  return (
    <div className="page" style={{ width: page.width, height: page.height }}>
      {page.header && <Header data={page.header} />}
      <div className="page-content" style={page.contentArea}>
        {page.blocks.map(block => renderBlock(block))}
      </div>
      {page.footer && <Footer data={page.footer} />}
      <PageNumber number={page.pageNumber} />
    </div>
  );
}
```

## Block Rendering

Each block type has its own renderer. Lines are positioned with CSS absolute.

```typescript
function renderLine(line: Line) {
  return (
    <div style={{ position: 'absolute', top: line.y, left: line.x, height: line.height }}>
      {line.runs.map(run => (
        <span style={{
          fontFamily: run.fontFamily,
          fontSize: run.fontSize,
          fontWeight: run.bold ? 'bold' : 'normal',
          fontStyle: run.italic ? 'italic' : 'normal',
          textDecoration: run.underline ? 'underline' : 'none',
          color: run.color,
        }}>
          {run.text}
        </span>
      ))}
    </div>
  );
}
```

## Cursor and Selection: Overlays

```typescript
function renderCursor(cursor: CursorPosition) {
  return (
    <div className="cursor" style={{
      position: 'absolute',
      left: cursor.x,
      top: cursor.y,
      height: cursor.height,
      width: 2,
    }} />
  );
}

function renderSelection(selection: SelectionRange) {
  return selection.rects.map((rect, i) => (
    <div key={i} className="selection-highlight" style={{
      position: 'absolute',
      left: rect.x,
      top: rect.y,
      width: rect.width,
      height: rect.height,
    }} />
  ));
}
```

## React Strategy

- React for UI components (toolbar, sidebar, status bar)
- DOM puro for page content (via ref, direct DOM manipulation)
- React doesn't diff page content on every keystroke
