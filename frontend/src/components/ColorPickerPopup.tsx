import { useEffect, useRef, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { useTranslation } from 'react-i18next';

interface ColorPickerPopupProps {
  color: string;
  onChange: (color: string) => void;
  onClose: () => void;
}

export function ColorPickerPopup({ color, onChange, onClose }: ColorPickerPopupProps) {
  const { t } = useTranslation('toolbar');
  const popupRef = useRef<HTMLDivElement>(null);
  const [tempColor, setTempColor] = useState(color);

  // Sync tempColor when prop changes (e.g. reopening with a different selection)
  useEffect(() => {
    setTempColor(color);
  }, [color]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid catching the opening click
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleOk = () => {
    onChange(tempColor);
    onClose();
  };

  return (
    <div className="color-picker-popup" ref={popupRef}>
      <HexColorPicker color={tempColor} onChange={setTempColor} />
      <div className="color-picker-preview">
        <div
          className="color-picker-swatch"
          style={{ backgroundColor: tempColor }}
        />
        <span className="color-picker-hex">{tempColor.toUpperCase()}</span>
      </div>
      <div className="color-picker-actions">
        <button className="toolbar-btn link-popup-btn" onClick={handleOk}>
          {t('linkOk')}
        </button>
        <button className="toolbar-btn link-popup-btn" onClick={onClose}>
          {t('linkCancel')}
        </button>
      </div>
    </div>
  );
}
