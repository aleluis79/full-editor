import { useEffect, useRef, useCallback } from 'react';
import type { DocumentRoot } from '../core/types';
import { useLayoutStore } from '../stores/layout-store';

/**
 * Hook for using the Layout Web Worker
 */
export function useLayoutWorker() {
  const workerRef = useRef<Worker | null>(null);
  const calculateLayout = useLayoutStore((s) => s.calculateLayout);
  const constraints = useLayoutStore((s) => s.constraints);

  useEffect(() => {
    // Create worker
    workerRef.current = new Worker(
      new URL('../workers/layout.worker.ts', import.meta.url),
      { type: 'module' }
    );

    // Handle messages from worker
    workerRef.current.onmessage = (e) => {
      const { type, payload } = e.data;

      if (type === 'layout-result') {
        // Update layout store with results
        useLayoutStore.setState({ layout: payload });
      }
    };

    // Cleanup
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  /**
   * Calculate layout using Web Worker
   */
  const calculateLayoutAsync = useCallback(
    (doc: DocumentRoot) => {
      if (!workerRef.current) {
        // Fallback to main thread if worker not available
        calculateLayout(doc);
        return;
      }

      // Extract blocks from document (simplified)
      const blocks = extractBlocks(doc);

      // Send to worker
      workerRef.current.postMessage({
        type: 'layout',
        payload: {
          blocks,
          constraints,
        },
      });
    },
    [calculateLayout, constraints]
  );

  return { calculateLayoutAsync };
}

/**
 * Extract blocks from document for worker
 */
function extractBlocks(doc: DocumentRoot): Array<{
  id: string;
  type: string;
  children?: Array<{ content: string; marks: string[]; attrs?: Record<string, unknown> }>;
  level?: number;
  width?: number;
  height?: number;
}> {
  const blocks: Array<{
    id: string;
    type: string;
    children?: Array<{ content: string; marks: string[]; attrs?: Record<string, unknown> }>;
    level?: number;
    width?: number;
    height?: number;
  }> = [];

  function walk(node: { id: string; type: string; children?: unknown[]; level?: number; width?: number; height?: number }) {
    if (node.type === 'paragraph' || node.type === 'heading') {
      blocks.push({
        id: node.id,
        type: node.type,
        level: node.level,
        children: (node.children as Array<{ content: string; marks: string[]; attrs?: Record<string, unknown> }>) ?? [],
      });
    } else if (node.type === 'horizontalRule') {
      blocks.push({
        id: node.id,
        type: 'horizontalRule',
      });
    } else if (node.type === 'image') {
      blocks.push({
        id: node.id,
        type: 'image',
        width: node.width,
        height: node.height,
      });
    } else if (node.type === 'table') {
      // For now, treat table as a placeholder
      blocks.push({
        id: node.id,
        type: 'table',
      });
    }

    // Recurse into children
    if (node.children) {
      for (const child of node.children) {
        if (typeof child === 'object' && child !== null && 'id' in child) {
          walk(child as { id: string; type: string; children?: unknown[] });
        }
      }
    }
  }

  walk(doc);
  return blocks;
}
