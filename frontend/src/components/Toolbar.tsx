import { useDocumentStore } from '../stores/document-store';
import { useEditorStore } from '../stores/editor-store';
import { getSelectionRange, isSelectionEmpty } from '../core/selection';
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

export function Toolbar() {
  const selection = useEditorStore((s) => s.selection);
  const cursor = useEditorStore((s) => s.cursor);
  const toggleMark = useDocumentStore((s) => s.toggleMark);
  const setStyle = useDocumentStore((s) => s.setStyle);
  const clearFormattingAction = useDocumentStore((s) => s.clearFormatting);
  const insertBlock = useDocumentStore((s) => s.insertBlock);
  const convertBlock = useDocumentStore((s) => s.convertBlock);

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

  return (
    <div className="toolbar">
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

      <div className="toolbar-separator" />

      {/* Insert */}
      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          onClick={() => handleInsertBlock('horizontalRule')}
          disabled={!hasCursor}
          title="Insert Horizontal Rule"
        >
          ―
        </button>
      </div>
    </div>
  );
}
