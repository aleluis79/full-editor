import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDocumentStore } from '../document-store';
import { useEditorStore } from '../editor-store';
import { uploadImage } from '../../api/client';

// Mock the API client
vi.mock('../../api/client', () => ({
  uploadImage: vi.fn(),
}));

// Mock the page-store so newDocument doesn't fail
vi.mock('../page-store', () => ({
  usePageStore: {
    getState: () => ({
      config: { paperSize: { name: 'A4' }, margins: { top: 72, right: 72, bottom: 72, left: 72 } },
      updatePaperSize: vi.fn(),
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
      'Only PNG, JPEG, GIF, and WebP images are supported',
    );
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it('validates file size and rejects files over 10MB', async () => {
    // Create a file over 10MB
    const largeContent = new ArrayBuffer(11 * 1024 * 1024);
    const file = new File([largeContent], 'large.png', { type: 'image/png' });
    const store = useDocumentStore.getState();

    await expect(store.uploadAndInsertImage(file)).rejects.toThrow(
      'Image must be under 10MB',
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

    await expect(store.uploadAndInsertImage(file)).rejects.toThrow('No cursor position');
  });
});
