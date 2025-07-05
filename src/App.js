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

import { useEffect, useState, useRef } from "react";
import { Rnd } from "react-rnd";
import { v4 as uuidv4 } from "uuid"; // Import UUID package

import Confetti from "react-confetti";
import { WIDGET_TYPES } from "./constants/widgetTypes";

// Audio import for trash sound
const trashSound = require("./sounds/trash-crumple.mp3");
const trashAudio = new Audio(trashSound);

function App() {
  const [useconfetti, setUseconfetti] = useState(false);
  const [useconfetti2, setUseconfetti2] = useState(false);
  const [componentList, setComponentList] = useState([]);
  const [activeIndex, setActiveIndex] = useState(null);
  const [generatedComponents, setGeneratedComponents] = useState([]);
  const [hoveringTrashId, setHoveringTrashId] = useState(null);
  const [widgetPositions, setWidgetPositions] = useState(new Map());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [widgetStates, setWidgetStates] = useState(new Map());
  const [backgroundType, setBackgroundType] = useState('solid');
  
  // Update individual widget state
  const updateWidgetState = (widgetId, state) => {
    setWidgetStates(prev => {
      const newMap = new Map(prev);
      newMap.set(widgetId, state);
      return newMap;
    });
  };

  // Component definitions moved to rendering function to use props

  // Find a non-overlapping position for a new widget
  const findAvailablePosition = (widgetWidth, widgetHeight) => {
    const padding = 20; // Minimum space between widgets
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const toolbarHeight = 80; // Approximate toolbar height
    
    // Try grid positions starting from top-left
    const gridSize = 50; // Grid step size
    const maxAttempts = 50;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Try positions in a spiral pattern from center
      const angle = attempt * 0.5;
      const radius = attempt * 15;
      const centerX = windowWidth / 2;
      const centerY = (windowHeight - toolbarHeight) / 2;
      
      const x = Math.max(padding, Math.min(
        centerX + Math.cos(angle) * radius - widgetWidth / 2,
        windowWidth - widgetWidth - padding
      ));
      const y = Math.max(padding, Math.min(
        centerY + Math.sin(angle) * radius - widgetHeight / 2,
        windowHeight - widgetHeight - toolbarHeight - padding
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
    
    // If no position found, use random position
    return {
      x: Math.round(Math.random() * (windowWidth - widgetWidth - padding * 2) + padding),
      y: Math.round(Math.random() * (windowHeight - widgetHeight - toolbarHeight - padding * 2) + padding)
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

  useEffect(() => {
    const components = componentList.map(({ id, index }) => {
      // Determine widget size
      const widgetWidth = index === WIDGET_TYPES.TRAFFIC_LIGHT ? 150 : index === WIDGET_TYPES.TEXT_BANNER ? 500 : index === WIDGET_TYPES.SOUND_EFFECTS ? 80 : 350;
      const widgetHeight = index === WIDGET_TYPES.TRAFFIC_LIGHT ? 150 : index === WIDGET_TYPES.RANDOMISER ? 250 : index === WIDGET_TYPES.TEXT_BANNER ? 200 : index === WIDGET_TYPES.SOUND_EFFECTS ? 420 : index === WIDGET_TYPES.TIMER ? 382 : 350;
      
      // Get saved state for this widget
      const savedState = widgetStates.get(id);
      
      // Create component with state props if needed
      const getComponentWithState = () => {
        switch(index) {
          case WIDGET_TYPES.RANDOMISER:
            return <Randomiser 
              toggleConfetti={setUseconfetti} 
              savedState={savedState}
              onStateChange={(state) => updateWidgetState(id, state)}
            />;
          case WIDGET_TYPES.TIMER:
            return <Timer />;
          case WIDGET_TYPES.LIST:
            return <List 
              toggleConfetti={setUseconfetti2}
              savedState={savedState}
              onStateChange={(state) => updateWidgetState(id, state)}
            />;
          case WIDGET_TYPES.WORK_SYMBOLS:
            return <Work />;
          case WIDGET_TYPES.TRAFFIC_LIGHT:
            return <TrafficLight />;
          case WIDGET_TYPES.LOUDNESS_MONITOR:
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
      
      return (
        <Rnd
          default={{
            x: position.x,
            y: position.y,
            width: `${widgetWidth}px`,
            height: `${widgetHeight}px`,
          }}
        minWidth={index === WIDGET_TYPES.TRAFFIC_LIGHT ? "150px" : index === WIDGET_TYPES.SOUND_EFFECTS ? "80px" : index === WIDGET_TYPES.TIMER ? "250px" : "200px"}
        minHeight={index === WIDGET_TYPES.TRAFFIC_LIGHT ? "150px" : index === WIDGET_TYPES.RANDOMISER ? "150px" : index === WIDGET_TYPES.TEXT_BANNER ? "80px" : index === WIDGET_TYPES.TIMER ? "282px" : "200px"}
        key={id}
        id={id}
        lockAspectRatio={index === WIDGET_TYPES.LOUDNESS_MONITOR || index === WIDGET_TYPES.RANDOMISER || index === WIDGET_TYPES.TEXT_BANNER || index === WIDGET_TYPES.IMAGE_DISPLAY || index === WIDGET_TYPES.SOUND_EFFECTS ? false : index === WIDGET_TYPES.TIMER ? (350 / 382) : true}
        enableUserSelectHack={true}
        bounds="parent"
        // dragGrid={[100, 100]} // can implement grid if future interns want
        // resizeGrid={[1, 1]}
        style={{
          zIndex: activeIndex === id ? 998 : "auto",
          opacity: hoveringTrashId === id ? 0.2 : 1,
          transition: "opacity 0.2s ease",
          cursor: hoveringTrashId === id ? "not-allowed" : "auto",
          // borderWidth: activeIndex === id ? "2px":"0px",
          // borderColor:"skyblue" // for future interns to implement
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

  return (
    <>
      <meta charset="UTF-8" />
      <div className="App">
        <Background type={backgroundType} />
        <header className="App-header">
          <div className="flex flex-col w-full h-full justify-center items-center">
            {/* Fullscreen button */}
            <button
              onClick={toggleFullscreen}
              className="absolute top-4 right-4 z-[999] p-2 bg-warm-gray-200 hover:bg-warm-gray-300 text-warm-gray-700 rounded-md transition-colors duration-200"
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
            <div className="absolute right-2.5 left-2.5 top-2.5 bottom-2.5">
              {generatedComponents}
            </div>
            <div className="toolbar-container w-full h-[10%] mb-2.5">
              <Toolbar 
                setComponentList={setComponentList} 
                activeIndex={activeIndex} 
                setActiveIndex={setActiveIndex} 
                hoveringTrash={hoveringTrashId !== null}
                backgroundType={backgroundType}
                setBackgroundType={setBackgroundType}
              />
            </div>
          </div>
        </header>
      </div>
      {useconfetti && (
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
      {useconfetti2 && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
          wind={0.01}
          colors={["#FFC700", "#FF0000", "#2E3192", "#41BBC7"]}
          confettiSource={{ x: 0, y: 0, w: window.innerWidth, h: 0 }}
        />
      )}
    </>
  );
}

export default App;
