import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { create } from 'zustand';
import { DocumentView } from '../DocumentView';
import { usePageStore } from '../../stores/page-store';
import { useDocumentStore } from '../../stores/document-store';
import { useEditorStore } from '../../stores/editor-store';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

// Mock page store
vi.mock('../../stores/page-store', () => ({
  usePageStore: create(() => ({
    config: {
      paperSize: { name: 'A4', width: 794, height: 1123 },
      orientation: 'portrait',
      margins: { top: 96, right: 96, bottom: 96, left: 96 },
      headerFooter: {
        enabled: true,
        firstPageDifferent: false,
        header: { runs: [{ id: 'r1', type: 'text', content: 'Header', marks: [] }], height: 36 },
        footer: { runs: [{ id: 'r2', type: 'text', content: 'Footer', marks: [] }], height: 36 },
        pageNumberPosition: 'bottom-center',
      },
    },
    pages: [
      {
        index: 0,
        width: 794,
        height: 1123,
        contentArea: { x: 96, y: 132, width: 602, height: 895 },
        headerArea: { x: 96, y: 48, width: 602, height: 36 },
        footerArea: { x: 96, y: 1039, width: 602, height: 36 },
        blocks: [],
        pageNumber: 1,
      },
    ],
    totalPages: 1,
    editingHeaderFooter: null,
    availablePaperSizes: [{ name: 'A4', width: 794, height: 1123 }],
    paginate: vi.fn(),
    updatePaperSize: vi.fn(),
    updateOrientation: vi.fn(),
    updateMargins: vi.fn(),
    updateHeaderFooter: vi.fn(),
    setEditingHeaderFooter: vi.fn(),
    updateHeaderFooterRuns: vi.fn(),
  })),
}));

// Mock document store
vi.mock('../../stores/document-store', () => ({
  useDocumentStore: create(() => ({
    document: { id: 'doc-1', type: 'document', children: [], config: {}, attrs: {} },
    markDirty: vi.fn(),
    currentDocId: 'doc-1',
    documentTitle: 'Test',
  })),
}));

// Mock editor store
vi.mock('../../stores/editor-store', () => ({
  useEditorStore: create(() => ({
    cursor: { position: { nodeId: '', offset: 0 } },
    selection: null,
    focused: true,
  })),
}));

// Mock layout store
vi.mock('../../stores/layout-store', () => ({
  useLayoutStore: create(() => ({
    getBlockLayout: () => undefined,
  })),
}));

// Mock comment store
vi.mock('../../stores/comment-store', () => ({
  useCommentStore: create(() => ({
    visible: false,
    comments: [],
    activeBlockId: null,
    setActiveBlock: vi.fn(),
  })),
}));

// Mock spell-check store
vi.mock('../../stores/spell-check-store', () => ({
  useSpellCheckStore: create(() => ({
    enabled: false,
    misspellings: {},
  })),
}));

const noopProps = {
  blocks: [],
  activeBlockId: null,
  onBlockMouseDown: vi.fn(),
  onBlockClick: vi.fn(),
  onDoubleClick: vi.fn(),
  onTripleClick: vi.fn(),
};

describe('DocumentView inline header/footer editor integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders inline header/footer editors when headerFooter is enabled', () => {
    render(<DocumentView {...noopProps} />);
    const editors = screen.getAllByTestId('inline-hf-editor');
    expect(editors.length).toBeGreaterThanOrEqual(2); // header + footer
  });

  it('clicking header zone calls setEditingHeaderFooter("header")', () => {
    render(<DocumentView {...noopProps} />);
    const editors = screen.getAllByTestId('inline-hf-editor');
    const headerEditor = editors.find((e) => e.getAttribute('data-target') === 'header');
    expect(headerEditor).toBeTruthy();
    fireEvent.click(headerEditor!);
    expect(usePageStore.getState().setEditingHeaderFooter).toHaveBeenCalledWith('header');
  });

  it('clicking footer zone calls setEditingHeaderFooter("footer")', () => {
    render(<DocumentView {...noopProps} />);
    const editors = screen.getAllByTestId('inline-hf-editor');
    const footerEditor = editors.find((e) => e.getAttribute('data-target') === 'footer');
    expect(footerEditor).toBeTruthy();
    fireEvent.click(footerEditor!);
    expect(usePageStore.getState().setEditingHeaderFooter).toHaveBeenCalledWith('footer');
  });

  it('does not render inline editors when headerFooter is disabled', () => {
    usePageStore.setState({
      config: {
        paperSize: { name: 'A4', width: 794, height: 1123 },
        orientation: 'portrait',
        margins: { top: 96, right: 96, bottom: 96, left: 96 },
        headerFooter: {
          enabled: false,
          firstPageDifferent: false,
          header: { runs: [], height: 36 },
          footer: { runs: [], height: 36 },
          pageNumberPosition: 'bottom-center',
        },
      },
    });
    render(<DocumentView {...noopProps} />);
    const editors = screen.queryAllByTestId('inline-hf-editor');
    expect(editors).toHaveLength(0);
  });
});

describe('DocumentView Escape key exits header/footer editing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls setEditingHeaderFooter(null) when Escape is pressed while editing', () => {
    usePageStore.setState({ editingHeaderFooter: 'header' });
    render(<DocumentView {...noopProps} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(usePageStore.getState().setEditingHeaderFooter).toHaveBeenCalledWith(null);
  });

  it('does not call setEditingHeaderFooter when Escape is pressed while not editing', () => {
    usePageStore.setState({ editingHeaderFooter: null });
    render(<DocumentView {...noopProps} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(usePageStore.getState().setEditingHeaderFooter).not.toHaveBeenCalled();
  });
});

describe('DocumentView click-outside exits header/footer editing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls setEditingHeaderFooter(null) when clicking outside editor and toolbar', () => {
    usePageStore.setState({ editingHeaderFooter: 'header' });
    render(<DocumentView {...noopProps} />);

    const outsideElement = document.createElement('div');
    document.body.appendChild(outsideElement);
    fireEvent.mouseDown(outsideElement);

    expect(usePageStore.getState().setEditingHeaderFooter).toHaveBeenCalledWith(null);
    document.body.removeChild(outsideElement);
  });

  it('does not call setEditingHeaderFooter when clicking inside active editor', () => {
    usePageStore.setState({ editingHeaderFooter: 'header' });
    render(<DocumentView {...noopProps} />);

    const editor = document.querySelector('.inline-hf-editor.active');
    if (editor) {
      fireEvent.mouseDown(editor);
      expect(usePageStore.getState().setEditingHeaderFooter).not.toHaveBeenCalled();
    }
  });
});
