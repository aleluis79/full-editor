import { useState, useRef, useCallback } from 'react';
import type { Image as ImageType } from '../core/types';
import { useDocumentStore } from '../stores/document-store';

interface ImageBlockProps {
  block: ImageType;
  isActive: boolean;
  onClick: (blockId: string, clientX: number, clientY: number) => void;
  onMouseDown?: (blockId: string, e: React.MouseEvent) => void;
}

export function ImageBlock({ block, isActive, onClick, onMouseDown }: ImageBlockProps) {
  const [isResizing, setIsResizing] = useState(false);
  const startPos = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const resizeImage = useDocumentStore((s) => s.resizeImage);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, handle: string) => {
      e.stopPropagation();
      setIsResizing(true);
      startPos.current = {
        x: e.clientX,
        y: e.clientY,
        width: block.width,
        height: block.height,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startPos.current.x;
        const dy = moveEvent.clientY - startPos.current.y;

        let newWidth = startPos.current.width;
        let newHeight = startPos.current.height;

        if (handle.includes('e')) {
          newWidth = Math.max(50, startPos.current.width + dx);
        }
        if (handle.includes('w')) {
          newWidth = Math.max(50, startPos.current.width - dx);
        }
        if (handle.includes('s')) {
          newHeight = Math.max(50, startPos.current.height + dy);
        }
        if (handle.includes('n')) {
          newHeight = Math.max(50, startPos.current.height - dy);
        }

        // Maintain aspect ratio
        const aspectRatio = startPos.current.width / startPos.current.height;
        if (handle === 'se' || handle === 'nw') {
          newHeight = newWidth / aspectRatio;
        } else if (handle === 'ne' || handle === 'sw') {
          newHeight = newWidth / aspectRatio;
        }

        resizeImage(block.id, Math.round(newWidth), Math.round(newHeight));
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [block.id, block.width, block.height, resizeImage]
  );

  // Compute alignment style
  const alignStyle: React.CSSProperties =
    block.attrs?.textAlign === 'center' ? { textAlign: 'center' } :
    block.attrs?.textAlign === 'right' ? { textAlign: 'right' } :
    {};

  return (
    <div
      className={`image-block ${isActive ? 'active' : ''}`}
      data-block-id={block.id}
      onClick={(e) => onClick(block.id, e.clientX, e.clientY)}
      onMouseDown={onMouseDown ? (e) => onMouseDown(block.id, e) : undefined}
      style={{
        position: 'relative',
        display: 'inline-block',
        cursor: 'pointer',
        ...alignStyle,
      }}
    >
      <img
        src={block.src}
        alt={block.alt}
        style={{
          width: block.width,
          height: block.height,
          display: 'block',
          userSelect: 'none',
          pointerEvents: isResizing ? 'none' : 'auto',
        }}
        draggable={false}
      />

      {/* Resize handles */}
      {isActive && (
        <>
          <div
            className="resize-handle resize-handle-n"
            onMouseDown={(e) => handleResizeStart(e, 'n')}
          />
          <div
            className="resize-handle resize-handle-s"
            onMouseDown={(e) => handleResizeStart(e, 's')}
          />
          <div
            className="resize-handle resize-handle-e"
            onMouseDown={(e) => handleResizeStart(e, 'e')}
          />
          <div
            className="resize-handle resize-handle-w"
            onMouseDown={(e) => handleResizeStart(e, 'w')}
          />
          <div
            className="resize-handle resize-handle-ne"
            onMouseDown={(e) => handleResizeStart(e, 'ne')}
          />
          <div
            className="resize-handle resize-handle-nw"
            onMouseDown={(e) => handleResizeStart(e, 'nw')}
          />
          <div
            className="resize-handle resize-handle-se"
            onMouseDown={(e) => handleResizeStart(e, 'se')}
          />
          <div
            className="resize-handle resize-handle-sw"
            onMouseDown={(e) => handleResizeStart(e, 'sw')}
          />
        </>
      )}
    </div>
  );
}
