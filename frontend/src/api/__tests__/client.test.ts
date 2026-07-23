import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uploadImage, exportPDF } from '../client';
import type { ExportPDFData } from '../client';

const API_BASE = 'http://localhost:8000/api';

describe('uploadImage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends a POST request with multipart form data and returns the URL on success', async () => {
    const mockResponse = { url: '/uploads/images/abc123.png' };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const file = new File(['dummy'], 'test.png', { type: 'image/png' });
    const result = await uploadImage(file);

    expect(result).toBe('/uploads/images/abc123.png');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE}/images/upload`,
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }),
    );

    // Verify FormData contains the file
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const formData = callArgs[1].body as FormData;
    expect(formData.get('file')).toBe(file);
  });

  it('throws a descriptive error when the upload fails with a server error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ detail: 'Internal server error' }),
    });

    const file = new File(['dummy'], 'test.png', { type: 'image/png' });
    await expect(uploadImage(file)).rejects.toThrow('Internal server error');
  });

  it('falls back to a generic error when the error response has no detail field', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({}),
    });

    const file = new File(['dummy'], 'test.png', { type: 'image/png' });
    await expect(uploadImage(file)).rejects.toThrow('ERROR_UPLOAD_FAILED');
  });

  it('falls back when error response JSON parsing fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('Invalid JSON')),
    });

    const file = new File(['dummy'], 'test.png', { type: 'image/png' });
    await expect(uploadImage(file)).rejects.toThrow('ERROR_UPLOAD_FAILED');
  });
});

describe('exportPDF with header_footer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends header_footer in the payload when provided', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['test'], { type: 'application/pdf' })),
    });

    const data: ExportPDFData = {
      content: { children: [] },
      paper_size: 'A4',
      header_footer: {
        enabled: true,
        firstPageDifferent: false,
        header: {
          runs: [{ content: 'Title', marks: [], attrs: {} }],
          height: 36,
        },
        footer: {
          runs: [{ content: 'Page {pageNumber}', marks: [], attrs: {} }],
          height: 24,
        },
        scope: 'all',
      },
    };

    await exportPDF(data, 'test.pdf');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE}/export/pdf`,
      expect.objectContaining({
        method: 'POST',
        body: expect.any(String),
      }),
    );

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.header_footer).toBeDefined();
    expect(body.header_footer.enabled).toBe(true);
    expect(body.header_footer.header.runs[0].content).toBe('Title');
    expect(body.header_footer.footer.runs[0].content).toBe('Page {pageNumber}');
  });

  it('omits header_footer when not provided', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['test'], { type: 'application/pdf' })),
    });

    const data: ExportPDFData = {
      content: { children: [] },
      paper_size: 'A4',
    };

    await exportPDF(data, 'test.pdf');

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.header_footer).toBeUndefined();
  });

  it('supports all scope values', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['test'], { type: 'application/pdf' })),
    });

    for (const scope of ['all', 'exceptFirst', 'firstOnly'] as const) {
      const data: ExportPDFData = {
        content: { children: [] },
        header_footer: {
          enabled: true,
          firstPageDifferent: false,
          header: { runs: [], height: 36 },
          footer: { runs: [], height: 24 },
          scope,
        },
      };

      await exportPDF(data, 'test.pdf');

      const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.header_footer.scope).toBe(scope);

      vi.clearAllMocks();
    }
  });
});
