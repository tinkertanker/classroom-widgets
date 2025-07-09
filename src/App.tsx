import "./App.css";
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import Confetti from "react-confetti";

// Components
import Toolbar from "./components/toolbar/toolbar";
import Board from "./components/Board/Board";
import WidgetContainer from "./components/Widget/WidgetContainer";
import Background, { BackgroundType } from "./components/backgrounds/backgrounds";

// Contexts
import { ModalProvider } from "./contexts/ModalContext";

// Hooks
import { useDarkMode } from "./hooks/useDarkMode";
import { useFullscreen } from "./hooks/useFullscreen";
import { useWorkspacePersistence } from "./hooks/useWorkspacePersistence";

// Utils and Constants
import { WIDGET_TYPES } from "./constants/widgetTypes";
import { getWidgetConfig } from "./constants/widgetConfigs";
import { findAvailablePosition, isOverTrash } from "./utils/widgetHelpers";

// Audio import for trash sound
import trashSound from "./sounds/trash-crumple.mp3";
const trashAudio = new Audio(trashSound);

function App() {
  // UI State
  const [useConfetti, setUseConfetti] = useState(false);
  const [darkMode, setDarkMode] = useDarkMode();
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const [backgroundType, setBackgroundType] = useState<BackgroundType>('geometric');
  
  // Widget State
  const [componentList, setComponentList] = useState([]);
  const [activeIndex, setActiveIndex] = useState(null);
  const [widgetPositions, setWidgetPositions] = useState(new Map());
  const [widgetStates, setWidgetStates] = useState(new Map());
  const [hoveringTrashId, setHoveringTrashId] = useState(null);
  
  // Sticker Mode
  const [stickerMode, setStickerMode] = useState(false);
  const [selectedStickerType, setSelectedStickerType] = useState('heart');
  
  // Persistence
  const { saveWorkspaceState, loadWorkspaceState, isInitialized, setIsInitialized } = useWorkspacePersistence();

  // Update individual widget state
  const updateWidgetState = (widgetId, state) => {
    setWidgetStates(prev => {
      const newMap = new Map(prev);
      newMap.set(widgetId, state);
      return newMap;
    });
  };

  // Load state on mount
  useEffect(() => {
    const savedState = loadWorkspaceState();
    if (savedState) {
      setComponentList(savedState.componentList);
      setWidgetPositions(savedState.widgetPositions);
      setWidgetStates(savedState.widgetStates);
      setActiveIndex(savedState.activeIndex);
      setBackgroundType(savedState.backgroundType);
    }
    setIsInitialized(true);
  }, []);

  // Save state when it changes
  useEffect(() => {
    if (isInitialized) {
      const timeoutId = setTimeout(() => {
        saveWorkspaceState({
          componentList,
          widgetPositions,
          widgetStates,
          activeIndex,
          backgroundType
        });
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [componentList, widgetPositions, widgetStates, activeIndex, backgroundType, isInitialized]);

  // Prevent swipe navigation
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const handlePopState = (e) => {
      window.history.pushState(null, '', window.location.href);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle ESC key to exit sticker mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && stickerMode) {
        setStickerMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stickerMode]);

  // Handle trash deletion
  const trashHandler = (mouseEvent, _, id) => {
    if (isOverTrash(mouseEvent.x, mouseEvent.y)) {
      trashAudio.play().catch(error => {
        console.error("Error playing trash sound:", error);
      });
      
      setComponentList((oldList) =>
        oldList.filter((component) => component.id !== id)
      );
      setHoveringTrashId(null);
      
      // Remove position and state from maps
      setWidgetPositions(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
      
      setWidgetStates(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
    }
  };

  // Handle sticker placement
  const handleBoardClick = (e) => {
    if (!stickerMode) return;
    
    // Don't place stickers when clicking on inputs, textareas, or buttons
    const target = e.target;
    if (target.matches('input, textarea, button, select') || 
        target.closest('input, textarea, button, select')) {
      return;
    }
    
    const boardElement = document.getElementById('widget-board');
    const rect = boardElement.getBoundingClientRect();
    const scrollContainer = document.querySelector('.board-scroll-container');
    
    const x = e.clientX - rect.left + scrollContainer.scrollLeft;
    const y = e.clientY - rect.top + scrollContainer.scrollTop;
    
    const newId = uuidv4();
    const stickerConfig = getWidgetConfig(WIDGET_TYPES.STAMP, selectedStickerType);
    
    setComponentList(prev => [...prev, { id: newId, index: WIDGET_TYPES.STAMP }]);
    
    // Generate random variations
    const getRandomRotation = () => {
      const steps = [];
      for (let i = -40; i <= 40; i += 5) {
        steps.push(i);
      }
      return steps[Math.floor(Math.random() * steps.length)];
    };
    
    const getRandomColorIndex = () => Math.floor(Math.random() * 6);
    const sizeVariation = 0.9 + Math.random() * 0.2;
    const randomWidth = Math.round(stickerConfig.defaultWidth * sizeVariation);
    const randomHeight = Math.round(stickerConfig.defaultHeight * sizeVariation);
    
    setWidgetPositions(prev => new Map(prev).set(newId, {
      x: x - randomWidth / 2,
      y: y - randomHeight / 2,
      width: randomWidth,
      height: randomHeight
    }));
    
    setWidgetStates(prev => new Map(prev).set(newId, { 
      stickerType: selectedStickerType,
      colorIndex: getRandomColorIndex(),
      rotation: getRandomRotation()
    }));
    
    setActiveIndex(newId);
  };

  return (
    <ModalProvider>
      <meta charSet="UTF-8" />
      <div className="App dark:bg-warm-gray-900">
        {/* Fixed UI elements */}
        <div className="fixed-ui">
          {/* Fullscreen button */}
          <button
            onClick={toggleFullscreen}
            className="fixed top-4 right-4 z-[999] p-2 bg-warm-gray-200 hover:bg-warm-gray-300 dark:bg-warm-gray-800 dark:hover:bg-warm-gray-700 text-warm-gray-700 dark:text-warm-gray-200 rounded-md transition-colors duration-200"
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isFullscreen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              )}
            </svg>
          </button>
          
          {/* Fixed toolbar */}
          <div className="toolbar-container">
            <Toolbar 
              setComponentList={setComponentList} 
              activeIndex={activeIndex} 
              setActiveIndex={setActiveIndex} 
              hoveringTrash={hoveringTrashId !== null}
              backgroundType={backgroundType}
              setBackgroundType={setBackgroundType}
              darkMode={darkMode}
              setDarkMode={setDarkMode}
              stickerMode={stickerMode}
              setStickerMode={setStickerMode}
              selectedStickerType={selectedStickerType}
              setSelectedStickerType={setSelectedStickerType}
            />
          </div>
        </div>
        
        {/* Board with widgets */}
        <Board onBoardClick={handleBoardClick} stickerMode={stickerMode}>
          <Background type={backgroundType} />
          {componentList.map((widget) => {
            const savedState = widgetStates.get(widget.id);
            const widgetConfig = widget.index === WIDGET_TYPES.STAMP 
              ? getWidgetConfig(widget.index, savedState?.stickerType || savedState?.stampType)
              : getWidgetConfig(widget.index);
            
            let position = widgetPositions.get(widget.id);
            if (!position) {
              position = findAvailablePosition(widgetConfig.defaultWidth, widgetConfig.defaultHeight, widgetPositions);
              setWidgetPositions(prev => new Map(prev).set(widget.id, { 
                x: position.x, 
                y: position.y, 
                width: widgetConfig.defaultWidth, 
                height: widgetConfig.defaultHeight 
              }));
            }
            
            return (
              <WidgetContainer
                key={widget.id}
                widget={widget}
                position={position}
                config={widgetConfig}
                isActive={activeIndex === widget.id}
                isHoveringTrash={hoveringTrashId === widget.id}
                savedState={savedState}
                onDragStart={() => setActiveIndex(widget.id)}
                onDrag={(e) => {
                  if (isOverTrash(e.clientX, e.clientY)) {
                    setHoveringTrashId(widget.id);
                  } else {
                    setHoveringTrashId(null);
                  }
                }}
                onDragStop={(e, data) => {
                  trashHandler(e, data, widget.id);
                  if (hoveringTrashId === widget.id) {
                    setHoveringTrashId(null);
                  }
                  setWidgetPositions(prev => {
                    const newMap = new Map(prev);
                    const existing = newMap.get(widget.id);
                    if (existing) {
                      newMap.set(widget.id, { ...existing, x: data.x, y: data.y });
                    }
                    return newMap;
                  });
                }}
                onResizeStart={() => setActiveIndex(widget.id)}
                onResizeStop={(_, __, ref, ___, position) => {
                  setWidgetPositions(prev => {
                    const newMap = new Map(prev);
                    newMap.set(widget.id, {
                      x: position.x,
                      y: position.y,
                      width: parseInt(ref.style.width),
                      height: parseInt(ref.style.height)
                    });
                    return newMap;
                  });
                }}
                onTouchStart={() => setActiveIndex(widget.id)}
                onStateChange={(state) => updateWidgetState(widget.id, state)}
                toggleConfetti={setUseConfetti}
              />
            );
          })}
        </Board>
        
        {/* Sticker mode indicator */}
        {stickerMode && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[999] bg-soft-white dark:bg-warm-gray-800 px-4 py-2 rounded-lg shadow-lg flex items-center space-x-3">
            <span className="text-warm-gray-700 dark:text-warm-gray-200">
              Sticker mode: Click to stamp {selectedStickerType}
            </span>
            <button
              onClick={() => setStickerMode(false)}
              className="px-3 py-1 bg-warm-gray-300 hover:bg-warm-gray-400 dark:bg-warm-gray-600 dark:hover:bg-warm-gray-500 text-warm-gray-700 dark:text-warm-gray-200 rounded-md transition-colors duration-200"
            >
              Exit (ESC)
            </button>
          </div>
        )}
      </div>
      
      {/* Confetti */}
      {useConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
          wind={0.01}
          colors={["#FFC700", "#FF0000", "#2E3192", "#41BBC7"]}
          confettiSource={{ x: 0, y: 0, w: window.innerWidth, h: 0 }}
          style={{ zIndex: 1000 }}
        />
      )}
    </ModalProvider>
  );
}

export default App;