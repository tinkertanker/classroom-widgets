import React, { useState, useCallback } from 'react';
import { FaWifi, FaExpand, FaCompress, FaPlus, FaMinus } from 'react-icons/fa6';
import { clsx } from 'clsx';
import { useWorkspace, useServerConnection, useBottomBar } from '@shared/hooks/useWorkspace';
import { useSession } from '../../../contexts/SessionContext';
import SessionBanner from '../../session/components/SessionBanner';
import { WorkspaceSwitcher } from '../../workspace';
import { useHudProximityContext } from '@shared/hooks/useHudProximity';
import { hudContainer, hudProximity, zIndex } from '@shared/utils/styles';
import { HudButton, HudButtonGroup, HudGroupButton } from '../../../components/ui';
import Clock from './Clock';

const TopControls: React.FC = () => {
  const { scale, setScale } = useWorkspace();
  const { connected } = useServerConnection();
  const { sessionCode } = useSession();
  const { showClock } = useBottomBar();

  // Debug: log session code
  console.log('[TopControls] sessionCode:', sessionCode);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { isNear, registerHudElement } = useHudProximityContext();

  // Refs for registering HUD regions
  const topLeftRef = useCallback((node: HTMLDivElement | null) => {
    registerHudElement('topLeft', node);
  }, [registerHudElement]);

  const topRightRef = useCallback((node: HTMLDivElement | null) => {
    registerHudElement('topRight', node);
  }, [registerHudElement]);

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
    <div className={clsx(
      'fixed top-4 left-4 right-4 flex items-start justify-between pointer-events-none',
      zIndex.hud
    )}>
      {/* Left side - Workspace Switcher + Clock */}
      <div
        ref={topLeftRef}
        className={clsx(
          'flex items-center space-x-2',
          hudProximity.wrapper(isNear.topLeft)
        )}
      >
        <WorkspaceSwitcher />

        {/* Clock - styled as minimal HUD element */}
        {showClock && (
          <div className={clsx(
            hudContainer.base,
            'h-10 px-3 flex items-center'
          )}>
            <Clock />
          </div>
        )}
      </div>

      {/* Right side - Session, Zoom, Fullscreen */}
      <div
        ref={topRightRef}
        className={clsx(
          'flex items-start space-x-2',
          hudProximity.wrapper(isNear.topRight)
        )}
      >
        {/* Dynamic Island-style Session Status */}
        {sessionCode ? (
          <SessionBanner />
        ) : (
          /* Regular WiFi button when no session */
          <button
            className={clsx(hudContainer.button, 'px-3')}
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
        <HudButtonGroup>
          <HudGroupButton
            onClick={handleZoomOut}
            icon={FaMinus}
            title="Zoom out"
          />

          <button
            onClick={handleZoomReset}
            className="px-2 py-1 text-xs font-mono text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-200 dark:hover:bg-warm-gray-700 rounded transition-colors"
            title="Reset zoom"
          >
            {Math.round(scale * 100)}%
          </button>

          <HudGroupButton
            onClick={handleZoomIn}
            icon={FaPlus}
            title="Zoom in"
          />
        </HudButtonGroup>

        {/* Fullscreen Button */}
        <HudButton
          onClick={handleFullscreen}
          icon={isFullscreen ? FaCompress : FaExpand}
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        />
      </div>
    </div>
  );
};

export default TopControls;
