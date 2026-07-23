import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { create } from 'zustand';
import { Toolbar } from '../Toolbar';
import { useDocumentStore } from '../../stores/document-store';
import { useEditorStore } from '../../stores/editor-store';
import { exportPDF } from '../../api/client';

// Mock react-i18next so useTranslation returns English labels from the translation keys
vi.mock('react-i18next', () => ({
  useTranslation: (ns: string) => ({
    t: (key: string) => {
      // Return English label for toolbar keys
      const labels: Record<string, string> = {
        'toolbar:backToDocuments': 'Back to documents',
        'toolbar:editTitle': 'Edit title',
        'toolbar:saving': 'Saving...',
        'toolbar:save': 'Save',
        'toolbar:exportPdf': 'Export to PDF',
        'toolbar:shareDocument': 'Share document',
        'toolbar:toggleComments': 'Toggle comments',
        'toolbar:pageSettings': 'Page settings',
        'toolbar:boldTooltip': 'Bold (Ctrl+B)',
        'toolbar:italicTooltip': 'Italic (Ctrl+I)',
        'toolbar:underlineTooltip': 'Underline (Ctrl+U)',
        'toolbar:strikethroughTooltip': 'Strikethrough',
        'toolbar:superscriptTooltip': 'Superscript',
        'toolbar:subscriptTooltip': 'Subscript',
        'toolbar:linkTooltip': 'Link (Ctrl+K)',
        'toolbar:linkPlaceholder': 'https://...',
        'toolbar:linkOk': 'OK',
        'toolbar:linkCancel': 'Cancel',
        'toolbar:alignLeftTooltip': 'Align left',
        'toolbar:alignCenterTooltip': 'Center',
        'toolbar:alignRightTooltip': 'Align right',
        'toolbar:lineSpacingTooltip': 'Line spacing',
        'toolbar:clearFormattingTooltip': 'Clear formatting',
        'toolbar:bulletListTooltip': 'Bullet list',
        'toolbar:numberedListTooltip': 'Numbered list',
        'toolbar:fontFamilyTooltip': 'Font family',
        'toolbar:fontSizeTooltip': 'Font size',
        'toolbar:textColorTooltip': 'Text color',
        'toolbar:highlightColorTooltip': 'Highlight color',
        'toolbar:removeHighlightTooltip': 'Remove highlight',
        'toolbar:blockTypeTooltip': 'Block type',
        'toolbar:paragraphLabel': 'Paragraph',
        'toolbar:heading1Label': 'Heading 1',
        'toolbar:heading2Label': 'Heading 2',
        'toolbar:heading3Label': 'Heading 3',
        'toolbar:blockquoteLabel': 'Blockquote',
        'toolbar:bulletListLabel': 'Bullet List',
        'toolbar:numberedListLabel': 'Numbered List',
        'toolbar:insertImageTooltip': 'Insert Image',
        'toolbar:insertTableTooltip': 'Insert Table',
      };
      const fullKey = key.includes(':') ? key : `${ns}:${key}`;
      return labels[fullKey] ?? key;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

// Mock the API client
vi.mock('../../api/client', () => ({
  uploadImage: vi.fn(),
  fetchDocuments: vi.fn().mockResolvedValue([]),
  fetchDocument: vi.fn(),
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
  deleteDocument: vi.fn(),
  exportPDF: vi.fn(),
}));

// Mock page store
vi.mock('../../stores/page-store', () => ({
  usePageStore: create(() => ({
    config: { paperSize: { name: 'A4', width: 595, height: 842 }, orientation: 'portrait', margins: { top: 96, right: 96, bottom: 96, left: 96 }, headerFooter: { enabled: false, firstPageDifferent: true, header: { runs: [], height: 36 }, footer: { runs: [], height: 36 }, pageNumberPosition: 'bottom-center' } },
    pages: [],
    editingHeaderFooter: null,
    hfCursorOffset: 0,
    availablePaperSizes: [{ name: 'A4', width: 794, height: 1123 }, { name: 'Letter', width: 816, height: 1056 }, { name: 'Legal', width: 816, height: 1344 }],
    paginate: vi.fn(),
    updatePaperSize: vi.fn(),
    updateOrientation: vi.fn(),
    updateMargins: vi.fn(),
    setEditingHeaderFooter: vi.fn(),
    updateHeaderFooterRuns: vi.fn(),
    setHfCursorOffset: vi.fn(),
  })),
}));

// Mock layout store
vi.mock('../../stores/layout-store', () => ({
  useLayoutStore: create(() => ({
    layout: null,
    calculateLayout: vi.fn(),
  })),
}));

describe('Toolbar image insert button', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    useDocumentStore.setState({
      document: {
        id: 'doc-test',
        type: 'document',
        children: [
          {
            id: 'block-1',
            type: 'paragraph',
            children: [{ id: 'run-1', type: 'text', content: '', marks: [], attrs: {} }],
            attrs: {},
          },
        ],
        config: {},
        attrs: {},
      },
      currentDocId: 'doc-1',
      isEditorReady: true,
      isDirty: false,
      isSaving: false,
      documentTitle: 'Test',
    });

    useEditorStore.getState().setCursorPosition({ nodeId: 'block-1', offset: 0 });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders an image insert button', () => {
    render(<Toolbar />);

    // Look for a button with title "Insert Image" or similar
    const buttons = screen.getAllByRole('button');
    const imageBtn = buttons.find(
      (btn) => btn.getAttribute('title') === 'Insert Image',
    );
    expect(imageBtn).toBeTruthy();
  });

  it('has a hidden file input with accept="image/*" and a visible button that triggers it', () => {
    render(<Toolbar />);

    // Verify the hidden file input
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    expect(fileInput.accept).toBe('image/*');
    expect(fileInput.style.display).toBe('none');

    // Verify the image insert button
    const buttons = screen.getAllByRole('button');
    const imageBtn = buttons.find(
      (btn) => btn.getAttribute('title') === 'Insert Image',
    );
    expect(imageBtn).toBeTruthy();

    // Verify clicking the button triggers the file picker
    const clickSpy = vi.spyOn(fileInput, 'click');
    fireEvent.click(imageBtn!);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});

describe('Toolbar line spacing popup', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    useDocumentStore.setState({
      document: {
        id: 'doc-test',
        type: 'document',
        children: [
          {
            id: 'block-1',
            type: 'paragraph',
            children: [{ id: 'run-1', type: 'text', content: 'Hello', marks: [], attrs: {} }],
            attrs: {},
          },
        ],
        config: {},
        attrs: {},
      },
      currentDocId: 'doc-1',
      isEditorReady: true,
      isDirty: false,
      isSaving: false,
      documentTitle: 'Test',
    });

    useEditorStore.getState().setCursorPosition({ nodeId: 'block-1', offset: 0 });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders a line spacing button', () => {
    render(<Toolbar />);
    const buttons = screen.getAllByRole('button');
    const spacingBtn = buttons.find(
      (btn) => btn.getAttribute('title') === 'Line spacing',
    );
    expect(spacingBtn).toBeTruthy();
  });

  it('opens popup with preset values on click', () => {
    render(<Toolbar />);
    const buttons = screen.getAllByRole('button');
    const spacingBtn = buttons.find(
      (btn) => btn.getAttribute('title') === 'Line spacing',
    )!;
    fireEvent.click(spacingBtn);

    // Preset values should be visible (numbers formatted for display)
    expect(screen.getByText('1.0')).toBeTruthy();
    expect(screen.getByText('1.15')).toBeTruthy();
    expect(screen.getByText('1.5')).toBeTruthy();
    expect(screen.getByText('2.0')).toBeTruthy();
    expect(screen.getByText('2.5')).toBeTruthy();
    expect(screen.getByText('3.0')).toBeTruthy();
  });

  it('closes popup after selecting a preset', () => {
    render(<Toolbar />);
    const buttons = screen.getAllByRole('button');
    const spacingBtn = buttons.find(
      (btn) => btn.getAttribute('title') === 'Line spacing',
    )!;
    fireEvent.click(spacingBtn);

    expect(screen.getByText('1.5')).toBeTruthy();
    fireEvent.click(screen.getByText('1.5'));

    // Popup should close
    expect(screen.queryByText('1.5')).toBeNull();
  });

  it('calls setBlockAttrs with lineHeight when preset selected', () => {
    const setBlockAttrsSpy = vi.spyOn(useDocumentStore.getState(), 'setBlockAttrs');

    render(<Toolbar />);
    const buttons = screen.getAllByRole('button');
    const spacingBtn = buttons.find(
      (btn) => btn.getAttribute('title') === 'Line spacing',
    )!;
    fireEvent.click(spacingBtn);
    fireEvent.click(screen.getByText('2.0'));

    expect(setBlockAttrsSpy).toHaveBeenCalledWith('block-1', { lineHeight: 2.0 });
  });

  it('toggles off when active preset is clicked', () => {
    // Set lineHeight to 1.5 on the block
    const doc = useDocumentStore.getState().document;
    (doc.children[0] as any).attrs = { lineHeight: 1.5 };
    useDocumentStore.setState({ document: { ...doc } });

    const setBlockAttrsSpy = vi.spyOn(useDocumentStore.getState(), 'setBlockAttrs');

    render(<Toolbar />);
    const buttons = screen.getAllByRole('button');
    const spacingBtn = buttons.find(
      (btn) => btn.getAttribute('title') === 'Line spacing',
    )!;
    fireEvent.click(spacingBtn);
    fireEvent.click(screen.getByText('1.5'));

    expect(setBlockAttrsSpy).toHaveBeenCalledWith('block-1', { lineHeight: undefined });
  });

  it('does not show popup by default', () => {
    render(<Toolbar />);
    expect(screen.queryByText('1.0')).toBeNull();
    expect(screen.queryByText('2.0')).toBeNull();
  });

  it('marks active preset when block has lineHeight', () => {
    // Set lineHeight to 2.0 on the block
    const doc = useDocumentStore.getState().document;
    (doc.children[0] as any).attrs = { lineHeight: 2.0 };
    useDocumentStore.setState({ document: { ...doc } });

    render(<Toolbar />);
    const buttons = screen.getAllByRole('button');
    const spacingBtn = buttons.find(
      (btn) => btn.getAttribute('title') === 'Line spacing',
    )!;
    fireEvent.click(spacingBtn);

    // The active preset should have a special class
    const preset2 = screen.getByText('2.0');
    expect(preset2.className).toContain('active');
  });
});

describe('Toolbar page settings gear button', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    useDocumentStore.setState({
      document: {
        id: 'doc-test',
        type: 'document',
        children: [
          {
            id: 'block-1',
            type: 'paragraph',
            children: [{ id: 'run-1', type: 'text', content: '', marks: [], attrs: {} }],
            attrs: {},
          },
        ],
        config: {},
        attrs: {},
      },
      currentDocId: 'doc-1',
      isEditorReady: true,
      isDirty: false,
      isSaving: false,
      documentTitle: 'Test',
    });

    useEditorStore.getState().setCursorPosition({ nodeId: 'block-1', offset: 0 });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders a gear/settings button in the toolbar', () => {
    render(<Toolbar />);
    const buttons = screen.getAllByRole('button');
    const gearBtn = buttons.find(
      (btn) => btn.getAttribute('title') === 'Page settings',
    );
    expect(gearBtn).toBeTruthy();
  });

  it('opens page settings popup on gear button click', () => {
    render(<Toolbar />);
    const buttons = screen.getAllByRole('button');
    const gearBtn = buttons.find(
      (btn) => btn.getAttribute('title') === 'Page settings',
    )!;
    fireEvent.click(gearBtn);

    // After clicking, the popup should show paper size controls
    expect(screen.getByText('A4')).toBeTruthy();
    expect(screen.getByText('Letter')).toBeTruthy();
  });
});

