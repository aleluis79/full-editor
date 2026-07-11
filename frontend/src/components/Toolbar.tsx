import { useCallback, useMemo, useRef, useState } from 'react';
import { useDocumentStore } from '../stores/document-store';
import { useEditorStore } from '../stores/editor-store';
import { getSelectionRange, isSelectionEmpty } from '../core/selection';
import { getRunStylesAtOffset, findNode, getBlockNodes } from '../core/document';
import { exportPDF } from '../api/client';
import { usePageStore } from '../stores/page-store';
import { useLayoutStore } from '../stores/layout-store';
import type { MarkType, StyleAttrs, BlockType, Paragraph, Heading } from '../core/types';

const FONT_FAMILIES = [
  'Georgia',
  'Times New Roman',
  'Arial',
  'Helvetica',
  'Verdana',
  'Courier New',
  'monospace',
];

const FONT_SIZES = [10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

interface ToolbarProps {
  onBack?: () => void;
}

export function Toolbar({ onBack }: ToolbarProps) {
  const selection = useEditorStore((s) => s.selection);
  const cursor = useEditorStore((s) => s.cursor);
  const stickyMarks = useEditorStore((s) => s.stickyMarks);
  const stickyAttrs = useEditorStore((s) => s.stickyAttrs);
  const stickyBreakOut = useEditorStore((s) => s.stickyBreakOut);
  const toggleStickyMark = useEditorStore((s) => s.toggleStickyMark);
  const setStickyStyle = useEditorStore((s) => s.setStickyStyle);
  const clearStickyMarks = useEditorStore((s) => s.clearStickyMarks);
  const toggleMark = useDocumentStore((s) => s.toggleMark);
  const setStyle = useDocumentStore((s) => s.setStyle);
  const clearFormattingAction = useDocumentStore((s) => s.clearFormatting);
  const insertBlock = useDocumentStore((s) => s.insertBlock);
  const convertBlock = useDocumentStore((s) => s.convertBlock);
  const setBlockAttrs = useDocumentStore((s) => s.setBlockAttrs);
  const setBlockAttrsRange = useDocumentStore((s) => s.setBlockAttrsRange);

  const currentDocId = useDocumentStore((s) => s.currentDocId);
  const documentTitle = useDocumentStore((s) => s.documentTitle);
  const setDocumentTitle = useDocumentStore((s) => s.setDocumentTitle);
  const saveDocument = useDocumentStore((s) => s.saveDocument);
  const isDirty = useDocumentStore((s) => s.isDirty);
  const isSaving = useDocumentStore((s) => s.isSaving);
  const markDirty = useDocumentStore((s) => s.markDirty);

  const pageConfig = usePageStore((s) => s.config);
  const updatePaperSize = usePageStore((s) => s.updatePaperSize);
  const availablePaperSizes = usePageStore((s) => s.availablePaperSizes);
  const calculateLayout = useLayoutStore((s) => s.calculateLayout);
  const doc = useDocumentStore((s) => s.document);

  const [editingTitle, setEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const hasSelection = selection && !isSelectionEmpty(selection);
  const hasCursor = cursor.position.nodeId !== '';

  // ── Active styles at cursor ────────────────────────────────
  // Derive the marks and attrs at the current cursor position so
  // the toolbar can reflect what style is under the cursor.
  const activeStyles = useMemo(() => {
    const { nodeId, offset } = cursor.position;
    if (!nodeId) return null;

    const block = findNode(doc, nodeId);
    if (!block || (block.type !== 'paragraph' && block.type !== 'heading')) return null;

    return getRunStylesAtOffset(block as Paragraph | Heading, offset);
  }, [doc, cursor.position.nodeId, cursor.position.offset]);

  // Effective marks: when the user has toggled sticky marks, show those
  // (they determine what will be applied on next keystroke). Otherwise,
  // fall back to the marks at the cursor position (toolbar reflection).
  // When stickyBreakOut is true, the user just turned off all sticky
  // marks — show nothing as active until the first character is typed.
  const effectiveMarks = useMemo(() => {
    if (stickyBreakOut) return new Set<MarkType>();
    if (stickyMarks.length > 0 || Object.keys(stickyAttrs).length > 0) {
      return new Set(stickyMarks);
    }
    return new Set(activeStyles?.marks ?? []);
  }, [stickyMarks, stickyAttrs, stickyBreakOut, activeStyles]);

  const effectiveAttrs: Partial<StyleAttrs> = useMemo(() => {
    if (stickyBreakOut) return {};
    if (stickyMarks.length > 0 || Object.keys(stickyAttrs).length > 0) {
      return stickyAttrs;
    }
    return activeStyles?.attrs ?? {};
  }, [stickyMarks, stickyAttrs, stickyBreakOut, activeStyles]);

  // ── Handlers ───────────────────────────────────────────────

  const handleToggleMark = (mark: MarkType) => {
    if (hasSelection) {
      const { start, end } = getSelectionRange(selection!, doc);
      toggleMark(start.nodeId, start.offset, end.offset, mark, end.nodeId);
      // Clear sticky state since we acted on a real selection
      clearStickyMarks();
    } else {
      // No selection: toggle sticky mark — next typed text will use it
      toggleStickyMark(mark);
    }
  };

  const handleSetStyle = (key: keyof StyleAttrs, value: string | number | undefined) => {
    if (hasSelection) {
      const { start, end } = getSelectionRange(selection!, doc);
      setStyle(start.nodeId, start.offset, end.offset, key, value, end.nodeId);
      clearStickyMarks();
    } else if (hasCursor) {
      // No selection: set sticky style for next typed text
      setStickyStyle(key, value);
    }
  };

  const handleClearFormatting = () => {
    if (hasSelection) {
      const { start, end } = getSelectionRange(selection!, doc);
      clearFormattingAction(start.nodeId, start.offset, end.offset, end.nodeId);
    }
    clearStickyMarks();
  };

  const handleInsertBlock = (blockType: 'paragraph' | 'heading' | 'list' | 'blockquote' | 'horizontalRule', attrs?: Record<string, unknown>) => {
    if (!hasCursor) return;
    insertBlock(cursor.position.nodeId, blockType, attrs);
  };

  const handleConvertBlock = (toType: BlockType, attrs?: Record<string, unknown>) => {
    if (!hasCursor) return;
    convertBlock(cursor.position.nodeId, toType, attrs);
  };

  const handleSave = useCallback(async () => {
    try {
      await saveDocument();
    } catch {
      // Error logged in store
    }
  }, [saveDocument]);

  const handleExportPDF = useCallback(async () => {
    const { document, documentTitle } = useDocumentStore.getState();
    try {
      const { pages } = usePageStore.getState();
      const breakIds: string[] = [];
      for (let i = 1; i < pages.length; i++) {
        const prevPageBlocks = pages[i - 1].blocks;
        if (prevPageBlocks.length > 0) {
          const lastBlock = prevPageBlocks[prevPageBlocks.length - 1];
          breakIds.push(lastBlock.blockId);
        }
      }

      const content = { children: document.children };
      const filename = `${documentTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      await exportPDF({ content, page_breaks: breakIds }, filename);
    } catch (err) {
      console.error('PDF export failed:', err);
    }
  }, []);

  const handleTitleBlur = useCallback(() => {
    setEditingTitle(false);
  }, []);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        setEditingTitle(false);
      }
    },
    []
  );

  // ── Determine active block type for the block selector ─────
  const activeBlockType = useMemo(() => {
    const { nodeId } = cursor.position;
    if (!nodeId) return 'paragraph';
    const block = findNode(doc, nodeId);
    if (!block) return 'paragraph';

    if (block.type === 'heading') {
      const h = block as Heading;
      return `heading${h.level}` as const;
    }
    if (block.type === 'blockquote') return 'blockquote';
    if (block.type === 'list') {
      const l = block as import('../core/types').List;
      return l.ordered ? 'list-ol' : 'list-ul';
    }
    // For blocks inside list items / blockquotes, walk up to find the parent
    if (block.type === 'paragraph' || block.type === 'listItem') {
      const parent = getBlockNodes(doc).find((b) => {
        if (b.type === 'list' || b.type === 'blockquote') {
          const children = 'children' in b ? (b as any).children : [];
          return children.some((c: any) =>
            c.id === block.id ||
            (c.children && c.children.some((cc: any) => cc.id === block.id))
          );
        }
        return false;
      });
      if (parent?.type === 'list') {
        const l = parent as import('../core/types').List;
        return l.ordered ? 'list-ol' : 'list-ul';
      }
      if (parent?.type === 'blockquote') return 'blockquote';
    }
    return 'paragraph';
  }, [doc, cursor.position.nodeId]);

  // Prevent toolbar button clicks from stealing focus from the hidden
  // textarea. Without this, clicking any <button> blurs the textarea
  // and keyboard input stops working.
  // Using closest('button') because the click target may be a child
  // element inside the button (e.g. <strong>, <em>, <span>, <u>).
  const handleToolbarMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) {
      e.preventDefault();
    }
  }, []);

  return (
    <div className="toolbar" onMouseDown={handleToolbarMouseDown}>
      {/* Document controls */}
      <div className="toolbar-group">
        {onBack && (
          <button
            className="toolbar-btn toolbar-btn-back"
            onClick={onBack}
            title="Volver a documentos"
          >
            ←
          </button>
        )}
      </div>

      <div className="toolbar-separator" />

      {/* Document title */}
      <div className="toolbar-group toolbar-title-group">
        {editingTitle ? (
          <input
            ref={titleInputRef}
            className="toolbar-title-input"
            value={documentTitle}
            onChange={(e) => setDocumentTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            autoFocus
          />
        ) : (
          <button
            className="toolbar-title-btn"
            onClick={() => setEditingTitle(true)}
            title="Editar título"
          >
            {documentTitle}
          </button>
        )}
      </div>

      <div className="toolbar-spacer" />

      {/* Save & Export */}
      {currentDocId && (
        <div className="toolbar-group">
          {isDirty && <span className="toolbar-dirty-dot" />}
          <button
            className="toolbar-btn toolbar-btn-save"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            title={isSaving ? 'Guardando...' : 'Guardar'}
          >
            {isSaving ? '⏳' : '💾'}
          </button>
          <button
            className="toolbar-btn"
            onClick={handleExportPDF}
            title="Exportar a PDF"
          >
            <span className="pdf-icon">PDF</span>
          </button>
        </div>
      )}

      <div className="toolbar-separator" />

      {/* Paper size */}
      <div className="toolbar-group">
        <select
          className="toolbar-select toolbar-select-small"
          value={pageConfig.paperSize.name}
          onChange={(e) => {
            const ps = availablePaperSizes.find((p) => p.name === e.target.value);
            if (ps) {
              updatePaperSize(ps);
              calculateLayout(doc);
              markDirty();
            }
          }}
          title="Tamaño de página"
        >
          {availablePaperSizes.map((ps) => (
            <option key={ps.name} value={ps.name}>{ps.name}</option>
          ))}
        </select>
      </div>

      <div className="toolbar-separator" />

      {/* Text formatting — active state reflects cursor position OR sticky marks */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn${effectiveMarks.has('bold') ? ' toolbar-btn-active' : ''}`}
          onClick={() => handleToggleMark('bold')}
          title="Bold (Ctrl+B)"
        >
          <strong>B</strong>
        </button>
        <button
          className={`toolbar-btn${effectiveMarks.has('italic') ? ' toolbar-btn-active' : ''}`}
          onClick={() => handleToggleMark('italic')}
          title="Italic (Ctrl+I)"
        >
          <em>I</em>
        </button>
        <button
          className={`toolbar-btn${effectiveMarks.has('underline') ? ' toolbar-btn-active' : ''}`}
          onClick={() => handleToggleMark('underline')}
          title="Underline (Ctrl+U)"
        >
          <u>U</u>
        </button>
        <button
          className={`toolbar-btn${effectiveMarks.has('strikethrough') ? ' toolbar-btn-active' : ''}`}
          onClick={() => handleToggleMark('strikethrough')}
          title="Strikethrough"
        >
          <s>S</s>
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* Alignment */}
      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          onClick={() => {
            if (hasSelection) {
              const startBlock = selection!.anchor.nodeId;
              const endBlock = selection!.focus.nodeId;
              if (startBlock !== endBlock) {
                setBlockAttrsRange(startBlock, endBlock, { textAlign: 'left' });
              } else {
                setBlockAttrs(startBlock, { textAlign: 'left' });
              }
            } else if (hasCursor) {
              setBlockAttrs(cursor.position.nodeId, { textAlign: 'left' });
            }
          }}
          disabled={!hasCursor && !hasSelection}
          title="Alinear a la izquierda"
        >
          <span className="align-icon"><span className="align-line" style={{ width: '60%' }} /><span className="align-line" style={{ width: '80%' }} /><span className="align-line" /></span>
        </button>
        <button
          className="toolbar-btn"
          onClick={() => {
            if (hasSelection) {
              const startBlock = selection!.anchor.nodeId;
              const endBlock = selection!.focus.nodeId;
              if (startBlock !== endBlock) {
                setBlockAttrsRange(startBlock, endBlock, { textAlign: 'center' });
              } else {
                setBlockAttrs(startBlock, { textAlign: 'center' });
              }
            } else if (hasCursor) {
              setBlockAttrs(cursor.position.nodeId, { textAlign: 'center' });
            }
          }}
          disabled={!hasCursor && !hasSelection}
          title="Centrar"
        >
          <span className="align-icon align-icon-center"><span className="align-line" style={{ width: '60%' }} /><span className="align-line" style={{ width: '80%' }} /><span className="align-line" /></span>
        </button>
        <button
          className="toolbar-btn"
          onClick={() => {
            if (hasSelection) {
              const startBlock = selection!.anchor.nodeId;
              const endBlock = selection!.focus.nodeId;
              if (startBlock !== endBlock) {
                setBlockAttrsRange(startBlock, endBlock, { textAlign: 'right' });
              } else {
                setBlockAttrs(startBlock, { textAlign: 'right' });
              }
            } else if (hasCursor) {
              setBlockAttrs(cursor.position.nodeId, { textAlign: 'right' });
            }
          }}
          disabled={!hasCursor && !hasSelection}
          title="Alinear a la derecha"
        >
          <span className="align-icon align-icon-right"><span className="align-line" style={{ width: '60%' }} /><span className="align-line" style={{ width: '80%' }} /><span className="align-line" /></span>
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          onClick={handleClearFormatting}
          disabled={!hasSelection && stickyMarks.length === 0 && Object.keys(stickyAttrs).length === 0}
          title="Clear Formatting"
        >
          <span style={{ fontFamily: 'sans-serif', fontSize: '14px' }}>↺</span>
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* Font — shows active value from cursor position / sticky attrs */}
      <div className="toolbar-group">
        <select
          className="toolbar-select"
          value={effectiveAttrs.fontFamily ?? ''}
          onChange={(e) => handleSetStyle('fontFamily', e.target.value || undefined)}
          title="Font Family"
        >
          <option value="">—</option>
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        <select
          className="toolbar-select toolbar-select-small"
          value={effectiveAttrs.fontSize ? String(effectiveAttrs.fontSize) : ''}
          onChange={(e) => handleSetStyle('fontSize', e.target.value ? Number(e.target.value) : undefined)}
          title="Font Size"
        >
          <option value="">—</option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="toolbar-separator" />

      {/* Color — shows active value from cursor position / sticky attrs */}
      <div className="toolbar-group">
        <label className="toolbar-color-label" title="Text Color">
          <span style={{ color: effectiveAttrs.color ?? '#000' }}>A</span>
          <input
            type="color"
            className="toolbar-color-input"
            value={effectiveAttrs.color ?? '#000000'}
            onChange={(e) => handleSetStyle('color', e.target.value)}
          />
        </label>
      </div>

      <div className="toolbar-separator" />

      {/* Block types */}
      <div className="toolbar-group">
        <select
          className="toolbar-select"
          value={activeBlockType}
          onChange={(e) => {
            const value = e.target.value;
            if (value === 'paragraph') {
              handleConvertBlock('paragraph');
            } else if (value.startsWith('heading')) {
              const level = Number(value.replace('heading', '')) as 1 | 2 | 3 | 4 | 5 | 6;
              handleConvertBlock('heading', { level });
            } else if (value === 'blockquote') {
              handleConvertBlock('blockquote');
            } else if (value === 'list-ul') {
              handleConvertBlock('list', { ordered: false });
            } else if (value === 'list-ol') {
              handleConvertBlock('list', { ordered: true });
            }
          }}
          disabled={!hasCursor}
          title="Block Type"
        >
          <option value="paragraph">Paragraph</option>
          <option value="heading1">Heading 1</option>
          <option value="heading2">Heading 2</option>
          <option value="heading3">Heading 3</option>
          <option value="blockquote">Blockquote</option>
          <option value="list-ul">Bullet List</option>
          <option value="list-ol">Numbered List</option>
        </select>
      </div>

    </div>
  );
}
