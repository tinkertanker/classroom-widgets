import React, { useRef, useState, forwardRef, useImperativeHandle, useEffect, memo } from 'react';
import { useWorkspace } from '../../../shared/hooks/useWorkspace';
import { useZoomWithScroll } from '../hooks/useZoomWithScroll';
import Background from './Background';
import { BackgroundType } from '../../../shared/types';

interface BoardProps {
  children: React.ReactNode;
  onBoardClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  stickerMode: boolean;
}

export interface BoardRef {
  containerRef: React.RefObject<HTMLDivElement>;
  setDebugMarker: (marker: { x: number; y: number; visible: boolean; viewportX?: number; viewportY?: number }) => void;
  setViewportRect: (rect: { x: number; y: number; visible: boolean }) => void;
  setIsAnimatingZoom: (isAnimating: boolean) => void;
  setTransformOrigin: (origin: string) => void;
}

const Board = forwardRef<BoardRef, BoardProps>(({ children, onBoardClick, stickerMode }, ref) => {
  const { scale, background } = useWorkspace();
  
  
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const boardScaleRef = useRef<HTMLDivElement>(null);
  const [transformOrigin, setTransformOrigin] = useState('0 0');
  const previousScaleRef = useRef(scale);
  const [debugMarker, setDebugMarker] = useState<{ x: number; y: number; visible: boolean; viewportX?: number; viewportY?: number }>({
    x: 0,
    y: 0,
    visible: false
  });
  const [subpixelOffset, setSubpixelOffset] = useState({ x: 0, y: 0 });
  const [viewportRect, setViewportRect] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false
  });
  const [isAnimatingZoom, setIsAnimatingZoom] = useState(false);
  
  // Reset animation flag when scale changes from external source (like pinch zoom)
  useEffect(() => {
    if (isAnimatingZoom) {
      const timer = setTimeout(() => {
        setIsAnimatingZoom(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [scale, isAnimatingZoom]);
  
  // Expose the container ref and debug marker setter to parent components
  useImperativeHandle(ref, () => ({
    containerRef: boardContainerRef,
    setDebugMarker,
    setViewportRect,
    setIsAnimatingZoom,
    setTransformOrigin
  }), [setDebugMarker, setViewportRect, setIsAnimatingZoom, setTransformOrigin]);
  
  // Enable pinch zoom on the board container
  useZoomWithScroll(boardContainerRef, boardScaleRef, setDebugMarker, setViewportRect, {
    minScale: 0.5,
    maxScale: 2,
    scaleSensitivity: 1  // Increased from 0.01 for more responsive pinch
  });

  return (
    <div className="board-scroll-container" ref={boardContainerRef}>
      
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
            transformOrigin: transformOrigin,
            width: '3000px',
            height: '2000px',
            position: 'absolute',
            top: 0,
            left: 0,
            transition: isAnimatingZoom ? 'transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none'
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
          {background !== BackgroundType.NONE && <Background type={background as any} />}
          
          {children}
          
          
        </div>
      </div>
      </div>
    </div>
  );
});

export default memo(Board);