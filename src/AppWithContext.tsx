import "./App.css";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import Confetti from "react-confetti";

// Types
import { BackgroundType } from "./types/app.types";

// Components
import Toolbar from "./components/toolbar/toolbar";
// import { ViewportCanvas } from "./components/ViewportCanvas"; // Removed - using Board in new architecture
import Background from "./components/backgrounds/backgrounds";
import ResponsiveCheck from "./components/ResponsiveCheck/ResponsiveCheck";
import NetworkStatus from "./components/NetworkStatus/NetworkStatus";

// Contexts
import { ModalProvider } from "./contexts/ModalContext";
import { WorkspaceProvider, useWorkspace } from "./store/WorkspaceContext";
import { SessionProvider, useSessionContext } from "./contexts/SessionContext";

// Hooks
import { useDarkMode } from "./hooks/useDarkMode";
import { useFullscreen } from "./hooks/useFullscreen";
import { useWorkspaceSync } from "./hooks/useWorkspaceSync";

// Utils and Constants
import { WIDGET_TYPES } from "./constants/widgetTypes";
import { getWidgetConfig } from "./constants/widgetConfigs";
import { isOverTrash } from "./utils/widgetHelpers";
import { APP_VERSION } from "./version";

// Audio import for trash sound
import trashSound from "./sounds/trash-crumple.mp3";
const trashAudio = new Audio(trashSound);

