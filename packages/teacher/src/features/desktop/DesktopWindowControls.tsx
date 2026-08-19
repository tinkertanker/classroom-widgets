import React from 'react';
import { FaBars, FaExpand, FaTableColumns } from 'react-icons/fa6';
import type { CompactWidgetLayout } from './useDesktopDashboardMode';

interface DesktopWindowControlsProps {
  onOpenCanvas: () => void;
  compactLayout: CompactWidgetLayout;
  onCompactLayoutChange: (layout: CompactWidgetLayout) => void;
}

const DesktopWindowControls: React.FC<DesktopWindowControlsProps> = ({
  onOpenCanvas,
  compactLayout,
  onCompactLayoutChange
}) => {
  return (
    <div className="desktop-window-controls" data-dashboard-interactive="true">
      <button
        type="button"
        className="desktop-window-layout-button"
        onClick={() => onCompactLayoutChange(compactLayout === 'row' ? 'column' : 'row')}
        aria-label={`Arrange widgets in a ${compactLayout === 'row' ? 'column' : 'row'}`}
        title={`Arrange in a ${compactLayout === 'row' ? 'column' : 'row'}`}
      >
        {compactLayout === 'row' ? <FaTableColumns aria-hidden="true" /> : <FaBars aria-hidden="true" />}
      </button>
      <button
        type="button"
        className="desktop-window-mode-button"
        onClick={onOpenCanvas}
        aria-label="Open canvas"
      >
        <FaExpand aria-hidden="true" />
      </button>
    </div>
  );
};

export default DesktopWindowControls;
