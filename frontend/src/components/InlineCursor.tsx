import { useEditorStore } from '../stores/editor-store';

/**
 * Renders cursor at the correct position within text runs.
 * This is a helper component used inside Paragraph.
 */
export function InlineCursor({ blockId }: { blockId: string }) {
  const cursor = useEditorStore((s) => s.cursor);
  const focused = useEditorStore((s) => s.focused);

  if (!focused || cursor.position.nodeId !== blockId) return null;

  return (
    <span
      className="editor-cursor-inline"
      data-node-id={blockId}
      data-offset={cursor.position.offset}
    />
  );
}
