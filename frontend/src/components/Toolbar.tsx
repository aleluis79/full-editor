import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDocumentStore } from '../stores/document-store';
import { useEditorStore } from '../stores/editor-store';
import { getSelectionRange, isSelectionEmpty } from '../core/selection';
import { getRunStylesAtOffset, findNode, getBlockNodes } from '../core/document';
import { exportPDF } from '../api/client';
import { usePageStore } from '../stores/page-store';
import { useLayoutStore } from '../stores/layout-store';
import { useCommentStore } from '../stores/comment-store';
import type { MarkType, StyleAttrs, BlockType, Paragraph, Heading } from '../core/types';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Superscript,
  Subscript,
  Link,
  Image,
  Table,
  ListUl,
  ListOl,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ClearFormatting,
  Save,
  Pdf,
  Back,
  LineHeight,
  Settings,
  Comment,
} from './icons';
import { PageSettingsPopup } from './PageSettingsPopup';
import { ShareDialog } from './ShareDialog';

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
  const uploadAndInsertImage = useDocumentStore((s) => s.uploadAndInsertImage);

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

  // ── Share dialog state ─────────────────────────────────────
  const commentVisible = useCommentStore((s) => s.visible);
  const toggleCommentVisibility = useCommentStore((s) => s.toggleVisibility);
  const fetchComments = useCommentStore((s) => s.fetchComments);
  const currentDocIdFromStore = useDocumentStore((s) => s.currentDocId);

  const [showShareDialog, setShowShareDialog] = useState(false);
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

  // ── Image input ref ────────────────────────────────────────
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      uploadAndInsertImage(selectedFile).catch((err: Error) => alert(err.message));
    }
    // Reset so the same file can be selected again
    e.target.value = '';
  }, [uploadAndInsertImage]);

  // ── Table picker state ─────────────────────────────────────
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(-1);
  const [hoveredCol, setHoveredCol] = useState(-1);
  const tablePickerRef = useRef<HTMLDivElement>(null);
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const blockPickerRef = useRef<HTMLDivElement>(null);

  // ── Page settings popup state ──────────────────────────────────
  const [showPageSettings, setShowPageSettings] = useState(false);
  const pageSettingsRef = useRef<HTMLDivElement>(null);

  // ── Line spacing popup state ──────────────────────────────────
  const LINE_SPACING_PRESETS = [1.0, 1.15, 1.5, 2.0, 2.5, 3.0] as const;
  const [showLineSpacing, setShowLineSpacing] = useState(false);
  const lineSpacingRef = useRef<HTMLDivElement>(null);

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

  // Close block picker on outside click
  useEffect(() => {
    if (!showBlockPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (blockPickerRef.current && !blockPickerRef.current.contains(e.target as Node)) {
        setShowBlockPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBlockPicker]);

  // Close page settings popup on outside click
  useEffect(() => {
    if (!showPageSettings) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (pageSettingsRef.current && !pageSettingsRef.current.contains(e.target as Node)) {
        setShowPageSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPageSettings]);

  // Close line spacing popup on outside click
  useEffect(() => {
    if (!showLineSpacing) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (lineSpacingRef.current && !lineSpacingRef.current.contains(e.target as Node)) {
        setShowLineSpacing(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLineSpacing]);

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

  // ── Line spacing handlers ──────────────────────────────────
  const handleLineSpacingSelect = (value: number | undefined) => {
    if (selectedTableId) {
      setBlockAttrs(selectedTableId, { lineHeight: value });
    } else if (hasSelection) {
      const startBlock = selection!.anchor.nodeId;
      const endBlock = selection!.focus.nodeId;
      if (startBlock !== endBlock) {
        setBlockAttrsRange(startBlock, endBlock, { lineHeight: value });
      } else {
        setBlockAttrs(startBlock, { lineHeight: value });
      }
    } else if (hasCursor) {
      setBlockAttrs(cursor.position.nodeId, { lineHeight: value });
    }
    setShowLineSpacing(false);
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
      const { paperSize, margins, orientation } = usePageStore.getState().config;

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
      }, filename);
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

  // ── Current lineHeight from cursor position (for toolbar display) ──
  const LINE_HEIGHT_DEFAULTS = { paragraph: 1.5, heading: 1.2 } as const;
  const currentExplicitLineHeight = useMemo(() => {
    const { nodeId } = cursor.position;
    if (!nodeId) return undefined;
    const block = findNode(doc, nodeId);
    if (!block || (block.type !== 'paragraph' && block.type !== 'heading')) return undefined;
    return (block as Paragraph | Heading).attrs?.lineHeight;
  }, [doc, cursor.position.nodeId]);

  /** The effective lineHeight shown in the popup — falls back to block-type default */
  const effectiveLineHeight = useMemo(() => {
    const { nodeId } = cursor.position;
    if (!nodeId) return LINE_HEIGHT_DEFAULTS.paragraph;
    const block = findNode(doc, nodeId);
    if (!block) return LINE_HEIGHT_DEFAULTS.paragraph;
    const explicit = (block as Paragraph | Heading).attrs?.lineHeight;
    if (explicit !== undefined) return explicit;
    return block.type === 'heading' ? LINE_HEIGHT_DEFAULTS.heading : LINE_HEIGHT_DEFAULTS.paragraph;
  }, [doc, cursor.position.nodeId]);

  /** True when the block has an explicit lineHeight different from default */
  const hasNonDefaultLineHeight = useMemo(() => {
    const { nodeId } = cursor.position;
    if (!nodeId) return false;
    const block = findNode(doc, nodeId);
    if (!block || (block.type !== 'paragraph' && block.type !== 'heading')) return false;
    const explicit = (block as Paragraph | Heading).attrs?.lineHeight;
    if (explicit === undefined) return false;
    const def = block.type === 'heading' ? LINE_HEIGHT_DEFAULTS.heading : LINE_HEIGHT_DEFAULTS.paragraph;
    return explicit !== def;
  }, [doc, cursor.position.nodeId]);

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
  // element inside the button (e.g. SVG, path, span).
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
            <Back />
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
            {isSaving ? '⏳' : <Save />}
          </button>
          <button
            className="toolbar-btn"
            onClick={handleExportPDF}
            title="Exportar a PDF"
          >
            <Pdf />
          </button>
          <button
            className="toolbar-btn"
            onClick={() => setShowShareDialog(true)}
            title="Compartir documento"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>
          {currentDocIdFromStore && (
            <button
              className={`toolbar-btn${commentVisible ? ' toolbar-btn-active' : ''}`}
              onClick={() => {
                toggleCommentVisibility();
                if (!commentVisible && currentDocIdFromStore) {
                  fetchComments(currentDocIdFromStore);
                }
              }}
              title="Toggle comments"
            >
              <Comment />
            </button>
          )}
        </div>
      )}

      <div className="toolbar-separator" />

      {currentDocId && (
        <div className="toolbar-group" style={{ position: 'relative' }}>
          <button
            className="toolbar-btn"
            onClick={() => setShowPageSettings(!showPageSettings)}
            title="Page settings"
          >
            <Settings />
          </button>
          {showPageSettings && (
            <PageSettingsPopup onClose={() => setShowPageSettings(false)} />
          )}
        </div>
      )}

      <div className="toolbar-separator" />

      {/* Text formatting — active state reflects cursor position OR sticky marks */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn${effectiveMarks.has('bold') ? ' toolbar-btn-active' : ''}`}
          onClick={() => handleToggleMark('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold />
        </button>
        <button
          className={`toolbar-btn${effectiveMarks.has('italic') ? ' toolbar-btn-active' : ''}`}
          onClick={() => handleToggleMark('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic />
        </button>
        <button
          className={`toolbar-btn${effectiveMarks.has('underline') ? ' toolbar-btn-active' : ''}`}
          onClick={() => handleToggleMark('underline')}
          title="Underline (Ctrl+U)"
        >
          <Underline />
        </button>
        <button
          className={`toolbar-btn${effectiveMarks.has('strikethrough') ? ' toolbar-btn-active' : ''}`}
          onClick={() => handleToggleMark('strikethrough')}
          title="Strikethrough"
        >
          <Strikethrough />
        </button>
        <button
          className={`toolbar-btn${effectiveMarks.has('superscript') ? ' toolbar-btn-active' : ''}`}
          onClick={() => handleToggleMark('superscript')}
          title="Superscript"
        >
          <Superscript />
        </button>
        <button
          className={`toolbar-btn${effectiveMarks.has('subscript') ? ' toolbar-btn-active' : ''}`}
          onClick={() => handleToggleMark('subscript')}
          title="Subscript"
        >
          <Subscript />
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
          <Link />
        </button>
        {showLinkPopup && (
          <div className="link-popup">
            <input
              ref={linkInputRef}
              type="text"
              className="link-popup-input"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={handleLinkKeyDown}
              placeholder="https://..."
            />
            <button
              className="toolbar-btn"
              onClick={handleLinkSubmit}
            >
              OK
            </button>
            <button
              className="toolbar-btn"
              onClick={handleLinkCancel}
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
          <AlignLeft />
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
          <AlignCenter />
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
          <AlignRight />
        </button>
      </div>

      {/* Line spacing */}
      <div className="toolbar-group" style={{ position: 'relative' }}>
        <button
          className={`toolbar-btn${hasNonDefaultLineHeight || showLineSpacing ? ' toolbar-btn-active' : ''}`}
          onClick={() => setShowLineSpacing(!showLineSpacing)}
          disabled={!selectedTableId && !hasCursor && !hasSelection}
          title="Line spacing"
        >
          <LineHeight />
        </button>
        {showLineSpacing && (
          <div
            className="line-spacing-popover"
            ref={lineSpacingRef}
            onMouseDown={(e) => e.preventDefault()}
          >
            {LINE_SPACING_PRESETS.map((value) => {
              const isActive = effectiveLineHeight === value;
              const label = value % 1 === 0 ? value.toFixed(1) : String(value);
              return (
                <button
                  key={value}
                  className={`line-spacing-item${isActive ? ' active' : ''}`}
                  onClick={() => handleLineSpacingSelect(currentExplicitLineHeight === value ? undefined : value)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          onClick={handleClearFormatting}
          disabled={!hasSelection && stickyMarks.length === 0 && Object.keys(stickyAttrs).length === 0}
          title="Clear Formatting"
        >
          <ClearFormatting />
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
          <ListUl />
        </button>
        <button
          className={`toolbar-btn${activeBlockType === 'list-ol' ? ' toolbar-btn-active' : ''}`}
          onClick={() => handleToggleList(true)}
          disabled={!hasCursor}
          title="Numbered List"
        >
          <ListOl />
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
            className="toolbar-btn toolbar-btn-highlight-remove"
            onClick={() => handleSetStyle('backgroundColor', undefined)}
            title="Remove highlight"
          >
            ×
          </button>
        )}
      </div>

      <div className="toolbar-separator" />

      {/* Block types — custom dropdown with styled options */}
      <div className="toolbar-group" style={{ position: 'relative', zIndex: 100 }}>
        <button
          className="toolbar-btn toolbar-btn-select"
          onClick={() => { if (hasCursor) setShowBlockPicker(!showBlockPicker); }}
          disabled={!hasCursor}
          title="Block Type"
        >
          <span style={{ flex: 1 }}>
            {activeBlockType === 'paragraph' && 'Paragraph'}
            {activeBlockType === 'heading1' && 'Heading 1'}
            {activeBlockType === 'heading2' && 'Heading 2'}
            {activeBlockType === 'heading3' && 'Heading 3'}
            {activeBlockType === 'blockquote' && 'Blockquote'}
            {activeBlockType === 'list-ul' && 'Bullet List'}
            {activeBlockType === 'list-ol' && 'Numbered List'}
          </span>
          <span style={{ fontSize: 10 }}>▼</span>
        </button>
        {showBlockPicker && (
          <div
            ref={blockPickerRef}
            className="block-picker-popover"
            onMouseDown={(e) => e.preventDefault()}
          >
            <button
              className={`block-picker-item${activeBlockType === 'paragraph' ? ' active' : ''}`}
              onClick={() => { handleConvertBlock('paragraph'); setShowBlockPicker(false); }}
            >
              Paragraph
            </button>
            <button
              className={`block-picker-item${activeBlockType === 'heading1' ? ' active' : ''}`}
              onClick={() => { handleConvertBlock('heading', { level: 1 }); setShowBlockPicker(false); }}
              style={{ fontSize: 22, fontWeight: 'bold' }}
            >
              Heading 1
            </button>
            <button
              className={`block-picker-item${activeBlockType === 'heading2' ? ' active' : ''}`}
              onClick={() => { handleConvertBlock('heading', { level: 2 }); setShowBlockPicker(false); }}
              style={{ fontSize: 18, fontWeight: 'bold' }}
            >
              Heading 2
            </button>
            <button
              className={`block-picker-item${activeBlockType === 'heading3' ? ' active' : ''}`}
              onClick={() => { handleConvertBlock('heading', { level: 3 }); setShowBlockPicker(false); }}
              style={{ fontSize: 15, fontWeight: 'bold' }}
            >
              Heading 3
            </button>
          </div>
        )}
      </div>

      <div className="toolbar-separator" />

      {/* Image insert */}
      <div className="toolbar-group">
        <input
          type="file"
          accept="image/*"
          ref={imageInputRef}
          style={{ display: 'none' }}
          onChange={handleImageSelect}
        />
        <button
          className="toolbar-btn"
          onClick={() => imageInputRef.current?.click()}
          title="Insert Image"
        >
          <Image />
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* Table */}
      <div className="toolbar-group" style={{ position: 'relative' }}>
        <button
          className="toolbar-btn toolbar-btn-table"
          onClick={() => setShowTablePicker(!showTablePicker)}
          title="Insert Table"
        >
          <Table />
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

      {/* Share dialog */}
      <ShareDialog
        documentId={currentDocId || ''}
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
      />
    </div>
  );
}