describe('Toolbar PDF export with header/footer', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    useDocumentStore.setState({
      document: {
        id: 'doc-test',
        type: 'document',
        children: [
          {
            id: 'block-1',
            type: 'paragraph',
            children: [{ id: 'run-1', type: 'text', content: 'Test', marks: [], attrs: {} }],
            attrs: {},
          },
        ],
        config: {},
        attrs: {},
      },
      currentDocId: 'doc-1',
      isEditorReady: true,
      isDirty: false,
      isSaving: false,
      documentTitle: 'Test Document',
    });

    useEditorStore.getState().setCursorPosition({ nodeId: 'block-1', offset: 0 });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('includes header_footer in export payload when enabled', async () => {
    // Mock page store with headerFooter enabled
    const { usePageStore } = await import('../../stores/page-store');
    usePageStore.setState({
      config: {
        paperSize: { name: 'A4', width: 794, height: 1123 },
        orientation: 'portrait',
        margins: { top: 96, right: 96, bottom: 96, left: 96 },
        headerFooter: {
          enabled: true,
          firstPageDifferent: false,
          header: { runs: [{ id: 'r1', type: 'text', content: 'Title', marks: [], attrs: {} }], height: 36 },
          footer: { runs: [{ id: 'r2', type: 'text', content: 'Page {pageNumber}', marks: [], attrs: {} }], height: 24 },
          pageNumberPosition: 'bottom-center',
        },
      },
    });

    render(<Toolbar />);
    
    // Click PDF export button
    const buttons = screen.getAllByRole('button');
    const pdfBtn = buttons.find((btn) => btn.getAttribute('title') === 'Export to PDF');
    expect(pdfBtn).toBeTruthy();
    fireEvent.click(pdfBtn!);

    // Wait for async export
    await vi.waitFor(() => {
      expect(exportPDF).toHaveBeenCalled();
    });

    const callArgs = (exportPDF as ReturnType<typeof vi.fn>).mock.calls[0];
    const payload = callArgs[0];
    
    expect(payload.header_footer).toBeDefined();
    expect(payload.header_footer.enabled).toBe(true);
    expect(payload.header_footer.header.runs[0].content).toBe('Title');
    expect(payload.header_footer.footer.runs[0].content).toBe('Page {pageNumber}');
  });

  it('omits header_footer when disabled', async () => {
    // Mock page store with headerFooter disabled
    const { usePageStore } = await import('../../stores/page-store');
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
          pageNumberPosition: 'bottom-center',
        },
      },
    });

    render(<Toolbar />);
    
    const buttons = screen.getAllByRole('button');
    const pdfBtn = buttons.find((btn) => btn.getAttribute('title') === 'Export to PDF');
    fireEvent.click(pdfBtn!);

    await vi.waitFor(() => {
      expect(exportPDF).toHaveBeenCalled();
    });

    const callArgs = (exportPDF as ReturnType<typeof vi.fn>).mock.calls[0];
    const payload = callArgs[0];
    
    expect(payload.header_footer).toBeUndefined();
  });
});

