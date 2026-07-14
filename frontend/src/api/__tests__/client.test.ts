import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uploadImage } from '../client';

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
    await expect(uploadImage(file)).rejects.toThrow('Upload failed');
  });

  it('falls back when error response JSON parsing fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('Invalid JSON')),
    });

    const file = new File(['dummy'], 'test.png', { type: 'image/png' });
    await expect(uploadImage(file)).rejects.toThrow('Upload failed');
  });
});
