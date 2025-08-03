import React, { useState, useRef, useEffect } from 'react';
import { FaWifi, FaExpand, FaCompress, FaPlus, FaMinus, FaCircleInfo } from 'react-icons/fa6';
import { clsx } from 'clsx';
import { useWorkspace, useServerConnection } from '../../../shared/hooks/useWorkspace';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';
import { useSession } from '../../../contexts/SessionContext';
import SessionBanner from '../../session/components/SessionBanner';

const TopControls: React.FC = () => {
  const { scale, setScale } = useWorkspace();
  const { connected } = useServerConnection();
  const { sessionCode } = useSession();
  const [isFullscreen, setIsFullscreen] = useState(false);
  

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleZoom = (newScale: number) => {
    const container = document.querySelector('.board-scroll-container') as HTMLElement;
    if (!container) {
      setScale(newScale);
      return;
    }

    // Get viewport center
    const viewportCenterX = container.clientWidth / 2;
    const viewportCenterY = container.clientHeight / 2;
    
    // Calculate board coordinates at viewport center before zoom
    const scrollXBefore = container.scrollLeft;
    const scrollYBefore = container.scrollTop;
    const boardX = (scrollXBefore + viewportCenterX) / scale;
    const boardY = (scrollYBefore + viewportCenterY) / scale;
    
    // Apply new scale
    setScale(newScale);
    
    // Calculate new scroll position to keep the same board point at viewport center
    requestAnimationFrame(() => {
      const newScrollX = (boardX * newScale) - viewportCenterX;
      const newScrollY = (boardY * newScale) - viewportCenterY;
      container.scrollLeft = newScrollX;
      container.scrollTop = newScrollY;
    });
  };

  const handleZoomIn = () => {
    handleZoom(Math.min(scale + 0.1, 2));
  };

  const handleZoomOut = () => {
    handleZoom(Math.max(scale - 0.1, 0.5));
  };

  const handleZoomReset = () => {
    handleZoom(1);
  };

  // Listen for fullscreen changes
  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  

  return (
    <div className="fixed top-4 right-4 flex items-start space-x-2 z-[998]">
      {/* Dynamic Island-style Session Status */}
      {sessionCode ? (
        <SessionBanner />
      ) : (
        /* Regular WiFi button when no session */
        <button
          className={clsx(
            "flex items-center justify-center h-10 px-3 bg-soft-white/80 dark:bg-warm-gray-800/80 rounded-lg shadow-sm backdrop-blur-sm",
            "hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 transition-colors"
          )}
          title={connected ? 'Connected to server' : 'Disconnected from server'}
        >
          <div className={clsx(
            'transition-colors duration-200',
            connected ? 'text-sage-600' : 'text-warm-gray-400'
          )}>
            <FaWifi className="text-lg" />
          </div>
        </button>
      )}

      {/* Zoom Controls */}
      <div className="flex items-center space-x-1 px-2 py-1 bg-soft-white/80 dark:bg-warm-gray-800/80 rounded-lg shadow-sm backdrop-blur-sm h-10">
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded hover:bg-warm-gray-200 dark:hover:bg-warm-gray-700 transition-colors"
          title="Zoom out"
        >
          <FaMinus className="w-3 h-3 text-warm-gray-600 dark:text-warm-gray-300" />
        </button>
        
        <button
          onClick={handleZoomReset}
          className="px-2 py-1 text-xs font-mono text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-200 dark:hover:bg-warm-gray-700 rounded transition-colors"
          title="Reset zoom"
        >
          {Math.round(scale * 100)}%
        </button>
        
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded hover:bg-warm-gray-200 dark:hover:bg-warm-gray-700 transition-colors"
          title="Zoom in"
        >
          <FaPlus className="w-3 h-3 text-warm-gray-600 dark:text-warm-gray-300" />
        </button>
      </div>

      {/* Fullscreen Button */}
      <button
        onClick={handleFullscreen}
        className="flex items-center justify-center h-10 w-10 bg-soft-white/80 dark:bg-warm-gray-800/80 rounded-lg shadow-sm backdrop-blur-sm hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 transition-colors"
        title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      >
        {isFullscreen ? (
          <FaCompress className="w-4 h-4 text-warm-gray-600 dark:text-warm-gray-300" />
        ) : (
          <FaExpand className="w-4 h-4 text-warm-gray-600 dark:text-warm-gray-300" />
        )}
      </button>

      {/* About Link */}
      <a
        href="/about"
        className="flex items-center justify-center h-10 w-10 bg-soft-white/80 dark:bg-warm-gray-800/80 rounded-lg shadow-sm backdrop-blur-sm hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 transition-colors"
        title="Learn more about Classroom Widgets"
      >
        <FaCircleInfo className="w-4 h-4 text-warm-gray-600 dark:text-warm-gray-300" />
      </a>
    </div>
  );
};

export default TopControls;