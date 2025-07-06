import "./App.css";
import Toolbar from "./components/toolbar/toolbar.tsx";
import Randomiser from "./components/randomiser/randomiser.tsx";
import Timer from "./components/timer/timer.tsx";
import List from "./components/list/list.tsx";
import Work from "./components/work/work.tsx";
import TrafficLight from "./components/trafficLight/trafficLight.tsx";
import AudioVolumeMonitor from "./components/volumeLevel/volumeLevel.tsx";
import ShortenLink from "./components/shortenLink/shortenLink.tsx";
import TextBanner from "./components/textBanner/textBanner.tsx";
import ImageDisplay from "./components/imageDisplay/imageDisplay.tsx";
import SoundEffects from "./components/soundEffects/soundEffects.tsx";
import Background from "./components/backgrounds/backgrounds.tsx";
import Sticker from "./components/sticker/sticker.tsx";

import { useEffect, useState, useRef } from "react";
import { Rnd } from "react-rnd";
import { v4 as uuidv4 } from "uuid"; // Import UUID package

import Confetti from "react-confetti";
import { WIDGET_TYPES } from "./constants/widgetTypes";
import { getWidgetConfig } from "./constants/widgetConfigs";

// Audio import for trash sound
import trashSound from "./sounds/trash-crumple.mp3";
const trashAudio = new Audio(trashSound);

