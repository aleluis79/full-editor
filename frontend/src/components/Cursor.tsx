import { useEffect, useState } from 'react';
import { useEditorStore } from '../stores/editor-store';

/**
 * Simple cursor overlay - positioned at the start of the active paragraph.
 * Phase 1: just show cursor in the right area.
 */
export function CursorOverlay() {
  const cursor = useEditorStore((s) => s.cursor);
  const focused = useEditorStore((s) => s.focused);
  const [visible, setVisible] = useState(true);

  // Blinking
  useEffect(() => {
    if (!focused) return;
    const interval = setInterval(() => setVisible((v) => !v), 530);
    return () => clearInterval(interval);
  }, [focused]);

  // Reset on move
  useEffect(() => {
    setVisible(true);
  }, [cursor.position.nodeId, cursor.position.offset]);

  if (!focused || !cursor.position.nodeId) return null;

  return (
    <span
      className="editor-cursor"
      data-node-id={cursor.position.nodeId}
      data-offset={cursor.position.offset}
      style={{ opacity: visible ? 1 : 0 }}
    />
  );
}
