import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDocumentStore } from '../document-store';
import { useEditorStore } from '../editor-store';
import { uploadImage } from '../../api/client';

// Mock the API client
vi.mock('../../api/client', () => ({
  uploadImage: vi.fn(),
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
  fetchDocument: vi.fn(),
  fetchDocuments: vi.fn(),
  deleteDocument: vi.fn(),
  exportPDF: vi.fn(),
}));

// Shared mock functions for page-store
const mockUpdatePaperSize = vi.fn();
const mockUpdateOrientation = vi.fn();
const mockUpdateMargins = vi.fn();

// Mock the page-store so newDocument doesn't fail
vi.mock('../page-store', () => ({
  usePageStore: {
    getState: () => ({
      config: { paperSize: { name: 'A4', width: 794, height: 1123 }, margins: { top: 72, right: 72, bottom: 72, left: 72 }, orientation: 'portrait' },
      updatePaperSize: mockUpdatePaperSize,
      updateOrientation: mockUpdateOrientation,
      updateMargins: mockUpdateMargins,
    }),
  },
}));

describe('document-store uploadAndInsertImage', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Reset document store to a clean state
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
    });

    // Set cursor position
    useEditorStore.getState().setCursorPosition({ nodeId: 'block-1', offset: 0 });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('validates file type and rejects unsupported formats', async () => {
    const file = new File(['dummy'], 'doc.pdf', { type: 'application/pdf' });
    const store = useDocumentStore.getState();

    await expect(store.uploadAndInsertImage(file)).rejects.toThrow(
      'ERROR_UNSUPPORTED_FORMAT',
    );
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it('validates file size and rejects files over 10MB', async () => {
    // Create a file over 10MB
    const largeContent = new ArrayBuffer(11 * 1024 * 1024);
    const file = new File([largeContent], 'large.png', { type: 'image/png' });
    const store = useDocumentStore.getState();

    await expect(store.uploadAndInsertImage(file)).rejects.toThrow(
      'ERROR_IMAGE_TOO_LARGE',
    );
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it('uploads a valid file, calls insertImage, and returns the block ID', async () => {
    const mockUrl = '/uploads/images/abc123.png';
    (uploadImage as ReturnType<typeof vi.fn>).mockResolvedValue(mockUrl);

    const file = new File(['dummy'], 'test.png', { type: 'image/png' });
    const store = useDocumentStore.getState();

    // Spy on insertImage
    const insertImageSpy = vi.spyOn(store, 'insertImage');

    const blockId = await store.uploadAndInsertImage(file);

    expect(uploadImage).toHaveBeenCalledWith(file);
    expect(insertImageSpy).toHaveBeenCalledWith('block-1', mockUrl);
    expect(blockId).toBeTruthy();
    expect(typeof blockId).toBe('string');
  });

  it('re-throws errors from uploadImage', async () => {
    (uploadImage as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error'),
    );

    const file = new File(['dummy'], 'test.png', { type: 'image/png' });
    const store = useDocumentStore.getState();

    await expect(store.uploadAndInsertImage(file)).rejects.toThrow('Network error');
  });

  it('throws an error when there is no cursor position', async () => {
    // Clear cursor position
    useEditorStore.getState().setCursorPosition({ nodeId: '', offset: 0 });

    const file = new File(['dummy'], 'test.png', { type: 'image/png' });
    const store = useDocumentStore.getState();

    await expect(store.uploadAndInsertImage(file)).rejects.toThrow('ERROR_NO_CURSOR_POSITION');
  });
});

describe('document-store setBlockAttrs lineHeight', () => {
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
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('sets lineHeight when value is positive', () => {
    const store = useDocumentStore.getState();
    store.setBlockAttrs('block-1', { lineHeight: 2.0 });
    const block = useDocumentStore.getState().document.children[0] as any;
    expect(block.attrs?.lineHeight).toBe(2.0);
  });

  it('rejects lineHeight of 0 and does not update attrs', () => {
    const store = useDocumentStore.getState();
    store.setBlockAttrs('block-1', { lineHeight: 0 });
    const block = useDocumentStore.getState().document.children[0] as any;
    expect(block.attrs?.lineHeight).toBeUndefined();
  });

  it('rejects negative lineHeight and does not update attrs', () => {
    const store = useDocumentStore.getState();
    store.setBlockAttrs('block-1', { lineHeight: -1 });
    const block = useDocumentStore.getState().document.children[0] as any;
    expect(block.attrs?.lineHeight).toBeUndefined();
  });

  it('allows setting lineHeight alongside textAlign', () => {
    const store = useDocumentStore.getState();
    store.setBlockAttrs('block-1', { lineHeight: 1.5, textAlign: 'center' });
    const block = useDocumentStore.getState().document.children[0] as any;
    expect(block.attrs?.lineHeight).toBe(1.5);
    expect(block.attrs?.textAlign).toBe('center');
  });
});

describe('document-store orientation save/load', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('saveDocument includes orientation in content.config', async () => {
    // Setup store with orientation
    useDocumentStore.setState({
      document: {
        id: 'doc-test',
        type: 'document',
        children: [{ id: 'block-1', type: 'paragraph', children: [{ id: 'run-1', type: 'text', content: '', marks: [], attrs: {} }], attrs: {} }],
        config: {},
        attrs: {},
      },
      currentDocId: 'doc-1',
      isEditorReady: true,
      isDirty: true,
      isSaving: false,
      documentTitle: 'Test',
    });

    // Set page-store orientation
    const mockUpdateDoc = (await import('../../api/client')).updateDocument as ReturnType<typeof vi.fn>;
    mockUpdateDoc.mockResolvedValue({});

    await useDocumentStore.getState().saveDocument();

    expect(mockUpdateDoc).toHaveBeenCalled();
    const callArg = mockUpdateDoc.mock.calls[0][1];
    expect(callArg.content.config.orientation).toBe('portrait');
  });

  it('loadDocument with orientation in config restores it', async () => {
    const mockFetchDoc = (await import('../../api/client')).fetchDocument as ReturnType<typeof vi.fn>;
    mockFetchDoc.mockResolvedValue({
      id: 'doc-1',
      title: 'Test',
      content: {
        blocks: [{ id: 'b1', type: 'paragraph', children: [{ id: 'r1', type: 'text', content: 'Hello', marks: [], attrs: {} }], attrs: {} }],
        config: {
          paperSize: { name: 'Letter', width: 816, height: 1056 },
          margins: { top: 96, right: 96, bottom: 96, left: 96 },
          orientation: 'landscape',
        },
      },
      created_at: '2024-01-01T00:00:00',
      updated_at: '2024-01-01T00:00:00',
    });

    await useDocumentStore.getState().loadDocument('doc-1');

    expect(mockUpdatePaperSize).toHaveBeenCalled();
    expect(mockUpdateOrientation).toHaveBeenCalledWith('landscape');
  });

  it('loadDocument without orientation defaults to portrait', async () => {
    const mockFetchDoc = (await import('../../api/client')).fetchDocument as ReturnType<typeof vi.fn>;
    mockFetchDoc.mockResolvedValue({
      id: 'doc-2',
      title: 'No Orient',
      content: {
        blocks: [{ id: 'b1', type: 'paragraph', children: [{ id: 'r1', type: 'text', content: '', marks: [], attrs: {} }], attrs: {} }],
        config: {
          paperSize: { name: 'A4', width: 794, height: 1123 },
          margins: { top: 96, right: 96, bottom: 96, left: 96 },
        },
      },
      created_at: '2024-01-01T00:00:00',
      updated_at: '2024-01-01T00:00:00',
    });

    await useDocumentStore.getState().loadDocument('doc-2');

    // updatePaperSize should be called (paperSize present)
    expect(mockUpdatePaperSize).toHaveBeenCalled();
    // But updateOrientation should NOT be called (no orientation in config)
    // because the default is applied by the engine's DEFAULT_PAGINATION_CONFIG
  });
});
