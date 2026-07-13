import { useRef, useLayoutEffect, useState } from 'react';
import type { Table as TableType, TableRow as TableRowType, TableCell as TableCellType } from '../core/types';
import { useDocumentStore } from '../stores/document-store';
import { useEditorStore } from '../stores/editor-store';

type BlockClickHandler = (blockId: string, clientX: number, clientY: number) => void;

interface TableBlockProps {
  block: TableType;
  activeBlockId: string | null;
  onBlockClick: BlockClickHandler;
  onDoubleClick: BlockClickHandler;
  onTripleClick: BlockClickHandler;
}

export function TableBlock({ block, activeBlockId, onBlockClick, onDoubleClick, onTripleClick }: TableBlockProps) {
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
  onDeleteRow,
  onAddRow,
  editing,
  isLastRow,
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
}

function TableCellParagraph({
  paragraph,
  isCursorHere,
  cursorOffset,
  onClick,
  onDoubleClick,
  onTripleClick,
}: TableCellParagraphProps) {
  const paraRef = useRef<HTMLDivElement>(null);
  const [cursorRect, setCursorRect] = useState<{ x: number; y: number; height: number } | null>(null);

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

    // Offset beyond all text
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
      onClick={(e) => onClick(paragraph.id, e.clientX, e.clientY)}
      onDoubleClick={(e) => onDoubleClick(paragraph.id, e.clientX, e.clientY)}
      onMouseUp={(e) => {
        if (e.detail === 3) {
          onTripleClick(paragraph.id, e.clientX, e.clientY);
        }
      }}
    >
      {paragraph.children.map((run) => (
        <span
          key={run.id}
          style={{
            fontWeight: run.marks.includes('bold') ? 'bold' : 'normal',
            fontStyle: run.marks.includes('italic') ? 'italic' : 'normal',
            fontFamily: run.attrs?.fontFamily,
            fontSize: run.attrs?.fontSize,
            color: run.attrs?.color,
          }}
        >
          {run.content || '\u200B'}
        </span>
      ))}
      {paragraph.children.length === 0 && <br />}

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
