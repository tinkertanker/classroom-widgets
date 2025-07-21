import React from 'react';
import { useWorkspace } from '../../store/WorkspaceContext';

interface ZoomControlProps {
  className?: string;
  boardRef?: React.RefObject<any>;
}

const ZoomControl: React.FC<ZoomControlProps> = ({ className = '', boardRef }) => {
  const { state, setScale } = useWorkspace();
  const { scale } = state;

  const zoomLevels = [0.5, 0.75, 1, 1.25, 1.5, 2];
  
  const setZoomFromCenter = (newScale: number) => {
    // If we have a board ref, adjust scroll to keep center point fixed
    if (boardRef?.current) {
      const container = boardRef.current.containerRef.current;
      if (container) {
        const oldScale = scale;
        
        // Get viewport center
        const centerX = container.clientWidth / 2;
        const centerY = container.clientHeight / 2;
        
        // Get current scroll position
        const scrollLeft = container.scrollLeft;
        const scrollTop = container.scrollTop;
        
        // Calculate the board point at viewport center
        const boardX = (scrollLeft + centerX) / oldScale;
        const boardY = (scrollTop + centerY) / oldScale;
        
        // Calculate new scroll position to keep center point fixed
        const newScrollX = boardX * newScale - centerX;
        const newScrollY = boardY * newScale - centerY;
        
        // Enable smooth transition for the board
        if (boardRef.current.setIsAnimatingZoom) {
          boardRef.current.setIsAnimatingZoom(true);
        }
        
        // Enable smooth scrolling
        container.style.scrollBehavior = 'smooth';
        
        // Apply the new scale
        setScale(newScale);
        
        // Apply scroll with smooth behavior
        requestAnimationFrame(() => {
          container.scrollTo({
            left: newScrollX,
            top: newScrollY
          });
          
          // Reset to auto after animation
          setTimeout(() => {
            container.style.scrollBehavior = 'auto';
          }, 300);
        });
      }
    } else {
      setScale(newScale);
    }
  };
  
  const handleZoomIn = () => {
    const currentIndex = zoomLevels.findIndex(level => level >= scale);
    if (currentIndex < zoomLevels.length - 1) {
      setZoomFromCenter(zoomLevels[currentIndex + 1]);
    }
  };

  const handleZoomOut = () => {
    const currentIndex = zoomLevels.findIndex(level => level >= scale);
    if (currentIndex > 0) {
      setZoomFromCenter(zoomLevels[currentIndex - 1]);
    }
  };

  const handleZoomReset = () => {
    setZoomFromCenter(1);
  };

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setZoomFromCenter(parseFloat(e.target.value));
  };

  return (
    <div className={`flex flex-col items-center space-y-1 bg-warm-gray-200/80 dark:bg-warm-gray-700/80 rounded-md py-1 shadow-sm backdrop-blur-sm ${className}`}>
      <button
        onClick={handleZoomIn}
        className="p-1.5 text-warm-gray-600 dark:text-warm-gray-300 hover:bg-warm-gray-200 dark:hover:bg-warm-gray-700 rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Zoom in"
        disabled={scale >= 2}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
        </svg>
      </button>
      
      <button
        onClick={handleZoomReset}
        className="text-xs text-warm-gray-600 dark:text-warm-gray-300 hover:text-warm-gray-800 dark:hover:text-warm-gray-100 transition-colors duration-200 px-1 py-0.5"
        title="Reset zoom"
      >
        {Math.round(scale * 100)}%
      </button>
      
      <button
        onClick={handleZoomOut}
        className="p-1.5 text-warm-gray-600 dark:text-warm-gray-300 hover:bg-warm-gray-200 dark:hover:bg-warm-gray-700 rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Zoom out"
        disabled={scale <= 0.5}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
        </svg>
      </button>
    </div>
  );
};

export default ZoomControl;