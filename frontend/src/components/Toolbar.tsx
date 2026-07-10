import { useCallback, useRef, useState } from 'react';
import { useDocumentStore } from '../stores/document-store';
import { useEditorStore } from '../stores/editor-store';
import { getSelectionRange, isSelectionEmpty } from '../core/selection';
import { exportPDF } from '../api/client';
import { usePageStore } from '../stores/page-store';
import { useLayoutStore } from '../stores/layout-store';
import type { MarkType, StyleAttrs, BlockType } from '../core/types';

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
  const toggleMark = useDocumentStore((s) => s.toggleMark);
  const setStyle = useDocumentStore((s) => s.setStyle);
  const clearFormattingAction = useDocumentStore((s) => s.clearFormatting);
  const insertBlock = useDocumentStore((s) => s.insertBlock);
  const convertBlock = useDocumentStore((s) => s.convertBlock);
  const setBlockAttrs = useDocumentStore((s) => s.setBlockAttrs);

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

  const handleToggleMark = (mark: MarkType) => {
    if (!hasSelection) return;
    const { start, end } = getSelectionRange(selection!);
    toggleMark(start.nodeId, start.offset, end.offset, mark);
  };

  const handleSetStyle = (key: keyof StyleAttrs, value: string | number | undefined) => {
    if (!hasSelection) return;
    const { start, end } = getSelectionRange(selection!);
    setStyle(start.nodeId, start.offset, end.offset, key, value);
  };

  const handleInsertBlock = (blockType: 'paragraph' | 'heading' | 'list' | 'blockquote' | 'horizontalRule', attrs?: Record<string, unknown>) => {
    if (!hasCursor) return;
    insertBlock(cursor.position.nodeId, blockType, attrs);
  };

  const handleClearFormatting = () => {
    if (!hasSelection) return;
    const { start, end } = getSelectionRange(selection!);
    clearFormattingAction(start.nodeId, start.offset, end.offset);
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
      // Get page breaks from the pagination engine
      const { pages } = usePageStore.getState();
      // For each page after the first, the first block of that page needs a break before it.
      // We send the *last block of each page* as the break point (break goes after it).
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

  return (
    <div className="toolbar">
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

      {/* Text formatting */}
      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          onClick={() => handleToggleMark('bold')}
          disabled={!hasSelection}
          title="Bold (Ctrl+B)"
        >
          <strong>B</strong>
        </button>
        <button
          className="toolbar-btn"
          onClick={() => handleToggleMark('italic')}
          disabled={!hasSelection}
          title="Italic (Ctrl+I)"
        >
          <em>I</em>
        </button>
        <button
          className="toolbar-btn"
          onClick={() => handleToggleMark('underline')}
          disabled={!hasSelection}
          title="Underline (Ctrl+U)"
        >
          <u>U</u>
        </button>
        <button
          className="toolbar-btn"
          onClick={() => handleToggleMark('strikethrough')}
          disabled={!hasSelection}
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
          onClick={() => hasCursor && setBlockAttrs(cursor.position.nodeId, { textAlign: 'left' })}
          disabled={!hasCursor}
          title="Alinear a la izquierda"
        >
          <span className="align-icon"><span className="align-line" style={{ width: '60%' }} /><span className="align-line" style={{ width: '80%' }} /><span className="align-line" /></span>
        </button>
        <button
          className="toolbar-btn"
          onClick={() => hasCursor && setBlockAttrs(cursor.position.nodeId, { textAlign: 'center' })}
          disabled={!hasCursor}
          title="Centrar"
        >
          <span className="align-icon align-icon-center"><span className="align-line" style={{ width: '60%' }} /><span className="align-line" style={{ width: '80%' }} /><span className="align-line" /></span>
        </button>
        <button
          className="toolbar-btn"
          onClick={() => hasCursor && setBlockAttrs(cursor.position.nodeId, { textAlign: 'right' })}
          disabled={!hasCursor}
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
          disabled={!hasSelection}
          title="Clear Formatting"
        >
          <span style={{ fontFamily: 'sans-serif', fontSize: '14px' }}>↺</span>
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* Font */}
      <div className="toolbar-group">
        <select
          className="toolbar-select"
          onChange={(e) => handleSetStyle('fontFamily', e.target.value)}
          disabled={!hasSelection}
          title="Font Family"
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        <select
          className="toolbar-select toolbar-select-small"
          onChange={(e) => handleSetStyle('fontSize', Number(e.target.value))}
          disabled={!hasSelection}
          title="Font Size"
        >
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="toolbar-separator" />

      {/* Color */}
      <div className="toolbar-group">
        <label className="toolbar-color-label" title="Text Color">
          A
          <input
            type="color"
            className="toolbar-color-input"
            onChange={(e) => handleSetStyle('color', e.target.value)}
            disabled={!hasSelection}
          />
        </label>
      </div>

      <div className="toolbar-separator" />

      {/* Block types */}
      <div className="toolbar-group">
        <select
          className="toolbar-select"
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
