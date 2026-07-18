import { useEffect, useState, useRef } from 'react';
import { usePageStore } from '../stores/page-store';

interface PageSettingsPopupProps {
  onClose: () => void;
}

/** Convert CSS pixels to display points: points = cssPx * 72 / 96 */
function cssPxToPoints(cssPx: number): number {
  return Math.round(cssPx * 72 / 96);
}

/** Convert display points to CSS pixels: cssPx = points * 96 / 72 */
function pointsToCssPx(points: number): number {
  return Math.round(points * 96 / 72);
}

export function PageSettingsPopup({ onClose }: PageSettingsPopupProps) {
  const config = usePageStore((s) => s.config);
  const availablePaperSizes = usePageStore((s) => s.availablePaperSizes);
  const updatePaperSize = usePageStore((s) => s.updatePaperSize);
  const updateOrientation = usePageStore((s) => s.updateOrientation);
  const updateMargins = usePageStore((s) => s.updateMargins);

  const popupRef = useRef<HTMLDivElement>(null);

  // Margin state in display points
  const [marginTop, setMarginTop] = useState(() => cssPxToPoints(config.margins.top));
  const [marginRight, setMarginRight] = useState(() => cssPxToPoints(config.margins.right));
  const [marginBottom, setMarginBottom] = useState(() => cssPxToPoints(config.margins.bottom));
  const [marginLeft, setMarginLeft] = useState(() => cssPxToPoints(config.margins.left));

  // Sync margins when config changes externally
  useEffect(() => {
    setMarginTop(cssPxToPoints(config.margins.top));
    setMarginRight(cssPxToPoints(config.margins.right));
    setMarginBottom(cssPxToPoints(config.margins.bottom));
    setMarginLeft(cssPxToPoints(config.margins.left));
  }, [config.margins]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handlePaperSize = (name: string) => {
    const ps = availablePaperSizes.find((p) => p.name === name);
    if (ps) {
      updatePaperSize(ps);
    }
  };

  const handleOrientation = (orientation: 'portrait' | 'landscape') => {
    updateOrientation(orientation);
  };

  const handleMarginBlur = (key: 'top' | 'right' | 'bottom' | 'left', value: string) => {
    const points = Math.max(0, parseInt(value, 10) || 0);
    const cssPx = pointsToCssPx(points);

    // Update local state
    switch (key) {
      case 'top': setMarginTop(points); break;
      case 'right': setMarginRight(points); break;
      case 'bottom': setMarginBottom(points); break;
      case 'left': setMarginLeft(points); break;
    }

    // Update store
    updateMargins({ [key]: cssPx });
  };

  const isLandscape = config.orientation === 'landscape';

  return (
    <div
      className="page-settings-popover"
      ref={popupRef}
      onMouseDown={(e) => {
        // Prevent toolbar textarea focus-steal, but allow input fields to receive focus
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return;
        e.preventDefault();
      }}
    >
      {/* Paper Size */}
      <div className="page-settings-section">
        <label className="page-settings-label">Paper Size</label>
        <div className="page-settings-paper-group">
          {availablePaperSizes.map((ps) => (
            <button
              key={ps.name}
              className={`page-settings-paper-btn${config.paperSize.name === ps.name ? ' active' : ''}`}
              onClick={() => handlePaperSize(ps.name)}
            >
              {ps.name}
            </button>
          ))}
        </div>
      </div>

      {/* Orientation */}
      <div className="page-settings-section">
        <label className="page-settings-label">Orientation</label>
        <div className="page-settings-orientation-group">
          <button
            className={`page-settings-orientation-btn${!isLandscape ? ' active' : ''}`}
            onClick={() => handleOrientation('portrait')}
          >
            Portrait
          </button>
          <button
            className={`page-settings-orientation-btn${isLandscape ? ' active' : ''}`}
            onClick={() => handleOrientation('landscape')}
          >
            Landscape
          </button>
        </div>
      </div>

      {/* Margins */}
      <div className="page-settings-section">
        <label className="page-settings-label">Margins (points)</label>
        <div className="page-settings-margins-grid">
          <div className="page-settings-margin-field">
            <label className="page-settings-margin-label">Top</label>
            <input
              type="number"
              className="toolbar-select toolbar-select-small"
              value={marginTop}
              min={0}
              onChange={(e) => setMarginTop(parseInt(e.target.value, 10) || 0)}
              onBlur={(e) => handleMarginBlur('top', e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
          </div>
          <div className="page-settings-margin-field">
            <label className="page-settings-margin-label">Right</label>
            <input
              type="number"
              className="toolbar-select toolbar-select-small"
              value={marginRight}
              min={0}
              onChange={(e) => setMarginRight(parseInt(e.target.value, 10) || 0)}
              onBlur={(e) => handleMarginBlur('right', e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
          </div>
          <div className="page-settings-margin-field">
            <label className="page-settings-margin-label">Bottom</label>
            <input
              type="number"
              className="toolbar-select toolbar-select-small"
              value={marginBottom}
              min={0}
              onChange={(e) => setMarginBottom(parseInt(e.target.value, 10) || 0)}
              onBlur={(e) => handleMarginBlur('bottom', e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
          </div>
          <div className="page-settings-margin-field">
            <label className="page-settings-margin-label">Left</label>
            <input
              type="number"
              className="toolbar-select toolbar-select-small"
              value={marginLeft}
              min={0}
              onChange={(e) => setMarginLeft(parseInt(e.target.value, 10) || 0)}
              onBlur={(e) => handleMarginBlur('left', e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