describe('Toolbar contextual mode for header/footer editing', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    useDocumentStore.setState({
      document: {
        id: 'doc-test',
        type: 'document',
        children: [
          {
            id: 'block-1',
            type: 'paragraph',
            children: [{ id: 'run-1', type: 'text', content: 'Hello', marks: [], attrs: {} }],
            attrs: {},
          },
        ],
        config: {},
        attrs: {},
      },
      currentDocId: 'doc-1',
      isEditorReady: true,
      isDirty: false,
      isSaving: false,
      documentTitle: 'Test',
    });

    useEditorStore.getState().setCursorPosition({ nodeId: 'block-1', offset: 0 });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('shows token buttons when editingHeaderFooter is "header"', async () => {
    const { usePageStore } = await import('../../stores/page-store');
    usePageStore.setState({ editingHeaderFooter: 'header' });

    render(<Toolbar />);

    // Token buttons should be visible
    expect(screen.getByTestId('toolbar-token-pageNumber')).toBeTruthy();
    expect(screen.getByTestId('toolbar-token-totalPages')).toBeTruthy();
    expect(screen.getByTestId('toolbar-token-date')).toBeTruthy();
    expect(screen.getByTestId('toolbar-token-time')).toBeTruthy();
  });

  it('hides document-specific buttons when editingHeaderFooter is active', async () => {
    const { usePageStore } = await import('../../stores/page-store');
    usePageStore.setState({ editingHeaderFooter: 'footer' });

    render(<Toolbar />);

    // Block type selector should be hidden
    expect(screen.queryByTitle('Block type')).toBeNull();
    // List buttons should be hidden
    expect(screen.queryByTitle('Bullet list')).toBeNull();
    expect(screen.queryByTitle('Numbered list')).toBeNull();
    // Image button should be hidden
    expect(screen.queryByTitle('Insert Image')).toBeNull();
    // Table button should be hidden
    expect(screen.queryByTitle('Insert Table')).toBeNull();
  });

  it('shows limited mark toggles when editingHeaderFooter is active', async () => {
    const { usePageStore } = await import('../../stores/page-store');
    usePageStore.setState({ editingHeaderFooter: 'header' });

    render(<Toolbar />);

    // Basic mark toggles should still be visible
    expect(screen.getByTitle('Bold (Ctrl+B)')).toBeTruthy();
    expect(screen.getByTitle('Italic (Ctrl+I)')).toBeTruthy();
    expect(screen.getByTitle('Underline (Ctrl+U)')).toBeTruthy();
    // Strikethrough, superscript, subscript should be hidden in header/footer mode
    expect(screen.queryByTitle('Strikethrough')).toBeNull();
    expect(screen.queryByTitle('Superscript')).toBeNull();
    expect(screen.queryByTitle('Subscript')).toBeNull();
  });

  it('shows all buttons when editingHeaderFooter is null', async () => {
    const { usePageStore } = await import('../../stores/page-store');
    usePageStore.setState({ editingHeaderFooter: null });

    render(<Toolbar />);

    // Document buttons should be visible
    expect(screen.getByTitle('Block type')).toBeTruthy();
    expect(screen.getByTitle('Insert Image')).toBeTruthy();
    // Token buttons should NOT be visible
    expect(screen.queryByTestId('toolbar-token-pageNumber')).toBeNull();
  });
});

