import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePageStore } from '../page-store';
import type { TextRun } from '../../core/types';

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

describe('page-store editingHeaderFooter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePageStore.setState({
      editingHeaderFooter: null,
      config: {
        paperSize: { name: 'A4', width: 794, height: 1123 },
        orientation: 'portrait',
        margins: { top: 96, right: 96, bottom: 96, left: 96 },
        headerFooter: {
          enabled: true,
          firstPageDifferent: true,
          header: { runs: [], height: 36 },
          footer: { runs: [], height: 36 },
          pageNumberPosition: 'bottom-center' as const,
        },
      },
    });
  });

  it('initializes editingHeaderFooter as null', () => {
    const state = usePageStore.getState();
    expect(state.editingHeaderFooter).toBeNull();
  });

  it('setEditingHeaderFooter("header") sets mode to header', () => {
    usePageStore.getState().setEditingHeaderFooter('header');
    expect(usePageStore.getState().editingHeaderFooter).toBe('header');
  });

  it('setEditingHeaderFooter("footer") sets mode to footer', () => {
    usePageStore.getState().setEditingHeaderFooter('footer');
    expect(usePageStore.getState().editingHeaderFooter).toBe('footer');
  });

  it('switches from header to footer', () => {
    usePageStore.getState().setEditingHeaderFooter('header');
    usePageStore.getState().setEditingHeaderFooter('footer');
    expect(usePageStore.getState().editingHeaderFooter).toBe('footer');
  });

  it('setEditingHeaderFooter(null) exits editing mode', () => {
    usePageStore.getState().setEditingHeaderFooter('header');
    usePageStore.getState().setEditingHeaderFooter(null);
    expect(usePageStore.getState().editingHeaderFooter).toBeNull();
  });

  it('updateHeaderFooterRuns updates header runs', () => {
    const runs: TextRun[] = [
      { id: 'r1', type: 'text', content: 'Header Text', marks: ['bold'] },
    ];
    usePageStore.getState().updateHeaderFooterRuns('header', runs);
    const state = usePageStore.getState();
    expect(state.config.headerFooter.header.runs).toEqual(runs);
    // Footer should be unchanged
    expect(state.config.headerFooter.footer.runs).toEqual([]);
  });

  it('updateHeaderFooterRuns updates footer runs', () => {
    const runs: TextRun[] = [
      { id: 'r2', type: 'text', content: 'Footer Text', marks: [] },
    ];
    usePageStore.getState().updateHeaderFooterRuns('footer', runs);
    const state = usePageStore.getState();
    expect(state.config.headerFooter.footer.runs).toEqual(runs);
    // Header should be unchanged
    expect(state.config.headerFooter.header.runs).toEqual([]);
  });

  it('updateHeaderFooterRuns does not affect other config', () => {
    const runs: TextRun[] = [
      { id: 'r3', type: 'text', content: 'Test', marks: [] },
    ];
    usePageStore.getState().updateHeaderFooterRuns('header', runs);
    const state = usePageStore.getState();
    expect(state.config.headerFooter.enabled).toBe(true);
    expect(state.config.headerFooter.pageNumberPosition).toBe('bottom-center');
  });
});

describe('page-store updateHeaderFooter recalculation', () => {
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

  it('recalculates layout and pagination when enabling headers/footers', () => {
    usePageStore.getState().updateHeaderFooter({ enabled: true });
    expect(mockCalculateLayout).toHaveBeenCalled();
    expect(mockMarkDirty).toHaveBeenCalled();
  });

  it('recalculates layout and pagination when changing header height', () => {
    usePageStore.getState().updateHeaderFooter({
      header: { runs: [], height: 50 },
    });
    expect(mockCalculateLayout).toHaveBeenCalled();
    expect(mockMarkDirty).toHaveBeenCalled();
  });

  it('recalculates layout and pagination when changing footer height', () => {
    usePageStore.getState().updateHeaderFooter({
      footer: { runs: [], height: 50 },
    });
    expect(mockCalculateLayout).toHaveBeenCalled();
    expect(mockMarkDirty).toHaveBeenCalled();
  });
});
