import { useRef, useLayoutEffect, useState } from 'react';
import type { Table as TableType, TableRow as TableRowType, TableCell as TableCellType } from '../core/types';
import { useDocumentStore } from '../stores/document-store';
import { useEditorStore } from '../stores/editor-store';
import { isSelectionEmpty } from '../core/selection';
import { getBlockNodes } from '../core/document';

type BlockClickHandler = (blockId: string, clientX: number, clientY: number) => void;

interface TableBlockProps {
  block: TableType;
  activeBlockId: string | null;
  onBlockClick: BlockClickHandler;
  onDoubleClick: BlockClickHandler;
  onTripleClick: BlockClickHandler;
  onBlockMouseDown?: (blockId: string, e: React.MouseEvent) => void;
}

export function TableBlock({ block, activeBlockId, onBlockClick, onDoubleClick, onTripleClick, onBlockMouseDown }: TableBlockProps) {
  const deleteTableRow = useDocumentStore((s) => s.deleteTableRow);
  const addTableRow = useDocumentStore((s) => s.addTableRow);
  const addTableColumn = useDocumentStore((s) => s.addTableColumn);
  const resizeColumn = useDocumentStore((s) => s.resizeColumn);
  const cursor = useEditorStore((s) => s.cursor);
  const selectedTableId = useEditorStore((s) => s.selectedTableId);
  const selectTable = useEditorStore((s) => s.selectTable);

  // Edit mode: cursor inside this table's cells OR table is selected
  const isEditing = cursor.position.nodeId !== '' && block.rows.some((row) =>
    row.cells.some((cell) =>
      cell.children.some((p) => p.id === cursor.position.nodeId),
    ),
  );
  const isSelected = selectedTableId === block.id && !isEditing;

  const handleDeleteRow = (rowIndex: number) => {
    if (block.rows.length <= 1) return; // Don't delete last row
    deleteTableRow(block.id, rowIndex);
  };

  const handleAddRow = (afterRowIndex: number) => {
    addTableRow(block.id, afterRowIndex);
  };

  const handleAddColumn = (afterColumnIndex: number) => {
    addTableColumn(block.id, afterColumnIndex);
  };

  // ── Column resize drag state ──────────────────────────────
  const dragRef = useRef<{
    colIndex: number;
    startX: number;
    startWidth: number;
  } | null>(null);

  const handleResizeStart = (colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = block.columnWidths[colIndex];
    dragRef.current = { colIndex, startX: e.clientX, startWidth };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const newWidth = Math.max(40, dragRef.current.startWidth + dx);
      // Direct mutation during drag for responsiveness (no history entries)
      const state = useDocumentStore.getState();
      const clone = JSON.parse(JSON.stringify(state.document));
      const table = clone.children.find((c: any) => c.id === block.id);
      if (table) {
        table.columnWidths[dragRef.current.colIndex] = newWidth;
      }
      useDocumentStore.setState({ document: clone, isDirty: true });
      dragRef.current.startX = ev.clientX;
      dragRef.current.startWidth = newWidth;
    };

    const handleMouseUp = () => {
      if (dragRef.current) {
        // Save final width with history entry
        resizeColumn(block.id, dragRef.current.colIndex, dragRef.current.startWidth);
      }
      dragRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className={`table-block${isEditing ? ' table-block-editing' : isSelected ? ' table-block-selected' : ' table-block-readonly'}`}
      data-block-id={block.id}
      onMouseDown={(e) => {
        // Click on table wrapper → select the table (cell text clicks
        // deselect via setCursorPosition in handleBlockClick).
        // Stop propagation to prevent the editor's deselect handler.
        e.stopPropagation();
        selectTable(block.id);
      }}
    >
      <table className="table-grid" style={{
        marginLeft: block.attrs?.textAlign === 'center' ? 'auto' : block.attrs?.textAlign === 'right' ? 'auto' : undefined,
        marginRight: block.attrs?.textAlign === 'center' ? 'auto' : block.attrs?.textAlign === 'right' ? '0' : undefined,
      }}>
        <thead>
          <tr>
            {block.rows[0]?.cells.map((cell, colIndex) => (
              <TableCellComponent
                key={cell.id}
                cell={cell}
                colSpan={cell.colSpan}
                width={block.columnWidths[colIndex]}
                activeBlockId={activeBlockId}
                onBlockClick={onBlockClick}
                onDoubleClick={onDoubleClick}
                onTripleClick={onTripleClick}
                onBlockMouseDown={onBlockMouseDown}
                isHeader={true}
              >
                {isEditing && (
                  <div
                    className="column-resize-handle"
                    onMouseDown={(e) => handleResizeStart(colIndex, e)}
                  />
                )}
              </TableCellComponent>
            ))}
            {isEditing && (
              <th className="table-actions-cell">
                <button
                  className="table-action-btn"
                  onClick={() => handleAddColumn(block.columnWidths.length - 1)}
                  title="Add column"
                >
                  +
                </button>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {block.rows.slice(1).map((row, idx) => (
            <TableRowComponent
              key={row.id}
              row={row}
              rowIndex={idx + 1}
              columnWidths={block.columnWidths}
              activeBlockId={activeBlockId}
              onBlockClick={onBlockClick}
              onDoubleClick={onDoubleClick}
              onTripleClick={onTripleClick}
              onBlockMouseDown={onBlockMouseDown}
              onDeleteRow={handleDeleteRow}
              onAddRow={handleAddRow}
              editing={isEditing}
            />
          ))}
        </tbody>
      </table>

      {/* Row actions */}
      {isEditing && (
        <div className="table-row-actions">
          <button
            className="table-action-btn"
            onClick={() => handleAddRow(block.rows.length - 1)}
            title="Add row"
          >
            + Row
          </button>
        </div>
      )}
    </div>
  );
}

interface TableRowComponentProps {
  row: TableRowType;
  rowIndex: number;
  columnWidths: number[];
  activeBlockId: string | null;
  onBlockClick: BlockClickHandler;
  onDoubleClick: BlockClickHandler;
  onTripleClick: BlockClickHandler;
  onBlockMouseDown?: (blockId: string, e: React.MouseEvent) => void;
  onDeleteRow: (rowIndex: number) => void;
  onAddRow: (afterRowIndex: number) => void;
  editing: boolean;
}

function TableRowComponent({
  row,
  rowIndex,
  columnWidths,
  activeBlockId,
  onBlockClick,
  onDoubleClick,
  onTripleClick,
  onBlockMouseDown,
  onDeleteRow,
  onAddRow,
  editing,
}: TableRowComponentProps) {
  return (
    <tr className="table-row">
      {row.cells.map((cell, colIndex) => {
        // Skip merged cells
        if (cell.colSpan === 0 || cell.rowSpan === 0) {
          return null;
        }

        return (
          <TableCellComponent
            key={cell.id}
            cell={cell}
            colSpan={cell.colSpan}
            width={columnWidths[colIndex]}
            activeBlockId={activeBlockId}
            onBlockClick={onBlockClick}
            onDoubleClick={onDoubleClick}
            onTripleClick={onTripleClick}
            onBlockMouseDown={onBlockMouseDown}
          />
        );
      })}
      {editing && (
        <td className="table-row-actions-cell">
          <button
            className="table-action-btn table-action-btn-small"
            onClick={() => onDeleteRow(rowIndex)}
            title="Delete row"
          >
            ×
          </button>
          <button
            className="table-action-btn table-action-btn-small"
            onClick={() => onAddRow(rowIndex)}
            title="Add row after"
          >
            +
          </button>
        </td>
      )}
    </tr>
  );
}

interface TableCellComponentProps {
  cell: TableCellType;
  colSpan: number;
  width: number;
  activeBlockId: string | null;
  onBlockClick: BlockClickHandler;
  onDoubleClick: BlockClickHandler;
  onTripleClick: BlockClickHandler;
  onBlockMouseDown?: (blockId: string, e: React.MouseEvent) => void;
  isHeader?: boolean;
  children?: React.ReactNode;
}

function TableCellComponent({
  cell,
  colSpan,
  width,
  activeBlockId,
  onBlockClick,
  onDoubleClick,
  onTripleClick,
  onBlockMouseDown,
  isHeader,
  children,
}: TableCellComponentProps) {
  const isActive = cell.children.some((p) => p.id === activeBlockId);
  const cursor = useEditorStore((s) => s.cursor);
  const focused = useEditorStore((s) => s.focused);
  const selectedTableId = useEditorStore((s) => s.selectedTableId);
  const selectTable = useEditorStore((s) => s.selectTable);

  const CellTag = isHeader ? 'th' : 'td';

  return (
    <CellTag
      className={`table-cell ${isActive ? 'active' : ''}${isHeader ? ' table-header-cell' : ''}`}
      colSpan={colSpan}
      style={{ width }}
    >
      {cell.children.map((paragraph) => {
        const isCursorHere = focused && cursor.position.nodeId === paragraph.id;
        const cursorOffset = isCursorHere ? cursor.position.offset : 0;
        return (
          <TableCellParagraph
            key={paragraph.id}
            paragraph={paragraph}
            isCursorHere={isCursorHere}
            cursorOffset={cursorOffset}
            onClick={onBlockClick}
            onDoubleClick={onDoubleClick}
            onTripleClick={onTripleClick}
            onMouseDown={onBlockMouseDown ? (e: React.MouseEvent) => onBlockMouseDown(paragraph.id, e) : undefined}
          />
        );
      })}
      {children}
    </CellTag>
  );
}

interface TableCellParagraphProps {
  paragraph: import('../core/types').Paragraph;
  isCursorHere: boolean;
  cursorOffset: number;
  onClick: BlockClickHandler;
  onDoubleClick: BlockClickHandler;
  onTripleClick: BlockClickHandler;
  onMouseDown?: (e: React.MouseEvent) => void;
}

function TableCellParagraph({
  paragraph,
  isCursorHere,
  cursorOffset,
  onClick,
  onDoubleClick,
  onTripleClick,
  onMouseDown,
}: TableCellParagraphProps) {
  const paraRef = useRef<HTMLDivElement>(null);
  const [cursorRect, setCursorRect] = useState<{ x: number; y: number; height: number } | null>(null);
  const selection = useEditorStore((s) => s.selection);

  // ── Compute selection range within this paragraph ──────────
  const getBlockSelRange = (): [number, number] | null => {
    if (!selection || isSelectionEmpty(selection)) return null;
    const inBlock = (id: string) => id === paragraph.id;
    const aIn = inBlock(selection.anchor.nodeId);
    const fIn = inBlock(selection.focus.nodeId);
    const blockLen = paragraph.children.reduce((s, r) => s + r.content.length, 0);

    if (aIn && fIn) {
      return [Math.min(selection.anchor.offset, selection.focus.offset),
              Math.max(selection.anchor.offset, selection.focus.offset)];
    }

    // Multi-block selection: determine document order to handle backward selections
    const doc = useDocumentStore.getState().document;
    const allBlocks = getBlockNodes(doc);
    const anchorIdx = allBlocks.findIndex((b) => b.id === selection.anchor.nodeId);
    const focusIdx = allBlocks.findIndex((b) => b.id === selection.focus.nodeId);
    const isForward = anchorIdx >= 0 && focusIdx >= 0 && anchorIdx <= focusIdx;

    if (aIn) {
      return isForward ? [selection.anchor.offset, blockLen] : [0, selection.anchor.offset];
    }
    if (fIn) {
      return isForward ? [0, selection.focus.offset] : [selection.focus.offset, blockLen];
    }

    // Middle block: entire block is selected
    const thisIdx = allBlocks.findIndex((b) => b.id === paragraph.id);
    if (anchorIdx >= 0 && focusIdx >= 0 && thisIdx >= 0 &&
        thisIdx > Math.min(anchorIdx, focusIdx) && thisIdx < Math.max(anchorIdx, focusIdx)) {
      return [0, blockLen];
    }
    return null;
  };

  // Measure cursor position via Range API
  useLayoutEffect(() => {
    if (!isCursorHere || !paraRef.current) {
      setCursorRect(null);
      return;
    }

    const el = paraRef.current;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let charIndex = 0;
    let textNode: Text | null;

    while ((textNode = walker.nextNode() as Text | null)) {
      const nodeLen = textNode.length;
      if (charIndex + nodeLen >= cursorOffset) {
        const localOffset = Math.min(cursorOffset - charIndex, nodeLen);
        const range = document.createRange();
        range.setStart(textNode, localOffset);
        range.collapse(true);
        const rect = range.getBoundingClientRect();
        const parentRect = el.getBoundingClientRect();

        const pos = (rect.width === 0 && rect.height === 0)
          ? { x: 0, y: 0, height: 24 }
          : { x: rect.left - parentRect.left, y: rect.top - parentRect.top, height: rect.height };

        setCursorRect(pos);
        return;
      }
      charIndex += nodeLen;
    }

    const lastChild = el.lastChild;
    if (lastChild) {
      const range = document.createRange();
      range.setStartAfter(lastChild);
      range.collapse(true);
      const rect = range.getBoundingClientRect();
      const parentRect = el.getBoundingClientRect();
      setCursorRect({
        x: rect.left - parentRect.left,
        y: rect.top - parentRect.top,
        height: rect.height || 24,
      });
    } else {
      setCursorRect({ x: 0, y: 0, height: 24 });
    }
  }, [cursorOffset, isCursorHere]);

  // ── Render text with selection highlighting ────────────────
  const renderTextContent = () => {
    if (!paragraph.children || paragraph.children.length === 0) {
      return <span className="text-run" data-empty="true">{'\u200B'}</span>;
    }

    const selRange = getBlockSelRange();
    const SEL_BG = 'rgba(0, 120, 215, 0.3)';
    const parts: React.ReactNode[] = [];
    let globalOffset = 0;

    paragraph.children.forEach((run, index) => {
      const runLen = run.content.length;
      const runStart = globalOffset;
      const runEnd = runStart + runLen;

      const baseStyle: React.CSSProperties = {};
      if (run.marks.includes('bold')) baseStyle.fontWeight = 'bold';
      if (run.marks.includes('italic')) baseStyle.fontStyle = 'italic';
      if (run.marks.includes('underline')) baseStyle.textDecoration = 'underline';
      if (run.marks.includes('strikethrough')) baseStyle.textDecoration = 'line-through';
      if (run.attrs?.fontFamily) baseStyle.fontFamily = run.attrs.fontFamily as string;
      if (run.attrs?.fontSize) baseStyle.fontSize = run.attrs.fontSize as number;
      if (run.attrs?.color) baseStyle.color = run.attrs.color as string;
      if (run.attrs?.backgroundColor) baseStyle.backgroundColor = run.attrs.backgroundColor as string;

      const content = run.content || '\u200B';

      if (!selRange || runEnd <= selRange[0] || runStart >= selRange[1]) {
        parts.push(
          <span key={run.id || index} className="text-run" style={baseStyle}>
            {content}
          </span>
        );
      } else {
        const selStart = Math.max(0, selRange[0] - runStart);
        const selEnd = Math.min(runLen, selRange[1] - runStart);
        if (selStart > 0) {
          parts.push(
            <span key={`${run.id || index}-pre`} className="text-run" style={baseStyle}>
              {content.slice(0, selStart)}
            </span>
          );
        }
        parts.push(
          <span key={`${run.id || index}-sel`} className="text-run" style={{ ...baseStyle, backgroundColor: SEL_BG }}>
            {content.slice(selStart, selEnd)}
          </span>
        );
        if (selEnd < runLen) {
          parts.push(
            <span key={`${run.id || index}-post`} className="text-run" style={baseStyle}>
              {content.slice(selEnd)}
            </span>
          );
        }
      }
      globalOffset += runLen;
    });

    return <>{parts}</>;
  };

  return (
    <div
      ref={paraRef}
      className="table-cell-content"
      data-block-id={paragraph.id}
      style={{
        position: 'relative',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        textAlign: paragraph.attrs?.textAlign ?? 'left',
      }}
      onMouseDown={onMouseDown}
      onClick={(e) => onClick(paragraph.id, e.clientX, e.clientY)}
      onDoubleClick={(e) => onDoubleClick(paragraph.id, e.clientX, e.clientY)}
      onMouseUp={(e) => {
        if (e.detail === 3) {
          onTripleClick(paragraph.id, e.clientX, e.clientY);
        }
      }}
    >
      {renderTextContent()}

      {isCursorHere && (
        <span
          className="editor-cursor-inline"
          style={{
            position: 'absolute',
            left: (cursorRect?.x ?? 0) + 'px',
            top: (cursorRect?.y ?? 0) + 'px',
            height: (cursorRect?.height ?? 24) + 'px',
          }}
        />
      )}
    </div>
  );
}
