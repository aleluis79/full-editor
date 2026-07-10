import { useEditorStore } from '../stores/editor-store';
import { isSelectionEmpty } from '../core/selection';

export function SelectionOverlay() {
  const selection = useEditorStore((s) => s.selection);

  if (isSelectionEmpty(selection)) return null;

  // For Phase 1, we'll use CSS-based selection via the Paragraph component
  // The actual highlight rendering happens in the Paragraph component
  // This overlay is a placeholder for future more complex selection rendering

  return null;
}
