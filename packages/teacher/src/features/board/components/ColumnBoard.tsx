import React, { memo } from 'react';
import { useWorkspace } from '@shared/hooks/useWorkspace';
import Background from './Background';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';

interface ColumnBoardProps {
  children: React.ReactNode;
}

const ColumnBoard: React.FC<ColumnBoardProps> = ({ children }) => {
  const { background } = useWorkspace();
  const setFocusedWidget = useWorkspaceStore((state) => state.setFocusedWidget);

  return (
    <div
      className="column-board-container"
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.widget-wrapper')) {
          setFocusedWidget(null);
        }
      }}
    >
      {/* Background Pattern - fixed behind scrolling content */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <Background type={background as any} />
      </div>

      {/* Scrollable column content */}
      <div className="column-board-content" style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
};

export default memo(ColumnBoard);