function App() {
  const [useConfetti, setUseConfetti] = useState(false);
  const [componentList, setComponentList] = useState([]);
  const [activeIndex, setActiveIndex] = useState(null);
  const [generatedComponents, setGeneratedComponents] = useState([]);
  const [hoveringTrashId, setHoveringTrashId] = useState(null);
  const [widgetPositions, setWidgetPositions] = useState(new Map());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [widgetStates, setWidgetStates] = useState(new Map());
  const [backgroundType, setBackgroundType] = useState('geometric');
  const [darkMode, setDarkMode] = useState(() => {
    // Check localStorage for saved preference
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      return JSON.parse(saved);
    }
    // Check system preference
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [stickerMode, setStickerMode] = useState(false);
  const [selectedStickerType, setSelectedStickerType] = useState('heart');
  
  // Update individual widget state
  const updateWidgetState = (widgetId, state) => {
    setWidgetStates(prev => {
      const newMap = new Map(prev);
      newMap.set(widgetId, state);
      return newMap;
    });
  };

  // Apply dark mode class to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  // Component definitions moved to rendering function to use props

  // Find a non-overlapping position for a new widget
  const findAvailablePosition = (widgetWidth, widgetHeight) => {
    const padding = 20; // Minimum space between widgets
    const scrollContainer = document.querySelector('.board-scroll-container');
    
    // Get current viewport bounds
    const scrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;
    const scrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Define the bounds for placing new widgets (within current viewport)
    const minX = scrollLeft + padding;
    const maxX = scrollLeft + viewportWidth - widgetWidth - padding;
    const minY = scrollTop + padding;
    const maxY = scrollTop + viewportHeight - widgetHeight - padding - 60; // Account for toolbar
    
    // Center of current viewport
    const viewportCenterX = scrollLeft + viewportWidth / 2;
    const viewportCenterY = scrollTop + viewportHeight / 2;
    
    const maxAttempts = 50;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Try positions in a spiral pattern from viewport center
      const angle = attempt * 0.5;
      const radius = attempt * 15;
      
      // Calculate position but constrain to viewport bounds
      const x = Math.max(minX, Math.min(
        viewportCenterX + Math.cos(angle) * radius - widgetWidth / 2,
        maxX
      ));
      const y = Math.max(minY, Math.min(
        viewportCenterY + Math.sin(angle) * radius - widgetHeight / 2,
        maxY
      ));
      
      // Check if this position overlaps with any existing widget
      let overlaps = false;
      for (const [id, pos] of widgetPositions) {
        if (
          x < pos.x + pos.width + padding &&
          x + widgetWidth + padding > pos.x &&
          y < pos.y + pos.height + padding &&
          y + widgetHeight + padding > pos.y
        ) {
          overlaps = true;
          break;
        }
      }
      
      if (!overlaps) {
        return { x: Math.round(x), y: Math.round(y) };
      }
    }
    
    // If no position found, place at a random position within viewport
    return {
      x: Math.round(minX + Math.random() * (maxX - minX)),
      y: Math.round(minY + Math.random() * (maxY - minY))
    };
  };

  // Save workspace state to localStorage
  const saveWorkspaceState = () => {
    const workspaceData = {
      componentList: componentList,
      widgetPositions: Array.from(widgetPositions.entries()),
      widgetStates: Array.from(widgetStates.entries()),
      activeIndex: activeIndex,
      backgroundType: backgroundType
    };
    localStorage.setItem('workspaceState', JSON.stringify(workspaceData));
  };

  // Load workspace state from localStorage
  const loadWorkspaceState = () => {
    const savedState = localStorage.getItem('workspaceState');
    if (savedState) {
      try {
        const workspaceData = JSON.parse(savedState);
        setComponentList(workspaceData.componentList || []);
        setWidgetPositions(new Map(workspaceData.widgetPositions || []));
        setWidgetStates(new Map(workspaceData.widgetStates || []));
        setActiveIndex(workspaceData.activeIndex || null);
        if (workspaceData.backgroundType) {
          setBackgroundType(workspaceData.backgroundType);
        }
      } catch (error) {
        console.error('Error loading workspace state:', error);
      }
    }
  };

  // Track if initial load is complete
  const [isInitialized, setIsInitialized] = useState(false);

  // Load state on mount
  useEffect(() => {
    loadWorkspaceState();
    setIsInitialized(true);
  }, []);

  // Save state whenever relevant data changes (but not on initial load)
  useEffect(() => {
    if (isInitialized) {
      const timeoutId = setTimeout(() => {
        saveWorkspaceState();
      }, 500); // Debounce for 500ms
      
      return () => clearTimeout(timeoutId);
    }
  }, [componentList, widgetPositions, widgetStates, activeIndex, backgroundType]);

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Prevent swipe navigation
  useEffect(() => {
    // Push a dummy state to history
    window.history.pushState(null, '', window.location.href);
    
    const handlePopState = (e) => {
      // Push state again to prevent navigation
      window.history.pushState(null, '', window.location.href);
    };

    // Listen for browser back button
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
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

  useEffect(() => {
    const components = componentList.map(({ id, index }) => {
      // Get saved state for this widget
      const savedState = widgetStates.get(id);
      
      // Get widget configuration (with stamp type if applicable)
      const widgetConfig = index === WIDGET_TYPES.STAMP 
        ? getWidgetConfig(index, savedState?.stickerType || savedState?.stampType)
        : getWidgetConfig(index);
      const widgetWidth = widgetConfig.defaultWidth;
      const widgetHeight = widgetConfig.defaultHeight;
      
      // Create component with state props if needed
      const getComponentWithState = () => {
        switch(index) {
          case WIDGET_TYPES.RANDOMISER:
            return <Randomiser 
              toggleConfetti={setUseConfetti} 
              savedState={savedState}
              onStateChange={(state) => updateWidgetState(id, state)}
            />;
          case WIDGET_TYPES.TIMER:
            return <Timer />;
          case WIDGET_TYPES.LIST:
            return <List 
              savedState={savedState}
              onStateChange={(state) => updateWidgetState(id, state)}
            />;
          case WIDGET_TYPES.WORK_SYMBOLS:
            return <Work />;
          case WIDGET_TYPES.TRAFFIC_LIGHT:
            return <TrafficLight />;
          case WIDGET_TYPES.SOUND_MONITOR:
            return <AudioVolumeMonitor />;
          case WIDGET_TYPES.LINK_SHORTENER:
            return <ShortenLink />;
          case WIDGET_TYPES.TEXT_BANNER:
            return <TextBanner
              savedState={savedState}
              onStateChange={(state) => updateWidgetState(id, state)}
            />;
          case WIDGET_TYPES.IMAGE_DISPLAY:
            return <ImageDisplay
              savedState={savedState}
              onStateChange={(state) => updateWidgetState(id, state)}
            />;
          case WIDGET_TYPES.SOUND_EFFECTS:
            return <SoundEffects isActive={activeIndex === id} />;
          case WIDGET_TYPES.STAMP:
            return <Sticker
              stickerType={savedState?.stickerType || savedState?.stampType || 'heart'}
              savedState={savedState}
              onStateChange={(state) => updateWidgetState(id, state)}
            />;
          default:
            return null;
        }
      };
      
      // Get or calculate position
      let position = widgetPositions.get(id);
      if (!position) {
        position = findAvailablePosition(widgetWidth, widgetHeight);
        setWidgetPositions(prev => new Map(prev).set(id, { 
          x: position.x, 
          y: position.y, 
          width: widgetWidth, 
          height: widgetHeight 
        }));
      }
      
      // Use the stored size if available (for stickers with random sizes)
      const actualWidth = position.width || widgetWidth;
      const actualHeight = position.height || widgetHeight;
      
      return (
        <Rnd
          default={{
            x: position.x,
            y: position.y,
            width: `${actualWidth}px`,
            height: `${actualHeight}px`,
          }}
        minWidth={`${widgetConfig.minWidth}px`}
        minHeight={`${widgetConfig.minHeight}px`}
        key={id}
        id={id}
        lockAspectRatio={widgetConfig.lockAspectRatio}
        enableUserSelectHack={true}
        bounds="#widget-board"
        style={{
          zIndex: index === WIDGET_TYPES.STAMP 
            ? (activeIndex === id ? 999 : 900) // Stickers always 900+
            : (activeIndex === id ? 500 : "auto"), // Other widgets max 500
          opacity: hoveringTrashId === id ? 0.2 : 1,
          transition: "opacity 0.2s ease",
          cursor: hoveringTrashId === id ? "not-allowed" : "auto"
        }}
        onDragStart={() => {
          setActiveIndex(id);
        }}
        onDrag={(e) => {
          // Check if ANY widget being dragged is over trash
          if (isOverTrash(e.clientX, e.clientY)) {
            setHoveringTrashId(id);
          } else {
            // Clear hover state when not over trash
            setHoveringTrashId(null);
          }
        }}
        onResizeStart={() => {
          setActiveIndex(id);
        }}
        onTouchStart={() => {
          setActiveIndex(id);
        }}
        onDragStop={(e, data) => {
          trashHandler(e, data, id);
          // Always clear hover state when drag ends
          if (hoveringTrashId === id) {
            setHoveringTrashId(null);
          }
          // Update position in state
          setWidgetPositions(prev => {
            const newMap = new Map(prev);
            const existing = newMap.get(id);
            if (existing) {
              newMap.set(id, { ...existing, x: data.x, y: data.y });
            }
            return newMap;
          });
        }}
        onResizeStop={(e, direction, ref, delta, position) => {
          // Update size and position in state
          setWidgetPositions(prev => {
            const newMap = new Map(prev);
            newMap.set(id, {
              x: position.x,
              y: position.y,
              width: parseInt(ref.style.width),
              height: parseInt(ref.style.height)
            });
            return newMap;
          });
        }}
      >
        {getComponentWithState()}
      </Rnd>
      );
    });

    setGeneratedComponents(components);
  }, [componentList, activeIndex, hoveringTrashId]);

  function isOverTrash(x, y) {
    const trashElement = document.getElementById("trash");
    if (!trashElement) return false;
    
    const trashLocation = trashElement.getBoundingClientRect();
    // Create a larger hitbox that extends upward
    const extendedHeight = trashLocation.height * 2; // Double the height
    const extendedTop = trashLocation.y - trashLocation.height; // Extend upward by one trash height
    
    // x and y are already in viewport coordinates from the drag event
    return (
      x >= trashLocation.x &&
      x <= trashLocation.x + trashLocation.width &&
      y >= extendedTop &&
      y <= trashLocation.y + trashLocation.height
    );
  }

  function trashHandler(mouseEvent, data, id) {
    if (isOverTrash(mouseEvent.x, mouseEvent.y)) {
      // Play trash sound
      trashAudio.play().catch(error => {
        console.error("Error playing trash sound:", error);
      });
      
      setComponentList((oldList) =>
        oldList.filter((component) => component.id !== id)
      );
      setHoveringTrashId(null);
      
      // Remove position from map
      setWidgetPositions(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
      
      // Remove state from map
      setWidgetStates(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
    }
  }

  // Handle sticker placement
  const handleBoardClick = (e) => {
    if (!stickerMode) return;
    
    // Get click position relative to the board
    const boardElement = document.getElementById('widget-board');
    const rect = boardElement.getBoundingClientRect();
    const scrollContainer = document.querySelector('.board-scroll-container');
    
    const x = e.clientX - rect.left + scrollContainer.scrollLeft;
    const y = e.clientY - rect.top + scrollContainer.scrollTop;
    
    // Create new sticker
    const newId = uuidv4();
    const stickerConfig = getWidgetConfig(WIDGET_TYPES.STAMP, selectedStickerType);
    
    // Add sticker to component list
    setComponentList(prev => [...prev, { id: newId, index: WIDGET_TYPES.STAMP }]);
    
    // Generate random rotation for new sticker
    const getRandomRotation = () => {
      const steps = [];
      for (let i = -40; i <= 40; i += 5) {
        steps.push(i);
      }
      return steps[Math.floor(Math.random() * steps.length)];
    };
    
    // Generate random color index (0-5 for 6 colors)
    const getRandomColorIndex = () => {
      return Math.floor(Math.random() * 6);
    };
    
    // Generate random size variation (90% to 110% of default)
    const sizeVariation = 0.9 + Math.random() * 0.2; // Random between 0.9 and 1.1
    const randomWidth = Math.round(stickerConfig.defaultWidth * sizeVariation);
    const randomHeight = Math.round(stickerConfig.defaultHeight * sizeVariation);
    
    // Set initial position centered on click with random size
    setWidgetPositions(prev => new Map(prev).set(newId, {
      x: x - randomWidth / 2,
      y: y - randomHeight / 2,
      width: randomWidth,
      height: randomHeight
    }));
    
    // Set sticker type in widget state
    setWidgetStates(prev => new Map(prev).set(newId, { 
      stickerType: selectedStickerType,
      colorIndex: getRandomColorIndex(),
      rotation: getRandomRotation()
    }));
    
    setActiveIndex(newId);
  };

  return (
    <>
      <meta charset="UTF-8" />
      <div className="App dark:bg-warm-gray-900">
        {/* Fixed UI elements */}
        <div className="fixed-ui">
          {/* Fullscreen button */}
          <button
            onClick={toggleFullscreen}
            className="fixed top-4 right-4 z-[999] p-2 bg-warm-gray-200 hover:bg-warm-gray-300 dark:bg-warm-gray-800 dark:hover:bg-warm-gray-700 text-warm-gray-700 dark:text-warm-gray-200 rounded-md transition-colors duration-200"
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
        
        {/* Scrollable board */}
        <div className="board-scroll-container">
          <div 
            className="board" 
            id="widget-board"
            onClick={handleBoardClick}
            style={{ cursor: stickerMode ? 'crosshair' : 'default' }}
          >
            <Background type={backgroundType} />
            {generatedComponents}
          </div>
        </div>
        
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
    </>
  );
}

export default App;
