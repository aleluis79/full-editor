import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentStore } from '../stores/document-store';
import { useEditorStore } from '../stores/editor-store';
import { getSelectionRange, isSelectionEmpty } from '../core/selection';
import { getRunStylesAtOffset, findNode, getBlockNodes } from '../core/document';
import { exportPDF, addCustomWord } from '../api/client';
import { usePageStore } from '../stores/page-store';
import { useLayoutStore } from '../stores/layout-store';
import { useCommentStore } from '../stores/comment-store';
import { useSpellCheckStore } from '../stores/spell-check-store';
import { SpellCheckPopover } from './SpellCheckPopover';
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
  PageNumber,
  TotalPages,
  DateIcon,
  TimeIcon,
} from './icons';
import { PageSettingsPopup } from './PageSettingsPopup';
import { ShareDialog } from './ShareDialog';
import { ManageDictionaryPopup } from './ManageDictionaryPopup';
import { insertTokenAtCursor, toggleMarkOnRuns } from '../core/header-footer-ops';

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
  const { t, i18n } = useTranslation('toolbar');
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
  const editingHeaderFooter = usePageStore((s) => s.editingHeaderFooter);
  const setEditingHeaderFooter = usePageStore((s) => s.setEditingHeaderFooter);
  const updateHeaderFooterRuns = usePageStore((s) => s.updateHeaderFooterRuns);

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

  // ── Spell check state ──────────────────────────────────────
  const spellCheckEnabled = useSpellCheckStore((s) => s.enabled);
  const spellCheckToggle = useSpellCheckStore((s) => s.toggle);
  const spellCheckPopover = useSpellCheckStore((s) => s.popover);
  const popoverPosition = useSpellCheckStore((s) => s.popoverPosition);
  const hideSpellCheckPopover = useSpellCheckStore((s) => s.hidePopover);
  const [showDictionaryManager, setShowDictionaryManager] = useState(false);

  const replaceTextWithSuggestion = useCallback(
    (blockId: string, start: number, end: number, replacement: string) => {
      if (!blockId) {
        console.warn('[SpellCheck] Invalid suggestion data', { blockId, start, end, replacement });
        hideSpellCheckPopover();
        return;
      }
      const doc = useDocumentStore.getState();
      if (doc.replaceSelection) {
        const selection: import('../core/types').Selection = {
          anchor: { nodeId: blockId, offset: start },
          focus: { nodeId: blockId, offset: end },
        };
        doc.replaceSelection(selection, replacement);
      }
      hideSpellCheckPopover();
    },
    [hideSpellCheckPopover],
  );

  const handleAddToDictionary = useCallback(
    async (word: string) => {
      if (!word) return;
      try {
        const lang = i18n.language?.startsWith('es') ? 'es' : 'en';
        await addCustomWord(word, lang);
        useSpellCheckStore.getState().addCustomWord(word);
      } catch {
        // Fallback: add locally even if API fails
        useSpellCheckStore.getState().addCustomWord(word);
      }
      hideSpellCheckPopover();
    },
    [hideSpellCheckPopover, i18n.language],
  );

  // ── Image input ref ────────────────────────────────────────
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      uploadAndInsertImage(selectedFile).catch((err: Error) => alert(t(`errors:${err.message}`, { defaultValue: err.message })));
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
  const activeStyles = (() => {
    const { nodeId, offset } = cursor.position;
    if (!nodeId) return null;

    const block = findNode(doc, nodeId);
    if (!block || (block.type !== 'paragraph' && block.type !== 'heading')) return null;

    return getRunStylesAtOffset(block as Paragraph | Heading, offset);
  })();

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
      clearStickyMarks();
    } else {
      toggleStickyMark(mark);
    }
  };

  const handleSetStyle = (key: keyof StyleAttrs, value: string | number | undefined) => {
    if (hasSelection) {
      const { start, end } = getSelectionRange(selection!, doc);
      setStyle(start.nodeId, start.offset, end.offset, key, value, end.nodeId);
      clearStickyMarks();
    } else if (hasCursor) {
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

    if (hasSelection) {
      const { start, end } = getSelectionRange(selection!, doc);
      if (start.nodeId !== end.nodeId) {
        convertRangeToList(start.nodeId, end.nodeId, ordered);
        return;
      }
    }

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
      convertBlock(parentList.id, 'paragraph');
    } else {
      const block = findNode(doc, nodeId);
      if (block?.type === 'heading') {
        convertBlock(nodeId, 'paragraph');
      }
      convertBlock(nodeId, 'list', { ordered });
    }
  };

  // ── Link handlers ──────────────────────────────────────────
  const handleLinkButton = () => {
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
            height: headerFooter.header.height * 72 / 96,
            attrs: headerFooter.header.attrs,
          },
          footer: {
            runs: headerFooter.footer.runs.map(r => ({
              content: r.content,
              marks: r.marks,
              attrs: r.attrs,
            })),
            height: headerFooter.footer.height * 72 / 96,
            attrs: headerFooter.footer.attrs,
          },
          scope: 'all',
        } : undefined,
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

  const effectiveLineHeight = useMemo(() => {
    const { nodeId } = cursor.position;
    if (!nodeId) return LINE_HEIGHT_DEFAULTS.paragraph;
    const block = findNode(doc, nodeId);
    if (!block) return LINE_HEIGHT_DEFAULTS.paragraph;
    const explicit = (block as Paragraph | Heading).attrs?.lineHeight;
    if (explicit !== undefined) return explicit;
    return block.type === 'heading' ? LINE_HEIGHT_DEFAULTS.heading : LINE_HEIGHT_DEFAULTS.paragraph;
  }, [doc, cursor.position.nodeId]);

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

  const handleToolbarMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) {
      e.preventDefault();
    }
  }, []);

  // Header/footer editing mode — show marks + tokens, hide document-specific buttons
  const isHfMode = editingHeaderFooter !== null;

  const handleInsertHfToken = useCallback((token: string) => {
    if (!editingHeaderFooter) return;
    const hf = usePageStore.getState().config.headerFooter;
    const target = editingHeaderFooter;
    const currentRuns = target === 'header' ? hf.header.runs : hf.footer.runs;
    const cursorOffset = usePageStore.getState().hfCursorOffset;
    const newRuns = insertTokenAtCursor(currentRuns, cursorOffset, token);
    updateHeaderFooterRuns(target, newRuns);
    usePageStore.getState().setHfCursorOffset(cursorOffset + token.length);
  }, [editingHeaderFooter, updateHeaderFooterRuns]);

  // Header/footer mark toggle — operates on runs instead of document
  const handleToggleHfMark = useCallback((mark: MarkType) => {
    if (!editingHeaderFooter) return;
    const hf = usePageStore.getState().config.headerFooter;
    const target = editingHeaderFooter;
    const currentRuns = target === 'header' ? hf.header.runs : hf.footer.runs;
    // Apply mark to all runs (simplified: no selection support yet)
    const newRuns = toggleMarkOnRuns(currentRuns, 0, currentRuns.reduce((sum, r) => sum + r.content.length, 0), mark);
    updateHeaderFooterRuns(target, newRuns);
  }, [editingHeaderFooter, updateHeaderFooterRuns]);

  // Header/footer alignment — stored in header/footer attrs
  const handleSetHfAlignment = useCallback((align: 'left' | 'center' | 'right') => {
    if (!editingHeaderFooter) return;
    const hf = usePageStore.getState().config.headerFooter;
    const target = editingHeaderFooter;
    const currentConfig = target === 'header' ? hf.header : hf.footer;
    // Update alignment in attrs
    const newConfig = {
      ...currentConfig,
      attrs: { ...currentConfig.attrs, textAlign: align },
    };
    if (target === 'header') {
      usePageStore.getState().updateHeaderFooter({ header: newConfig });
    } else {
      usePageStore.getState().updateHeaderFooter({ footer: newConfig });
    }
  }, [editingHeaderFooter]);

  return (
    <div className="toolbar" onMouseDown={handleToolbarMouseDown}>
      {/* Document controls */}
      <div className="toolbar-group">
        {onBack && (
          <button
            className="toolbar-btn toolbar-btn-back"
            onClick={onBack}
            title={t('backToDocuments')}
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
            title={t('editTitle')}
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
            title={isSaving ? t('saving') : t('save')}
          >
            {isSaving ? '⏳' : <Save />}
          </button>
          <button
            className="toolbar-btn"
            onClick={handleExportPDF}
            title={t('exportPdf')}
          >
            <Pdf />
          </button>
          <button
            className="toolbar-btn"
            onClick={() => setShowShareDialog(true)}
            title={t('shareDocument')}
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
              onClick={async () => {
                if (!commentVisible) {
                  try {
                    await useDocumentStore.getState().saveDocument();
                  } catch (err) {
                    console.error('Save failed before opening comments:', err);
                  }
                }
                toggleCommentVisibility();
                if (!commentVisible) {
                  const docId = useDocumentStore.getState().currentDocId;
                  if (docId) fetchComments(docId);
                }
              }}
              title={t('toggleComments')}
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
            title={t('pageSettings')}
          >
            <Settings />
          </button>
          {showPageSettings && (
            <PageSettingsPopup onClose={() => setShowPageSettings(false)} />
          )}
        </div>
      )}

      <div className="toolbar-separator" />

      {/* Text formatting */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn${effectiveMarks.has('bold') ? ' toolbar-btn-active' : ''}`}
          onClick={() => isHfMode ? handleToggleHfMark('bold') : handleToggleMark('bold')}
          title={t('boldTooltip')}
        >
          <Bold />
        </button>
        <button
          className={`toolbar-btn${effectiveMarks.has('italic') ? ' toolbar-btn-active' : ''}`}
          onClick={() => isHfMode ? handleToggleHfMark('italic') : handleToggleMark('italic')}
          title={t('italicTooltip')}
        >
          <Italic />
        </button>
        <button
          className={`toolbar-btn${effectiveMarks.has('underline') ? ' toolbar-btn-active' : ''}`}
          onClick={() => isHfMode ? handleToggleHfMark('underline') : handleToggleMark('underline')}
          title={t('underlineTooltip')}
        >
          <Underline />
        </button>
        {!isHfMode && (
          <>
            <button
              className={`toolbar-btn${effectiveMarks.has('strikethrough') ? ' toolbar-btn-active' : ''}`}
              onClick={() => handleToggleMark('strikethrough')}
              title={t('strikethroughTooltip')}
            >
              <Strikethrough />
            </button>
            <button
              className={`toolbar-btn${effectiveMarks.has('superscript') ? ' toolbar-btn-active' : ''}`}
              onClick={() => handleToggleMark('superscript')}
              title={t('superscriptTooltip')}
            >
              <Superscript />
            </button>
            <button
              className={`toolbar-btn${effectiveMarks.has('subscript') ? ' toolbar-btn-active' : ''}`}
              onClick={() => handleToggleMark('subscript')}
              title={t('subscriptTooltip')}
            >
              <Subscript />
            </button>
          </>
        )}
      </div>

      <div className="toolbar-separator" />

      {/* Token buttons — only visible in header/footer editing mode */}
      {isHfMode && (
        <div className="toolbar-group">
          <button
            className="toolbar-btn"
            data-testid="toolbar-token-pageNumber"
            onClick={() => handleInsertHfToken('{pageNumber}')}
            title="Insert page number"
          >
            <PageNumber />
          </button>
          <button
            className="toolbar-btn"
            data-testid="toolbar-token-totalPages"
            onClick={() => handleInsertHfToken('{totalPages}')}
            title="Insert total pages"
          >
            <TotalPages />
          </button>
          <button
            className="toolbar-btn"
            data-testid="toolbar-token-date"
            onClick={() => handleInsertHfToken('{date}')}
            title="Insert date"
          >
            <DateIcon />
          </button>
          <button
            className="toolbar-btn"
            data-testid="toolbar-token-time"
            onClick={() => handleInsertHfToken('{time}')}
            title="Insert time"
          >
            <TimeIcon />
          </button>
        </div>
      )}

      {/* Alignment buttons — only visible in header/footer editing mode */}
      {isHfMode && (
        <div className="toolbar-group">
          <button
            className="toolbar-btn"
            onClick={() => handleSetHfAlignment('left')}
            title="Align left"
          >
            <AlignLeft />
          </button>
          <button
            className="toolbar-btn"
            onClick={() => handleSetHfAlignment('center')}
            title="Align center"
          >
            <AlignCenter />
          </button>
          <button
            className="toolbar-btn"
            onClick={() => handleSetHfAlignment('right')}
            title="Align right"
          >
            <AlignRight />
          </button>
        </div>
      )}

      {isHfMode && <div className="toolbar-separator" />}

      {/* Link */}
      {!isHfMode && (
      <div className="toolbar-group" style={{ position: 'relative' }}>
        <button
          className={`toolbar-btn${showLinkPopup ? ' toolbar-btn-active' : ''}`}
          onClick={handleLinkButton}
          disabled={!hasCursor && !hasSelection}
          title={t('linkTooltip')}
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
              placeholder={t('linkPlaceholder')}
            />
            <button
              className="toolbar-btn"
              onClick={handleLinkSubmit}
            >
              {t('linkOk')}
            </button>
            <button
              className="toolbar-btn"
              onClick={handleLinkCancel}
            >
              {t('linkCancel')}
            </button>
          </div>
        )}
      </div>
      )}

      {!isHfMode && <div className="toolbar-separator" />}

      {/* Alignment */}
      {!isHfMode && (
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
          title={t('alignLeftTooltip')}
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
          title={t('alignCenterTooltip')}
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
          title={t('alignRightTooltip')}
        >
          <AlignRight />
        </button>
      </div>
      )}

      {/* Line spacing */}
      {!isHfMode && (
      <div className="toolbar-group" style={{ position: 'relative' }}>
        <button
          className={`toolbar-btn${hasNonDefaultLineHeight || showLineSpacing ? ' toolbar-btn-active' : ''}`}
          onClick={() => setShowLineSpacing(!showLineSpacing)}
          disabled={!selectedTableId && !hasCursor && !hasSelection}
          title={t('lineSpacingTooltip')}
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
      )}

      {!isHfMode && <div className="toolbar-separator" />}

      {!isHfMode && (
      <>
      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          onClick={handleClearFormatting}
          disabled={!hasSelection && stickyMarks.length === 0 && Object.keys(stickyAttrs).length === 0}
          title={t('clearFormattingTooltip')}
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
          title={t('bulletListTooltip')}
        >
          <ListUl />
        </button>
        <button
          className={`toolbar-btn${activeBlockType === 'list-ol' ? ' toolbar-btn-active' : ''}`}
          onClick={() => handleToggleList(true)}
          disabled={!hasCursor}
          title={t('numberedListTooltip')}
        >
          <ListOl />
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* Font */}
      <div className="toolbar-group">
        <select
          className="toolbar-select"
          value={effectiveAttrs.fontFamily ?? 'Georgia'}
          onChange={(e) => handleSetStyle('fontFamily', e.target.value || undefined)}
          title={t('fontFamilyTooltip')}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        <select
          className="toolbar-select toolbar-select-small"
          value={effectiveAttrs.fontSize ? String(effectiveAttrs.fontSize) : '16'}
          onChange={(e) => handleSetStyle('fontSize', e.target.value ? Number(e.target.value) : undefined)}
          title={t('fontSizeTooltip')}
        >
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="toolbar-separator" />

      {/* Text Color */}
      <div className="toolbar-group">
        <label className="toolbar-color-label" title={t('textColorTooltip')}>
          <span style={{ color: effectiveAttrs.color ?? '#000' }}>A</span>
          <input
            type="color"
            className="toolbar-color-input"
            value={effectiveAttrs.color ?? '#000000'}
            onChange={(e) => handleSetStyle('color', e.target.value)}
          />
        </label>
      </div>

      {/* Highlight Color */}
      <div className="toolbar-group">
        <label className="toolbar-color-label" title={t('highlightColorTooltip')}>
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
            title={t('removeHighlightTooltip')}
          >
            ×
          </button>
        )}
      </div>

      <div className="toolbar-separator" />

      {/* Block types */}
      <div className="toolbar-group" style={{ position: 'relative', zIndex: 100 }}>
        <button
          className="toolbar-btn toolbar-btn-select"
          onClick={() => { if (hasCursor) setShowBlockPicker(!showBlockPicker); }}
          disabled={!hasCursor}
          title={t('blockTypeTooltip')}
        >
          <span style={{ flex: 1 }}>
            {activeBlockType === 'paragraph' && t('paragraphLabel')}
            {activeBlockType === 'heading1' && t('heading1Label')}
            {activeBlockType === 'heading2' && t('heading2Label')}
            {activeBlockType === 'heading3' && t('heading3Label')}
            {activeBlockType === 'blockquote' && t('blockquoteLabel')}
            {activeBlockType === 'list-ul' && t('bulletListLabel')}
            {activeBlockType === 'list-ol' && t('numberedListLabel')}
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
              {t('paragraphLabel')}
            </button>
            <button
              className={`block-picker-item${activeBlockType === 'heading1' ? ' active' : ''}`}
              onClick={() => { handleConvertBlock('heading', { level: 1 }); setShowBlockPicker(false); }}
              style={{ fontSize: 22, fontWeight: 'bold' }}
            >
              {t('heading1Label')}
            </button>
            <button
              className={`block-picker-item${activeBlockType === 'heading2' ? ' active' : ''}`}
              onClick={() => { handleConvertBlock('heading', { level: 2 }); setShowBlockPicker(false); }}
              style={{ fontSize: 18, fontWeight: 'bold' }}
            >
              {t('heading2Label')}
            </button>
            <button
              className={`block-picker-item${activeBlockType === 'heading3' ? ' active' : ''}`}
              onClick={() => { handleConvertBlock('heading', { level: 3 }); setShowBlockPicker(false); }}
              style={{ fontSize: 15, fontWeight: 'bold' }}
            >
              {t('heading3Label')}
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
          title={t('insertImageTooltip')}
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
          title={t('insertTableTooltip')}
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

      {/* Spell check toggle & dictionary */}
      <div className="toolbar-separator" />
      <div className="toolbar-group" style={{ position: 'relative' }}>
        <button
          className={`toolbar-btn${spellCheckEnabled ? ' toolbar-btn-active' : ''}`}
          onClick={spellCheckToggle}
          title={spellCheckEnabled ? t('spellCheckDisable') : t('spellCheckEnable')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </button>
        <button
          className={`toolbar-btn${showDictionaryManager ? ' toolbar-btn-active' : ''}`}
          onClick={() => setShowDictionaryManager(!showDictionaryManager)}
          title={t('manageDictionary')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </button>
        {showDictionaryManager && (
          <ManageDictionaryPopup onClose={() => setShowDictionaryManager(false)} />
        )}
      </div>
      </>
      )}

      {/* Spell check popover — rendered at toolbar level for z-index */}
      {spellCheckPopover && popoverPosition && (
        <SpellCheckPopover
          position={popoverPosition}
          popover={spellCheckPopover}
          onSelect={replaceTextWithSuggestion}
          onAddToDictionary={handleAddToDictionary}
          onClose={hideSpellCheckPopover}
        />
      )}

      {/* Share dialog */}
      <ShareDialog
        documentId={currentDocId || ''}
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
      />
    </div>
  );
}
