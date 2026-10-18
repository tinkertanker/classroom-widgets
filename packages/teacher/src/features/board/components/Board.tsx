import React, { useRef, memo } from 'react';
import { useWorkspace } from '@shared/hooks/useWorkspace';
import { useZoomWithScroll } from '../hooks/useZoomWithScroll';
import Background from './Background';
import { useWorkspaceUiStore } from '../../../store/workspaceUiStore';

interface BoardProps {
  children: React.ReactNode;
  onBoardClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  stickerMode: boolean;
}

const Board: React.FC<BoardProps> = ({ children, onBoardClick, stickerMode }) => {
  const { scale, background } = useWorkspace();
  const setFocusedWidget = useWorkspaceUiStore((state) => state.setFocusedWidget);

  const boardContainerRef = useRef<HTMLDivElement>(null);
  const boardScaleRef = useRef<HTMLDivElement>(null);

  // Enable pinch zoom on the board container
  useZoomWithScroll(boardContainerRef, boardScaleRef, {
    minScale: 0.5,
    maxScale: 2,
    scaleSensitivity: 1  // Increased from 0.01 for more responsive pinch
  });

  return (
    <div 
      className="board-scroll-container" 
      ref={boardContainerRef}
      onClick={(e) => {
        // Clear focus when clicking anywhere on the canvas (including scroll area)
        const target = e.target as HTMLElement;
        // Check if we clicked on the canvas itself (not on a widget)
        if (!target.closest('.widget-wrapper')) {
          setFocusedWidget(null);
        }
      }}
    >
      
      {/* Size wrapper to ensure correct scroll area */}
      <div style={{
        width: `${3000 * scale}px`,
        height: `${2000 * scale}px`,
        position: 'relative'
      }}>
        <div 
          className="board-scale-wrapper" 
          ref={boardScaleRef}
          style={{ 
            transform: `scale(${scale})`,
            transformOrigin: '0 0',
            width: '3000px',
            height: '2000px',
            position: 'absolute',
            top: 0,
            left: 0
          }}
        >
        <div 
          className="board" 
          id="widget-board"
          onClick={onBoardClick}
          style={{ 
            cursor: stickerMode ? 'crosshair' : 'default',
            position: 'relative',
            width: '3000px',
            height: '2000px'
          }}
        >
          {/* Background Pattern */}
          <Background type={background} />

          {children}
          
          
        </div>
      </div>
      </div>
    </div>
  );
};

export default memo(Board);