import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorPickerPopup } from '../ColorPickerPopup';

// ── Mocks ───────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: (ns: string) => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        'toolbar:linkOk': 'OK',
        'toolbar:linkCancel': 'Cancel',
      };
      return labels[`${ns}:${key}`] ?? key;
    },
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
}));

// react-colorful uses canvas — mock it
vi.mock('react-colorful', () => ({
  HexColorPicker: ({ color, onChange }: { color: string; onChange: (c: string) => void }) => (
    <div data-testid="hex-color-picker">
      <input
        data-testid="mock-color-input"
        type="text"
        value={color}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  ),
}));

describe('ColorPickerPopup', () => {
  it('renders with the initial color', () => {
    render(
      <ColorPickerPopup color="#ff0000" onChange={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByText('#FF0000')).toBeTruthy();
  });

  it('renders OK and Cancel buttons with i18n labels', () => {
    render(
      <ColorPickerPopup color="#000000" onChange={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByText('OK')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('calls onChange with current color when OK is clicked', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(
      <ColorPickerPopup color="#ff0000" onChange={onChange} onClose={onClose} />,
    );
    fireEvent.click(screen.getByText('OK'));
    expect(onChange).toHaveBeenCalledWith('#ff0000');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose without calling onChange when Cancel is clicked', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(
      <ColorPickerPopup color="#ff0000" onChange={onChange} onClose={onClose} />,
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onChange).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(
      <ColorPickerPopup color="#000000" onChange={vi.fn()} onClose={onClose} />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('displays the color swatch with the correct background', () => {
    render(
      <ColorPickerPopup color="#00ff00" onChange={vi.fn()} onClose={vi.fn()} />,
    );
    const swatch = document.querySelector('.color-picker-swatch') as HTMLElement;
    expect(swatch).not.toBeNull();
    expect(swatch.style.backgroundColor).toBe('rgb(0, 255, 0)');
  });

  it('closes when clicking outside the popup', async () => {
    const onClose = vi.fn();
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <ColorPickerPopup color="#000000" onChange={vi.fn()} onClose={onClose} />
      </div>,
    );
    // Wait for the delayed event listener registration
    await new Promise((r) => setTimeout(r, 10));
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalled();
  });
});
