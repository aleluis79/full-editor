import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { create } from 'zustand';
import { PageSettingsPopup } from '../PageSettingsPopup';
import { usePageStore } from '../../stores/page-store';

const { mockUpdateHeaderFooter } = vi.hoisted(() => ({
  mockUpdateHeaderFooter: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: (ns: string) => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        'page:paperSize': 'Paper Size',
        'page:orientation': 'Orientation',
        'page:portrait': 'Portrait',
        'page:landscape': 'Landscape',
        'page:margins': 'Margins (points)',
        'page:top': 'Top',
        'page:right': 'Right',
        'page:bottom': 'Bottom',
        'page:left': 'Left',
        'page:headersFooters': 'Headers / Footers',
        'page:enableHeadersFooters': 'Enable Headers/Footers',
        'page:differentFirstPage': 'Different first page',
        'page:header': 'Header',
        'page:footer': 'Footer',
        'page:height': 'Height (pt)',
        'page:insertToken': 'Insert token',
        'page:pageNumber': 'Page #',
        'page:totalPages': 'Total pages',
        'page:date': 'Date',
        'page:time': 'Time',
        'page:pageNumberPosition': 'Page number position',
        'page:topLeft': 'Top Left',
        'page:topCenter': 'Top Center',
        'page:topRight': 'Top Right',
        'page:bottomLeft': 'Bottom Left',
        'page:bottomCenter': 'Bottom Center',
        'page:bottomRight': 'Bottom Right',
      };
      return labels[`${ns}:${key}`] ?? key;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

vi.mock('../../stores/page-store', () => ({
  usePageStore: create(() => ({
    config: {
      paperSize: { name: 'A4', width: 794, height: 1123 },
      orientation: 'portrait' as const,
      margins: { top: 96, right: 96, bottom: 96, left: 96 },
      headerFooter: {
        enabled: false,
        firstPageDifferent: true,
        header: { runs: [], height: 48 },
        footer: { runs: [], height: 48 },
        pageNumberPosition: 'bottom-center' as const,
      },
    },
    pages: [],
    totalPages: 0,
    availablePaperSizes: [
      { name: 'A4', width: 794, height: 1123 },
      { name: 'Letter', width: 816, height: 1056 },
      { name: 'Legal', width: 816, height: 1344 },
    ],
    paginate: vi.fn(),
    updatePaperSize: vi.fn(),
    updateOrientation: vi.fn(),
    updateMargins: vi.fn(),
    updateHeaderFooter: mockUpdateHeaderFooter,
    updatePageNumberPosition: vi.fn(),
  })),
}));

vi.mock('../../stores/layout-store', () => ({
  useLayoutStore: create(() => ({
    layout: null,
    calculateLayout: vi.fn(),
  })),
}));

vi.mock('../../api/client', () => ({
  uploadImage: vi.fn(),
  fetchDocuments: vi.fn().mockResolvedValue([]),
  fetchDocument: vi.fn(),
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
  deleteDocument: vi.fn(),
  exportPDF: vi.fn(),
}));

function renderPopup() {
  return render(<PageSettingsPopup onClose={vi.fn()} />);
}

describe('PageSettingsPopup - Headers/Footers', () => {
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
          header: { runs: [], height: 48 },
          footer: { runs: [], height: 48 },
          pageNumberPosition: 'bottom-center',
        },
      },
    });
  });

  it('toggle enables headers/footers', () => {
    renderPopup();

    const toggle = screen.getByTestId('hf-enabled-toggle') as HTMLInputElement;
    expect(toggle.checked).toBe(false);

    fireEvent.click(toggle);

    expect(mockUpdateHeaderFooter).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });

  it('shows header/footer config controls when enabled (no text inputs)', () => {
    usePageStore.setState({
      config: {
        paperSize: { name: 'A4', width: 794, height: 1123 },
        orientation: 'portrait',
        margins: { top: 96, right: 96, bottom: 96, left: 96 },
        headerFooter: {
          enabled: true,
          firstPageDifferent: true,
          header: { runs: [], height: 48 },
          footer: { runs: [], height: 48 },
          pageNumberPosition: 'bottom-center',
        },
      },
    });

    renderPopup();

    // Text inputs should NOT exist (moved to inline editor)
    expect(screen.queryByTestId('hf-header-text')).toBeNull();
    expect(screen.queryByTestId('hf-footer-text')).toBeNull();
    // Token buttons should NOT exist (moved to toolbar)
    expect(screen.queryByTestId('hf-header-token-pageNumber')).toBeNull();
    expect(screen.queryByTestId('hf-footer-token-totalPages')).toBeNull();
    // Config controls should still exist
    expect(screen.getByTestId('hf-first-page-different')).toBeTruthy();
    expect(screen.getByTestId('hf-header-height')).toBeTruthy();
    expect(screen.getByTestId('hf-footer-height')).toBeTruthy();
  });

  it('hides header/footer config controls when disabled', () => {
    renderPopup();

    expect(screen.queryByTestId('hf-header-height')).toBeNull();
    expect(screen.queryByTestId('hf-footer-height')).toBeNull();
    expect(screen.queryByTestId('hf-first-page-different')).toBeNull();
  });

  it('changing header height updates header.height in CSS pixels', () => {
    usePageStore.setState({
      config: {
        paperSize: { name: 'A4', width: 794, height: 1123 },
        orientation: 'portrait',
        margins: { top: 96, right: 96, bottom: 96, left: 96 },
        headerFooter: {
          enabled: true,
          firstPageDifferent: true,
          header: { runs: [], height: 48 },
          footer: { runs: [], height: 48 },
          pageNumberPosition: 'bottom-center',
        },
      },
    });

    renderPopup();

    const heightInput = screen.getByTestId('hf-header-height') as HTMLInputElement;
    fireEvent.change(heightInput, { target: { value: '54' } });
    fireEvent.blur(heightInput);

    expect(mockUpdateHeaderFooter).toHaveBeenCalledWith(
      expect.objectContaining({
        header: expect.objectContaining({
          height: 72,
        }),
      }),
    );
  });

  it('changing footer height updates footer.height in CSS pixels', () => {
    usePageStore.setState({
      config: {
        paperSize: { name: 'A4', width: 794, height: 1123 },
        orientation: 'portrait',
        margins: { top: 96, right: 96, bottom: 96, left: 96 },
        headerFooter: {
          enabled: true,
          firstPageDifferent: true,
          header: { runs: [], height: 48 },
          footer: { runs: [], height: 48 },
          pageNumberPosition: 'bottom-center',
        },
      },
    });

    renderPopup();

    const heightInput = screen.getByTestId('hf-footer-height') as HTMLInputElement;
    fireEvent.change(heightInput, { target: { value: '36' } });
    fireEvent.blur(heightInput);

    expect(mockUpdateHeaderFooter).toHaveBeenCalledWith(
      expect.objectContaining({
        footer: expect.objectContaining({
          height: 48,
        }),
      }),
    );
  });

  it('does not display header/footer text inputs (moved to inline editor)', () => {
    usePageStore.setState({
      config: {
        paperSize: { name: 'A4', width: 794, height: 1123 },
        orientation: 'portrait',
        margins: { top: 96, right: 96, bottom: 96, left: 96 },
        headerFooter: {
          enabled: true,
          firstPageDifferent: true,
          header: {
            runs: [
              { id: 'r1', type: 'text' as const, content: 'Page ', marks: [] },
              { id: 'r2', type: 'text' as const, content: '{pageNumber}', marks: [] },
            ],
            height: 48,
          },
          footer: { runs: [], height: 48 },
          pageNumberPosition: 'bottom-center',
        },
      },
    });

    renderPopup();

    // Text inputs should not exist (editing moved to inline editor)
    expect(screen.queryByTestId('hf-header-text')).toBeNull();
    expect(screen.queryByTestId('hf-footer-text')).toBeNull();
    // Token buttons should not exist (moved to toolbar)
    expect(screen.queryByTestId('hf-header-token-pageNumber')).toBeNull();
    expect(screen.queryByTestId('hf-footer-token-totalPages')).toBeNull();
    // But height inputs should still exist
    expect(screen.getByTestId('hf-header-height')).toBeTruthy();
    expect(screen.getByTestId('hf-footer-height')).toBeTruthy();
  });
});
