import type { Table as TableType, TableRow as TableRowType, TableCell as TableCellType } from '../core/types';
import { useDocumentStore } from '../stores/document-store';

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

  return (
    <div className="table-block" data-block-id={block.id}>
      <table className="table-grid">
        <thead>
          <tr>
            {block.rows[0]?.cells.map((cell, colIndex) => (
              <th
                key={cell.id}
                className="table-header-cell"
                style={{
                  width: block.columnWidths[colIndex],
                }}
              >
                {cell.colSpan > 1 && (
                  <span className="colspan-indicator">{cell.colSpan} cols</span>
                )}
              </th>
            ))}
            <th className="table-actions-cell">
              <button
                className="table-action-btn"
                onClick={() => handleAddColumn(block.columnWidths.length - 1)}
                title="Add column"
              >
                +
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <TableRowComponent
              key={row.id}
              row={row}
              rowIndex={rowIndex}
              columnWidths={block.columnWidths}
              activeBlockId={activeBlockId}
              onBlockClick={onBlockClick}
              onDoubleClick={onDoubleClick}
              onTripleClick={onTripleClick}
              onDeleteRow={handleDeleteRow}
              onAddRow={handleAddRow}
            />
          ))}
        </tbody>
      </table>

      {/* Row actions */}
      <div className="table-row-actions">
        <button
          className="table-action-btn"
          onClick={() => handleAddRow(block.rows.length - 1)}
          title="Add row"
        >
          + Row
        </button>
      </div>
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
}

function TableCellComponent({
  cell,
  colSpan,
  width,
  activeBlockId,
  onBlockClick,
  onDoubleClick,
  onTripleClick,
}: TableCellComponentProps) {
  const isActive = cell.children.some((p) => p.id === activeBlockId);

  return (
    <td
      className={`table-cell ${isActive ? 'active' : ''}`}
      colSpan={colSpan}
      style={{ width }}
    >
      {cell.children.map((paragraph) => (
        <div
          key={paragraph.id}
          className="table-cell-content"
          data-block-id={paragraph.id}
          onClick={(e) => onBlockClick(paragraph.id, e.clientX, e.clientY)}
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
              {run.content}
            </span>
          ))}
          {paragraph.children.length === 0 && <br />}
        </div>
      ))}
    </td>
  );
}
