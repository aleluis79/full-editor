import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { create } from 'zustand';
import { Toolbar } from '../Toolbar';
import { useDocumentStore } from '../../stores/document-store';
import { useEditorStore } from '../../stores/editor-store';

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
    config: { paperSize: { name: 'A4', width: 595, height: 842 }, margins: { top: 72, right: 72, bottom: 72, left: 72 } },
    pages: [],
    availablePaperSizes: [{ name: 'A4', width: 595, height: 842 }],
    paginate: vi.fn(),
    updatePaperSize: vi.fn(),
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
