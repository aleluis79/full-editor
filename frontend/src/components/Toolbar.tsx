import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const stickyToggledOff = useEditorStore((s) => s.stickyToggledOff);
  const toggleStickyMark = useEditorStore((s) => s.toggleStickyMark);
  const setStickyStyle = useEditorStore((s) => s.setStickyStyle);
  const clearStickyMarks = useEditorStore((s) => s.clearStickyMarks);
  const toggleMark = useDocumentStore((s) => s.toggleMark);
  const setLink = useDocumentStore((s) => s.setLink);
  const removeLink = useDocumentStore((s) => s.removeLink);
  const setStyle = useDocumentStore((s) => s.setStyle);
  const clearFormattingAction = useDocumentStore((s) => s.clearFormatting);
  const insertBlock = useDocumentStore((s) => s.insertBlock);
  const convertBlock = useDocumentStore((s) => s.convertBlock);
  const setBlockAttrs = useDocumentStore((s) => s.setBlockAttrs);
  const setBlockAttrsRange = useDocumentStore((s) => s.setBlockAttrsRange);
  const insertTable = useDocumentStore((s) => s.insertTable);

  const currentDocId = useDocumentStore((s) => s.currentDocId);
  const documentTitle = useDocumentStore((s) => s.documentTitle);
  const setDocumentTitle = useDocumentStore((s) => s.setDocumentTitle);
  const saveDocument = useDocumentStore((s) => s.saveDocument);
  const isDirty = useDocumentStore((s) => s.isDirty);
  const isSaving = useDocumentStore((s) => s.isSaving);
  const markDirty = useDocumentStore((s) => s.markDirty);
  const selectedTableId = useEditorStore((s) => s.selectedTableId);
  const showLinkPopupFromStore = useEditorStore((s) => s.showLinkPopup);
  const pendingLinkRange = useEditorStore((s) => s.pendingLinkRange);
  const deactivateLinkPopup = useEditorStore((s) => s.deactivateLinkPopup);

  const pageConfig = usePageStore((s) => s.config);
  const updatePaperSize = usePageStore((s) => s.updatePaperSize);
  const availablePaperSizes = usePageStore((s) => s.availablePaperSizes);
  const calculateLayout = useLayoutStore((s) => s.calculateLayout);
  const doc = useDocumentStore((s) => s.document);

  const [editingTitle, setEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // ── Link popup state ───────────────────────────────────────
  const [showLinkPopup, setShowLinkPopup] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const linkInputRef = useRef<HTMLInputElement>(null);
  // Save the selection range when the link button is clicked, so
  // handleLinkSubmit can use it even if focus shifts clear the
  // editor's Zustand selection (via selectionchange handler).
  const linkSelectionRef = useRef<{ blockId: string; start: number; end: number } | null>(null);

  // When activated from Ctrl+K (editor store), show the popup
  useEffect(() => {
    if (showLinkPopupFromStore) {
      setShowLinkPopup(true);
      setLinkUrl('');
      // Clear the local ref since Ctrl+K already saved the range
      // via pendingLinkRange — using a stale ref would be wrong.
      linkSelectionRef.current = null;
    }
  }, [showLinkPopupFromStore]);

  // Focus the link input when popup opens
  useEffect(() => {
    if (showLinkPopup) {
      linkInputRef.current?.focus();
    }
  }, [showLinkPopup]);

  // ── Table picker state ─────────────────────────────────────
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(-1);
  const [hoveredCol, setHoveredCol] = useState(-1);
  const tablePickerRef = useRef<HTMLDivElement>(null);

  const hasSelection = selection && !isSelectionEmpty(selection);
  const hasCursor = cursor.position.nodeId !== '';

  // ── Active styles at cursor ────────────────────────────────
  // Derive the marks and attrs at the current cursor position so
  // the toolbar can reflect what style is under the cursor.
  // Computed on every render (not memoized) to guarantee fresh results
  // after document mutations that leave the cursor position unchanged
  // (e.g. toggling bold on a selection, then clicking to move cursor).
  const activeStyles = (() => {
    const { nodeId, offset } = cursor.position;
    if (!nodeId) return null;

    const block = findNode(doc, nodeId);
    if (!block || (block.type !== 'paragraph' && block.type !== 'heading')) return null;

    return getRunStylesAtOffset(block as Paragraph | Heading, offset);
  })();

  // Effective marks: when sticky marks are set, show those (they determine
  // what will be applied on next keystroke). Otherwise fall back to the
  // cursor position's text run styles (toolbar reflection).
  // When the user just toggled a sticky mark OFF (stickyToggledOff), filter
  // that mark from the cursor styles so the button shows inactive
  // immediately, even though the cursor is still on text with that style.
  const effectiveMarks = useMemo(() => {
    if (stickyMarks.length > 0 || Object.keys(stickyAttrs).length > 0) {
      return new Set(stickyMarks);
    }
    const marks = new Set(activeStyles?.marks ?? []);
    if (stickyToggledOff) {
      marks.delete(stickyToggledOff);
    }
    return marks;
  }, [stickyMarks, stickyAttrs, stickyToggledOff, activeStyles]);

  const effectiveAttrs: Partial<StyleAttrs> = useMemo(() => {
    if (stickyMarks.length > 0 || Object.keys(stickyAttrs).length > 0) {
      return stickyAttrs;
    }
    return activeStyles?.attrs ?? {};
  }, [stickyMarks, stickyAttrs, activeStyles]);

  // Close table picker on outside click
  useEffect(() => {
    if (!showTablePicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (tablePickerRef.current && !tablePickerRef.current.contains(e.target as Node)) {
        setShowTablePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTablePicker]);

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

  const convertRangeToList = useDocumentStore((s) => s.convertRangeToList);

  const handleToggleList = (ordered: boolean) => {
    if (!hasCursor) return;
    const { nodeId } = cursor.position;

    // If there's a multi-block selection, use convertRangeToList
    if (hasSelection) {
      const { start, end } = getSelectionRange(selection!, doc);
      if (start.nodeId !== end.nodeId) {
        convertRangeToList(start.nodeId, end.nodeId, ordered);
        return;
      }
    }

    // Check if the cursor is already inside a list — find the parent list
    const allBlocks = getBlockNodes(doc);
    const parentList = allBlocks.find((b) => {
      if (b.type !== 'list') return false;
      const list = b as import('../core/types').List;
      return list.children.some(
        (item) =>
          item.id === nodeId ||
          item.children.some((child) => child.id === nodeId)
      );
    });

    if (parentList) {
      // Toggle off: convert list back to paragraph
      convertBlock(parentList.id, 'paragraph');
    } else {
      // Toggle on: convert current block to list.
      // If it's a heading, first convert to paragraph (lists don't nest headings).
      const block = findNode(doc, nodeId);
      if (block?.type === 'heading') {
        convertBlock(nodeId, 'paragraph');
      }
      convertBlock(nodeId, 'list', { ordered });
    }
  };

  // ── Link handlers ──────────────────────────────────────────
  const handleLinkButton = () => {
    // 1) First: check if cursor is inside an existing link → edit it
    const { nodeId, offset } = cursor.position;
    if (nodeId) {
      const block = findNode(doc, nodeId);
      if (block && (block.type === 'paragraph' || block.type === 'heading')) {
        const textBlock = block as Paragraph | Heading;
        let accumulated = 0;
        for (const run of textBlock.children) {
          if (offset < accumulated + run.content.length) {
            if (run.href && run.marks.includes('link')) {
              linkSelectionRef.current = {
                blockId: block.id,
                start: accumulated,
                end: accumulated + run.content.length,
              };
              setLinkUrl(run.href);
              setShowLinkPopup(true);
              return;
            }
            break;
          }
          accumulated += run.content.length;
        }
      }
    }

    // 2) No link under cursor: check if there's a selection to add a link
    if (hasSelection) {
      const { start, end } = getSelectionRange(selection!, doc);
      linkSelectionRef.current = {
        blockId: start.nodeId,
        start: start.offset,
        end: end.offset,
      };
      setLinkUrl('');
      setShowLinkPopup(true);
      return;
    }
  };

  const handleLinkSubmit = () => {
    const url = linkUrl.trim();

    try {
      if (linkSelectionRef.current) {
        if (!url) {
          // Empty URL → remove the link
          removeLink(linkSelectionRef.current.blockId, linkSelectionRef.current.start, linkSelectionRef.current.end);
        } else {
          setLink(linkSelectionRef.current.blockId, linkSelectionRef.current.start, linkSelectionRef.current.end, url);
        }
      } else if (pendingLinkRange) {
        if (!url) {
          removeLink(pendingLinkRange.blockId, pendingLinkRange.startOffset, pendingLinkRange.endOffset);
        } else {
          setLink(pendingLinkRange.blockId, pendingLinkRange.startOffset, pendingLinkRange.endOffset, url);
        }
      } else {
        return;
      }
    } catch (err) {
      console.error('[Link] operation failed:', err);
      return;
    }

    setShowLinkPopup(false);
    setLinkUrl('');
    linkSelectionRef.current = null;
    deactivateLinkPopup();
  };

  const handleLinkCancel = () => {
    setShowLinkPopup(false);
    setLinkUrl('');
    linkSelectionRef.current = null;
    deactivateLinkPopup();
  };

  const handleLinkKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLinkSubmit();
    } else if (e.key === 'Escape') {
      handleLinkCancel();
    }
  };

  const handleInsertTable = (rows: number, cols: number) => {
    if (!hasCursor) return;
    insertTable(cursor.position.nodeId, rows, cols);
    setShowTablePicker(false);
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

      {/* Link */}
      <div className="toolbar-group" style={{ position: 'relative' }}>
        <button
          className={`toolbar-btn${showLinkPopup ? ' toolbar-btn-active' : ''}`}
          onClick={handleLinkButton}
          disabled={!hasCursor && !hasSelection}
          title="Link (Ctrl+K)"
        >
          🔗
        </button>
        {showLinkPopup && (
          <div
            className="link-popup"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              zIndex: 1000,
              background: '#fff',
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '8px',
              display: 'flex',
              gap: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            <input
              ref={linkInputRef}
              type="text"
              className="link-popup-input"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={handleLinkKeyDown}
              placeholder="https://..."
              style={{
                padding: '4px 8px',
                border: '1px solid #ccc',
                borderRadius: '3px',
                fontSize: '13px',
                width: '200px',
              }}
            />
            <button
              className="toolbar-btn"
              onClick={handleLinkSubmit}
              style={{ padding: '4px 8px', fontSize: '13px' }}
            >
              OK
            </button>
            <button
              className="toolbar-btn"
              onClick={handleLinkCancel}
              style={{ padding: '4px 8px', fontSize: '13px' }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="toolbar-separator" />

      {/* Alignment */}
      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          onClick={() => {
            const selectedTable = useEditorStore.getState().selectedTableId;
            if (selectedTable) {
              setBlockAttrs(selectedTable, { textAlign: 'left' });
            } else if (hasSelection) {
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
          disabled={!selectedTableId && !hasCursor && !hasSelection}
          title="Alinear a la izquierda"
        >
          <span className="align-icon"><span className="align-line" style={{ width: '60%' }} /><span className="align-line" style={{ width: '80%' }} /><span className="align-line" /></span>
        </button>
        <button
          className="toolbar-btn"
          onClick={() => {
            const selectedTable = useEditorStore.getState().selectedTableId;
            if (selectedTable) {
              setBlockAttrs(selectedTable, { textAlign: 'center' });
            } else if (hasSelection) {
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
          disabled={!selectedTableId && !hasCursor && !hasSelection}
          title="Centrar"
        >
          <span className="align-icon align-icon-center"><span className="align-line" style={{ width: '60%' }} /><span className="align-line" style={{ width: '80%' }} /><span className="align-line" /></span>
        </button>
        <button
          className="toolbar-btn"
          onClick={() => {
            const selectedTable = useEditorStore.getState().selectedTableId;
            if (selectedTable) {
              setBlockAttrs(selectedTable, { textAlign: 'right' });
            } else if (hasSelection) {
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
          disabled={!selectedTableId && !hasCursor && !hasSelection}
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

      {/* Lists */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn${activeBlockType === 'list-ul' ? ' toolbar-btn-active' : ''}`}
          onClick={() => handleToggleList(false)}
          disabled={!hasCursor}
          title="Bullet List"
        >
          <span className="toolbar-list-icon">&#x2022;</span>
        </button>
        <button
          className={`toolbar-btn${activeBlockType === 'list-ol' ? ' toolbar-btn-active' : ''}`}
          onClick={() => handleToggleList(true)}
          disabled={!hasCursor}
          title="Numbered List"
        >
          <span className="toolbar-list-icon toolbar-list-icon-ol">1.</span>
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* Font — shows active value from cursor position / sticky attrs */}
      <div className="toolbar-group">
        <select
          className="toolbar-select"
          value={effectiveAttrs.fontFamily ?? 'Georgia'}
          onChange={(e) => handleSetStyle('fontFamily', e.target.value || undefined)}
          title="Font Family"
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        <select
          className="toolbar-select toolbar-select-small"
          value={effectiveAttrs.fontSize ? String(effectiveAttrs.fontSize) : '16'}
          onChange={(e) => handleSetStyle('fontSize', e.target.value ? Number(e.target.value) : undefined)}
          title="Font Size"
        >
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="toolbar-separator" />

      {/* Text Color — shows active value from cursor position / sticky attrs */}
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

      {/* Highlight (background) Color */}
      <div className="toolbar-group">
        <label className="toolbar-color-label" title="Highlight Color">
          <span style={{
            backgroundColor: effectiveAttrs.backgroundColor ?? '#fff7d6',
            padding: '0 2px',
          }}>
            <span style={{ color: '#000' }}>A</span>
          </span>
          <input
            type="color"
            className="toolbar-color-input"
            value={effectiveAttrs.backgroundColor ?? '#ffff00'}
            onChange={(e) => handleSetStyle('backgroundColor', e.target.value)}
          />
        </label>
        {effectiveAttrs.backgroundColor && (
          <button
            className="toolbar-btn"
            onClick={() => handleSetStyle('backgroundColor', undefined)}
            title="Remove highlight"
            style={{ fontSize: '14px', width: '24px', height: '24px', marginLeft: '2px' }}
          >
            ×
          </button>
        )}
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
        </select>
      </div>

      <div className="toolbar-separator" />

      {/* Table */}
      <div className="toolbar-group" style={{ position: 'relative' }}>
        <button
          className="toolbar-btn toolbar-btn-table"
          onClick={() => setShowTablePicker(!showTablePicker)}
          title="Insert Table"
        >
          ⊞
        </button>
        {showTablePicker && (
          <div
            className="table-picker-popover"
            ref={tablePickerRef}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div
              className="table-picker-grid"
              onMouseLeave={() => { setHoveredRow(-1); setHoveredCol(-1); }}
            >
              {Array.from({ length: 25 }, (_, i) => {
                const r = Math.floor(i / 5);
                const c = i % 5;
                const isActive = r <= hoveredRow && c <= hoveredCol;
                return (
                  <div
                    key={i}
                    className={`table-picker-cell${hoveredRow >= 0 && hoveredCol >= 0 && isActive ? ' active' : ''}`}
                    onMouseEnter={() => { setHoveredRow(r); setHoveredCol(c); }}
                    onClick={() => handleInsertTable(r + 1, c + 1)}
                  />
                );
              })}
            </div>
            {hoveredRow >= 0 && hoveredCol >= 0 && (
              <div className="table-picker-label">
                {hoveredRow + 1} × {hoveredCol + 1}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
