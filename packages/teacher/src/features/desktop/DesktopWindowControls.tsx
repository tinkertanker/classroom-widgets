import React from 'react';
import { FaBars, FaCompress, FaExpand, FaTableColumns } from 'react-icons/fa6';
import type { CompactWidgetLayout, DashboardWindowMode } from './useDesktopDashboardMode';

interface DesktopWindowControlsProps {
  mode: DashboardWindowMode;
  onModeChange: (mode: DashboardWindowMode) => void;
  compactLayout: CompactWidgetLayout;
  onCompactLayoutChange: (layout: CompactWidgetLayout) => void;
}

const DesktopWindowControls: React.FC<DesktopWindowControlsProps> = ({
  mode,
  onModeChange,
  compactLayout,
  onCompactLayoutChange
}) => {
  const isCompact = mode === 'compact';
  const nextMode: DashboardWindowMode = isCompact ? 'canvas' : 'compact';

  return (
    <div className="desktop-window-controls" data-dashboard-interactive="true">
      {isCompact ? (
        <button
          type="button"
          className="desktop-window-layout-button"
          onClick={() => onCompactLayoutChange(compactLayout === 'row' ? 'column' : 'row')}
          aria-label={`Arrange widgets in a ${compactLayout === 'row' ? 'column' : 'row'}`}
          title={`Arrange in a ${compactLayout === 'row' ? 'column' : 'row'}`}
        >
          {compactLayout === 'row' ? <FaTableColumns aria-hidden="true" /> : <FaBars aria-hidden="true" />}
        </button>
      ) : (
        <div className="desktop-window-identity">
          <span className="desktop-window-status" aria-hidden="true" />
          <span>
            <strong>Classroom Widgets</strong>
            <small>Canvas</small>
          </span>
        </div>
      )}
      <button
        type="button"
        className="desktop-window-mode-button"
        onClick={() => onModeChange(nextMode)}
        aria-label={isCompact ? 'Open canvas' : 'Switch to compact overlay'}
      >
        {isCompact ? <FaExpand aria-hidden="true" /> : <FaCompress aria-hidden="true" />}
        {!isCompact && <span>Compact</span>}
      </button>
    </div>
  );
};

export default DesktopWindowControls;