describe('Toolbar token insertion at cursor position', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    useDocumentStore.setState({
      document: {
        id: 'doc-test',
        type: 'document',
        children: [
          {
            id: 'block-1',
            type: 'paragraph',
            children: [{ id: 'run-1', type: 'text', content: 'Hello', marks: [], attrs: {} }],
            attrs: {},
          },
        ],
        config: {},
        attrs: {},
      },
      currentDocId: 'doc-1',
      isEditorReady: true,
      isDirty: false,
      isSaving: false,
      documentTitle: 'Test',
    });

    useEditorStore.getState().setCursorPosition({ nodeId: 'block-1', offset: 0 });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('inserts token at cursor position, not at end', async () => {
    const { usePageStore } = await import('../../stores/page-store');
    usePageStore.setState({
      editingHeaderFooter: 'header',
      hfCursorOffset: 5,
      config: {
        paperSize: { name: 'A4', width: 794, height: 1123 },
        orientation: 'portrait',
        margins: { top: 96, right: 96, bottom: 96, left: 96 },
        headerFooter: {
          enabled: true,
          firstPageDifferent: false,
          header: { runs: [{ id: 'r1', type: 'text', content: 'Hello World', marks: [] }], height: 36 },
          footer: { runs: [], height: 36 },
          pageNumberPosition: 'bottom-center',
        },
      },
    });

    const updateHeaderFooterRunsSpy = vi.spyOn(usePageStore.getState(), 'updateHeaderFooterRuns');

    render(<Toolbar />);

    const pageNumberBtn = screen.getByTestId('toolbar-token-pageNumber');
    fireEvent.click(pageNumberBtn);

    expect(updateHeaderFooterRunsSpy).toHaveBeenCalledWith('header', expect.any(Array));
    const newRuns = updateHeaderFooterRunsSpy.mock.calls[0][1];
    const allText = newRuns.map((r) => r.content).join('');
    expect(allText).toBe('Hello{pageNumber} World');
  });

  it('inserts token at start when cursor is at 0', async () => {
    const { usePageStore } = await import('../../stores/page-store');
    usePageStore.setState({
      editingHeaderFooter: 'header',
      hfCursorOffset: 0,
      config: {
        paperSize: { name: 'A4', width: 794, height: 1123 },
        orientation: 'portrait',
        margins: { top: 96, right: 96, bottom: 96, left: 96 },
        headerFooter: {
          enabled: true,
          firstPageDifferent: false,
          header: { runs: [{ id: 'r1', type: 'text', content: 'Hello', marks: [] }], height: 36 },
          footer: { runs: [], height: 36 },
          pageNumberPosition: 'bottom-center',
        },
      },
    });

    const updateHeaderFooterRunsSpy = vi.spyOn(usePageStore.getState(), 'updateHeaderFooterRuns');

    render(<Toolbar />);

    const pageNumberBtn = screen.getByTestId('toolbar-token-pageNumber');
    fireEvent.click(pageNumberBtn);

    const newRuns = updateHeaderFooterRunsSpy.mock.calls[0][1];
    const allText = newRuns.map((r) => r.content).join('');
    expect(allText).toBe('{pageNumber}Hello');
  });

  it('appends token at end when cursor is at end of text', async () => {
    const { usePageStore } = await import('../../stores/page-store');
    usePageStore.setState({
      editingHeaderFooter: 'header',
      hfCursorOffset: 5,
      config: {
        paperSize: { name: 'A4', width: 794, height: 1123 },
        orientation: 'portrait',
        margins: { top: 96, right: 96, bottom: 96, left: 96 },
        headerFooter: {
          enabled: true,
          firstPageDifferent: false,
          header: { runs: [{ id: 'r1', type: 'text', content: 'Hello', marks: [] }], height: 36 },
          footer: { runs: [], height: 36 },
          pageNumberPosition: 'bottom-center',
        },
      },
    });

    const updateHeaderFooterRunsSpy = vi.spyOn(usePageStore.getState(), 'updateHeaderFooterRuns');

    render(<Toolbar />);

    const pageNumberBtn = screen.getByTestId('toolbar-token-pageNumber');
    fireEvent.click(pageNumberBtn);

    const newRuns = updateHeaderFooterRunsSpy.mock.calls[0][1];
    const allText = newRuns.map((r) => r.content).join('');
    expect(allText).toBe('Hello{pageNumber}');
  });
});
