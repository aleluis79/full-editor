import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { create } from 'zustand';
import { Editor } from '../Editor';
import { useDocumentStore } from '../../stores/document-store';
import { useEditorStore } from '../../stores/editor-store';
import { uploadImage } from '../../api/client';

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

// Stub out heavy sub-components so Editor can be rendered in isolation
vi.mock('../DocumentView', () => ({
  DocumentView: function DocumentView() { return null; },
}));
vi.mock('../Toolbar', () => ({
  Toolbar: function Toolbar() { return null; },
}));
vi.mock('../SelectionOverlay', () => ({
  SelectionOverlay: function SelectionOverlay() { return null; },
}));

// Mock page store with a proper Zustand hook
vi.mock('../../stores/page-store', () => ({
  usePageStore: create(() => ({
    config: { paperSize: { name: 'A4', width: 595, height: 842 }, margins: { top: 72, right: 72, bottom: 72, left: 72 } },
    pages: [],
    availablePaperSizes: [{ name: 'A4', width: 595, height: 842 }],
    paginate: vi.fn(),
    updatePaperSize: vi.fn(),
  })),
}));

// Mock layout store with a proper Zustand hook
vi.mock('../../stores/layout-store', () => ({
  useLayoutStore: create(() => ({
    layout: null,
    calculateLayout: vi.fn(),
  })),
}));

describe('Editor paste handler', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Setup document store with minimal document
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

    // Set cursor position
    useEditorStore.getState().setCursorPosition({ nodeId: 'block-1', offset: 0 });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  function getTextarea(): HTMLTextAreaElement {
    return document.querySelector('.hidden-textarea') as HTMLTextAreaElement;
  }

  it('detects image in clipboardData.files and triggers upload', async () => {
    const mockUrl = '/uploads/images/test.png';
    (uploadImage as ReturnType<typeof vi.fn>).mockResolvedValue(mockUrl);

    // Spy on uploadAndInsertImage
    const uploadAndInsertImageSpy = vi.spyOn(
      useDocumentStore.getState(),
      'uploadAndInsertImage',
    ).mockResolvedValue('block-2');

    render(<Editor />);

    const textarea = getTextarea();
    expect(textarea).toBeTruthy();

    // Create a paste event with clipboardData.files containing an image
    const file = new File(['dummy'], 'test.png', { type: 'image/png' });
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        files: [file],
        items: [{ kind: 'file', type: 'image/png' }],
        types: ['Files'],
        getData: () => '',
      },
      writable: false,
    });

    textarea.dispatchEvent(pasteEvent);

    // The handler calls uploadAndInsertImage synchronously (or via microtask)
    // so a small delay lets React finish its render cycle.
    await new Promise((r) => setTimeout(r, 10));

    expect(uploadAndInsertImageSpy).toHaveBeenCalledWith(file);
  });

  it('detects image in clipboardData.items (Chromium) and triggers upload', async () => {
    (uploadImage as ReturnType<typeof vi.fn>).mockResolvedValue('/uploads/images/img.webp');

    const uploadAndInsertImageSpy = vi.spyOn(
      useDocumentStore.getState(),
      'uploadAndInsertImage',
    ).mockResolvedValue('block-2');

    render(<Editor />);

    const textarea = getTextarea();
    expect(textarea).toBeTruthy();

    // Create paste event with items (no files) — Chromium behavior
    const blob = new Blob(['dummy'], { type: 'image/webp' });
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        files: [] as File[],
        items: [
          {
            kind: 'file',
            type: 'image/webp',
            getAsFile: () => blob,
          },
        ],
        types: ['Files'],
        getData: () => '',
      },
      writable: false,
    });

    textarea.dispatchEvent(pasteEvent);

    await new Promise((r) => setTimeout(r, 10));

    expect(uploadAndInsertImageSpy).toHaveBeenCalledWith(blob);
  });

  it('falls through to default paste when clipboard has no images', async () => {
    const uploadAndInsertImageSpy = vi.spyOn(
      useDocumentStore.getState(),
      'uploadAndInsertImage',
    ).mockResolvedValue('block-2');

    render(<Editor />);

    const textarea = getTextarea();
    expect(textarea).toBeTruthy();

    // Create paste event with text only
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        files: [] as File[],
        items: [{ kind: 'string', type: 'text/plain' }],
        types: ['text/plain'],
        getData: () => 'Hello',
      },
      writable: false,
    });

    textarea.dispatchEvent(pasteEvent);

    // Give a tick for the handler to run
    await new Promise((r) => setTimeout(r, 50));

    expect(uploadAndInsertImageSpy).not.toHaveBeenCalled();
  });
});
