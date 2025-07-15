import "./App.css";
import { useEffect, useState } from "react";
import Confetti from "react-confetti";

// Types
import { BackgroundType } from "./types/app.types";

// Components
import Toolbar from "./components/toolbar/toolbar";
import Board from "./components/Board/Board";
import WidgetContainer from "./components/Widget/WidgetContainer";
import Background from "./components/backgrounds/backgrounds";

// Contexts
import { ModalProvider } from "./contexts/ModalContext";
import { WorkspaceProvider, useWorkspace } from "./store/WorkspaceContext";

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

function AppContent() {
  const { 
    state, 
    addWidget, 
    removeWidget, 
    updateWidgetPosition, 
    updateWidgetState,
    setActiveWidget,
    setBackground,
    setStickerMode,
    resetWorkspace
  } = useWorkspace();

  // UI State
  const [useConfetti, setUseConfetti] = useState(false);
  const [darkMode, setDarkMode] = useDarkMode();
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const [hoveringTrashId, setHoveringTrashId] = useState<string | null>(null);
  
  // Sync with localStorage
  const { isInitialized } = useWorkspaceSync();

  // Handle 'S' key to exit sticker mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.key.toLowerCase() === 's' && state.stickerMode) {
        setStickerMode(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state.stickerMode, setStickerMode]);

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
  const trashHandler = (mouseEvent: any, _: any, id: string) => {
    if (isOverTrash(mouseEvent.x, mouseEvent.y)) {
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
    const rect = boardElement.getBoundingClientRect();
    const scrollContainer = document.querySelector('.board-scroll-container');
    if (!scrollContainer) return;
    
    const x = e.clientX - rect.left + scrollContainer.scrollLeft;
    const y = e.clientY - rect.top + scrollContainer.scrollTop;
    
    // Calculate sticker position and size
    const stickerConfig = getWidgetConfig(WIDGET_TYPES.STAMP, state.selectedStickerType);
    const sizeVariation = 0.9 + Math.random() * 0.2;
    const randomWidth = Math.round(stickerConfig.defaultWidth * sizeVariation);
    const randomHeight = Math.round(stickerConfig.defaultHeight * sizeVariation);
    
    // Add sticker at clicked position
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

  return (
    <div className={`App ${darkMode ? 'dark' : ''}`}>
      <ModalProvider>
        <div className="h-screen relative overflow-hidden bg-app-background" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          {/* Fullscreen button */}
          <button
            onClick={toggleFullscreen}
            className="absolute top-4 right-4 z-[999] p-2 bg-warm-gray-200 hover:bg-warm-gray-300 dark:bg-warm-gray-700 dark:hover:bg-warm-gray-600 text-warm-gray-700 dark:text-warm-gray-300 rounded-md transition-colors duration-200"
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
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

          {/* Background */}
          <Background type={state.backgroundType} />
          
          {/* Main content area */}
          <Board onBoardClick={handleBoardClick} stickerMode={state.stickerMode}>
            {state.widgets.map((widget) => {
              const position = state.widgetPositions.get(widget.id);
              const savedState = state.widgetStates.get(widget.id);
              const widgetConfig = widget.index === WIDGET_TYPES.STAMP && savedState?.stickerType 
                ? getWidgetConfig(widget.index, savedState.stickerType || savedState.stampType)
                : getWidgetConfig(widget.index);
              
              if (!position) return null;
              
              return (
                <WidgetContainer
                  key={widget.id}
                  widget={widget}
                  position={position}
                  config={widgetConfig}
                  isActive={state.activeWidgetId === widget.id}
                  isHoveringTrash={hoveringTrashId === widget.id}
                  savedState={savedState}
                  onDragStart={(e: any, data: any) => setActiveWidget(widget.id)}
                  onDrag={(e: any, data: any) => {
                    if (isOverTrash(e.clientX, e.clientY)) {
                      setHoveringTrashId(widget.id);
                    } else {
                      setHoveringTrashId(null);
                    }
                  }}
                  onDragStop={(e: any, data: any) => {
                    trashHandler(e, data, widget.id);
                    if (hoveringTrashId === widget.id) {
                      setHoveringTrashId(null);
                    }
                    updateWidgetPosition(widget.id, {
                      x: data.x,
                      y: data.y,
                      width: position.width,
                      height: position.height
                    });
                  }}
                  onResizeStart={() => setActiveWidget(widget.id)}
                  onResizeStop={(_: any, __: any, ref: any, ___: any, position: any) => {
                    updateWidgetPosition(widget.id, {
                      x: position.x,
                      y: position.y,
                      width: parseInt(ref.style.width),
                      height: parseInt(ref.style.height)
                    });
                  }}
                  onTouchStart={() => setActiveWidget(widget.id)}
                  onStateChange={(state: any) => updateWidgetState(widget.id, state)}
                  toggleConfetti={setUseConfetti}
                  onClick={() => setActiveWidget(widget.id)}
                  onDelete={() => removeWidget(widget.id)}
                />
              );
            })}
          </Board>
          
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

function AppWithContext() {
  return (
    <WorkspaceProvider>
      <AppContent />
    </WorkspaceProvider>
  );
}

export default AppWithContext;