function AppContentInner() {
  const session = useSessionContext();
  const { 
    state, 
    addWidget, 
    removeWidget, 
    updateWidgetPosition, 
    updateWidgetState,
    setActiveWidget,
    setBackground,
    setStickerMode,
    resetWorkspace,
    setScale,
    setViewport
  } = useWorkspace();

  // UI State
  const [useConfetti, setUseConfetti] = useState(false);
  const [darkMode, setDarkMode] = useDarkMode();
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const [hoveringTrashId, setHoveringTrashId] = useState<string | null>(null);
  
  // Sync with localStorage
  const { isInitialized } = useWorkspaceSync();

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Exit sticker mode with 'S' key
      if (e.key.toLowerCase() === 's' && state.stickerMode) {
        setStickerMode(false);
        return;
      }
      
      // Open widget launcher with Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        // Trigger the LaunchpadDialog by clicking the More button
        const moreButton = document.querySelector('[title="More widgets"]') as HTMLButtonElement;
        if (moreButton) {
          moreButton.click();
        }
        return;
      }
      
      // Toggle fullscreen with F11 or Cmd/Ctrl + Shift + F
      if (e.key === 'F11' || ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f')) {
        e.preventDefault();
        toggleFullscreen();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state.stickerMode, setStickerMode, toggleFullscreen]);

  // Prevent swipe navigation
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const handlePopState = (e: PopStateEvent) => {
      window.history.pushState(null, '', window.location.href);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle ESC key to exit sticker mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.stickerMode) {
        setStickerMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.stickerMode, setStickerMode]);

  // Handle trash deletion
  const trashHandler = (mouseEvent: any, data: any, id: string) => {
    if (isOverTrash(mouseEvent.clientX || mouseEvent.x, mouseEvent.clientY || mouseEvent.y)) {
      trashAudio.play().catch(error => {
        console.error("Error playing trash sound:", error);
      });
      removeWidget(id);
      setHoveringTrashId(null);
    }
  };

  // Handle sticker placement
  const handleBoardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!state.stickerMode) return;
    
    const target = e.target as HTMLElement;
    if (target.matches('input, textarea, button, select') || 
        target.closest('input, textarea, button, select')) {
      return;
    }
    
    const boardElement = document.getElementById('widget-board');
    if (!boardElement) return;
    
    const scrollContainer = document.querySelector('.board-scroll-container') as HTMLElement;
    if (!scrollContainer) return;
    
    const scaleWrapper = document.querySelector('.board-scale-wrapper') as HTMLElement;
    if (!scaleWrapper) return;
    
    // Get the bounding rect of the scale wrapper (which is scaled)
    const rect = scaleWrapper.getBoundingClientRect();
    
    // Account for scale when calculating position
    const scale = state.scale;
    
    // Calculate the position relative to the scaled board
    // The click position needs to account for the scroll position and scale
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    
    // Calculate sticker position and size
    const stickerConfig = getWidgetConfig(WIDGET_TYPES.STAMP, state.selectedStickerType);
    const sizeVariation = 0.9 + Math.random() * 0.2;
    const randomWidth = Math.round(stickerConfig.defaultWidth * sizeVariation);
    const randomHeight = Math.round(stickerConfig.defaultHeight * sizeVariation);
    
    // Add sticker at clicked position (centered on click point)
    addWidget(WIDGET_TYPES.STAMP, state.selectedStickerType, {
      x: x - randomWidth / 2,
      y: y - randomHeight / 2,
      width: randomWidth,
      height: randomHeight
    });
  };

  // Add widget handler for toolbar
  const handleAddWidget = (widgetType: number) => {
    addWidget(widgetType);
  };
  
  // Memoized callbacks to prevent re-renders
  const handleWidgetPositionChange = useCallback((id: string, pos: { x: number; y: number }) => {
    const position = state.widgetPositions.get(id);
    if (position) {
      updateWidgetPosition(id, {
        ...pos,
        width: position.width,
        height: position.height
      });
    }
  }, [state.widgetPositions, updateWidgetPosition]);
  
  const handleWidgetSizeChange = useCallback((id: string, size: { width: number; height: number }) => {
    const position = state.widgetPositions.get(id);
    if (position) {
      updateWidgetPosition(id, {
        x: position.x,
        y: position.y,
        ...size
      });
    }
  }, [state.widgetPositions, updateWidgetPosition]);
  
  const handleCanvasClick = useCallback((x: number, y: number) => {
    if (state.stickerMode) {
      addWidget(WIDGET_TYPES.STAMP, state.selectedStickerType, {
        x: x - 60, // Center the sticker
        y: y - 60,
        width: 120,
        height: 120
      });
    }
  }, [state.stickerMode, state.selectedStickerType, addWidget]);

  return (
    <div className={`App ${darkMode ? 'dark' : ''}`}>
      <ResponsiveCheck />
      <ModalProvider>
        <div className="h-screen relative overflow-hidden bg-app-background" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          
          {/* Top right controls */}
          <div className="absolute top-4 right-4 z-[999] flex items-center gap-2">
            {/* Network status with session info */}
            <NetworkStatus />
            
            {/* Fullscreen button */}
            <button
              onClick={toggleFullscreen}
              className="p-3 bg-warm-gray-200/60 dark:bg-warm-gray-700/60 hover:bg-warm-gray-300/60 dark:hover:bg-warm-gray-600/60 text-warm-gray-700 dark:text-warm-gray-300 rounded-lg transition-all duration-200 backdrop-blur-sm"
              title={isFullscreen ? "Exit fullscreen (F11)" : "Enter fullscreen (F11)"}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                {isFullscreen ? (
                  // Exit fullscreen icon
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
                  />
                ) : (
                  // Enter fullscreen icon
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  />
                )}
              </svg>
            </button>
          </div>

          {/* Main content area - Canvas */}
          {/* ViewportCanvas removed - Old architecture component */}
          <div className="flex-1 bg-warm-gray-100 dark:bg-warm-gray-900 flex items-center justify-center">
            <p className="text-warm-gray-500">Old Context System - Use feature flag to switch to new architecture</p>
          </div>
          {/* Original ViewportCanvas usage - Commented out because ViewportCanvas was removed:
          <ViewportCanvas
            scale={state.scale}
            onScaleChange={setScale}
            widgets={useMemo(() => 
              state.widgets.map(widget => {
                const position = state.widgetPositions.get(widget.id);
                if (!position) return null;
                
                return {
                  id: widget.id,
                  type: widget.index,
                  position: { x: position.x, y: position.y },
                  size: { width: position.width, height: position.height }
                };
              }).filter(Boolean) as any[]
            , [state.widgets, state.widgetPositions])}
            activeWidgetId={state.activeWidgetId}
            widgetStates={state.widgetStates}
            stickerMode={state.stickerMode}
            onCanvasClick={handleCanvasClick}
            onToggleConfetti={setUseConfetti}
            onWidgetStateChange={updateWidgetState}
            onWidgetRemove={removeWidget}
            onWidgetClick={setActiveWidget}
            onWidgetPositionChange={handleWidgetPositionChange}
            onWidgetSizeChange={handleWidgetSizeChange}
            onViewportChange={setViewport}
            background={<Background type={state.backgroundType} />}
          />
          */}
          
          {/* HUD Elements - Fixed overlay */}
          {/* Sticker mode indicator */}
          {state.stickerMode && (
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[999] bg-soft-white dark:bg-warm-gray-800 px-4 py-2 rounded-lg shadow-lg flex items-center space-x-3">
              <span className="text-warm-gray-700 dark:text-warm-gray-200">
                Sticker mode: Click to stamp {state.selectedStickerType}
              </span>
              <button
                onClick={() => setStickerMode(false)}
                className="px-3 py-1 bg-warm-gray-300 hover:bg-warm-gray-400 dark:bg-warm-gray-600 dark:hover:bg-warm-gray-500 text-warm-gray-700 dark:text-warm-gray-200 rounded-md transition-colors duration-200"
              >
                Exit (S)
              </button>
            </div>
          )}
          
          {/* Fixed toolbar */}
          <div className="toolbar-container">
            <Toolbar
              darkMode={darkMode}
              setDarkMode={setDarkMode}
              hoveringTrash={hoveringTrashId}
            />
          </div>
          
          {/* Zoom controls */}
          <div className="fixed top-24 right-4 z-[999] flex flex-col items-center gap-1 bg-warm-gray-200/60 dark:bg-warm-gray-700/60 px-1 py-2 rounded-md backdrop-blur-sm">
            <button
              onClick={() => setScale(Math.min(2, state.scale + 0.1))}
              className="p-1 hover:bg-warm-gray-300/60 dark:hover:bg-warm-gray-600/60 text-warm-gray-600 dark:text-warm-gray-400 rounded transition-colors duration-200"
              title="Zoom in"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={() => setScale(1)}
              className="px-1.5 py-0.5 text-xs font-medium text-warm-gray-600 dark:text-warm-gray-400 hover:bg-warm-gray-300/60 dark:hover:bg-warm-gray-600/60 rounded transition-colors duration-200 min-w-[2.5rem]"
              title="Reset zoom to 100%"
            >
              {Math.round(state.scale * 100)}%
            </button>
            <button
              onClick={() => setScale(Math.max(0.5, state.scale - 0.1))}
              className="p-1 hover:bg-warm-gray-300/60 dark:hover:bg-warm-gray-600/60 text-warm-gray-600 dark:text-warm-gray-400 rounded transition-colors duration-200"
              title="Zoom out"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
          </div>
          
          {/* Confetti */}
          {useConfetti && (
            <Confetti
              width={window.innerWidth}
              height={window.innerHeight}
              numberOfPieces={200}
              recycle={false}
              gravity={0.2}
              onConfettiComplete={() => setUseConfetti(false)}
            />
          )}
          
          {/* Version label */}
          <div className="fixed bottom-2 left-2 text-xs text-warm-gray-400 dark:text-warm-gray-600 opacity-50 pointer-events-none select-none">
            v{APP_VERSION}
          </div>
        </div>
      </ModalProvider>
    </div>
  );
}

function AppContent() {
  return (
    <SessionProvider>
      <AppContentInner />
    </SessionProvider>
  );
}

function AppWithContext() {
  return (
    <WorkspaceProvider>
      <AppContent />
    </WorkspaceProvider>
  );
}

export default AppWithContext;