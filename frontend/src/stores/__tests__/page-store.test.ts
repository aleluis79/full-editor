import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePageStore } from '../page-store';

// Shared mock functions
const mockUpdateConstraints = vi.fn();
const mockCalculateLayout = vi.fn();
const mockMarkDirty = vi.fn();

// Mock document store
vi.mock('../document-store', () => ({
  useDocumentStore: {
    getState: () => ({
      document: { children: [] },
      markDirty: mockMarkDirty,
    }),
  },
}));

// Mock layout store
vi.mock('../layout-store', () => ({
  useLayoutStore: {
    getState: () => ({
      updateConstraints: mockUpdateConstraints,
      calculateLayout: mockCalculateLayout,
      layout: null,
    }),
  },
}));

describe('page-store updateOrientation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset page store to defaults
    usePageStore.setState({
      config: {
        paperSize: { name: 'A4', width: 794, height: 1123 },
        orientation: 'portrait',
        margins: { top: 96, right: 96, bottom: 96, left: 96 },
        headerFooter: {
          enabled: false,
          firstPageDifferent: true,
          header: { runs: [], height: 36 },
          footer: { runs: [], height: 36 },
          pageNumberPosition: 'bottom-center' as const,
        },
      },
      pages: [],
      totalPages: 0,
    });
  });

  it('updates orientation to landscape', () => {
    usePageStore.getState().updateOrientation('landscape');
    const state = usePageStore.getState();
    expect(state.config.orientation).toBe('landscape');
    expect(mockMarkDirty).toHaveBeenCalled();
  });

  it('updates orientation to portrait', () => {
    // First set to landscape
    usePageStore.getState().updateOrientation('landscape');
    // Then back to portrait
    usePageStore.getState().updateOrientation('portrait');
    const state = usePageStore.getState();
    expect(state.config.orientation).toBe('portrait');
    expect(mockMarkDirty).toHaveBeenCalledTimes(2);
  });

  it('calls updateConstraints with width based on oriented dimensions', () => {
    // A4 landscape: width=1123, margins=96+96=192 → contentWidth = 1123-192 = 931
    usePageStore.getState().updateOrientation('landscape');
    expect(mockUpdateConstraints).toHaveBeenCalledWith({ width: 931 });
    expect(mockMarkDirty).toHaveBeenCalled();
  });
});

describe('page-store updateMargins clamping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePageStore.setState({
      config: {
        paperSize: { name: 'A4', width: 794, height: 1123 },
        orientation: 'portrait',
        margins: { top: 96, right: 96, bottom: 96, left: 96 },
        headerFooter: {
          enabled: false,
          firstPageDifferent: true,
          header: { runs: [], height: 36 },
          footer: { runs: [], height: 36 },
          pageNumberPosition: 'bottom-center' as const,
        },
      },
      pages: [],
      totalPages: 0,
    });
  });

  it('clamps negative top margin to 0', () => {
    usePageStore.getState().updateMargins({ top: -10 });
    const state = usePageStore.getState();
    expect(state.config.margins.top).toBe(0);
    expect(mockMarkDirty).toHaveBeenCalled();
  });

  it('clamps negative right margin to 0', () => {
    usePageStore.getState().updateMargins({ right: -5 });
    const state = usePageStore.getState();
    expect(state.config.margins.right).toBe(0);
    expect(mockMarkDirty).toHaveBeenCalled();
  });

  it('clamps negative bottom margin to 0', () => {
    usePageStore.getState().updateMargins({ bottom: -20 });
    const state = usePageStore.getState();
    expect(state.config.margins.bottom).toBe(0);
    expect(mockMarkDirty).toHaveBeenCalled();
  });

  it('clamps negative left margin to 0', () => {
    usePageStore.getState().updateMargins({ left: -1 });
    const state = usePageStore.getState();
    expect(state.config.margins.left).toBe(0);
    expect(mockMarkDirty).toHaveBeenCalled();
  });

  it('preserves valid positive margins', () => {
    usePageStore.getState().updateMargins({ top: 50, right: 72, bottom: 100, left: 48 });
    const state = usePageStore.getState();
    expect(state.config.margins.top).toBe(50);
    expect(state.config.margins.right).toBe(72);
    expect(state.config.margins.bottom).toBe(100);
    expect(state.config.margins.left).toBe(48);
    expect(mockMarkDirty).toHaveBeenCalled();
  });
});
