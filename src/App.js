import "./App.css";
import Toolbar from "./components/toolbar/toolbar.tsx";
import Randomiser from "./components/randomiser/randomiser.tsx";
import Timer from "./components/timer/timer.tsx";
import List from "./components/list/list.tsx";
import Work from "./components/work/work.tsx";
import TrafficLight from "./components/trafficLight/trafficLight.tsx";
import AudioVolumeMonitor from "./components/volumeLevel/volumeLevel.tsx";
import ShortenLink from "./components/shortenLink/shortenLink.tsx";

import { useEffect, useState, useRef } from "react";
import { Rnd } from "react-rnd";
import { v4 as uuidv4 } from "uuid"; // Import UUID package

import Confetti from "react-confetti";

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
  const Components = [
    <Randomiser toggleConfetti={setUseconfetti} />,
    <Timer />,
    <List toggleConfetti={setUseconfetti2} />,
    <Work />,
    <TrafficLight />,
    <AudioVolumeMonitor />,
    <ShortenLink />, //for some reason the link shortener doesnt work when deployed due to cors, to be fixed in future
  ];

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


  useEffect(() => {
    const components = componentList.map(({ id, index }) => {
      // Determine widget size
      const widgetWidth = index === 4 ? 150 : 350;
      const widgetHeight = index === 4 ? 150 : index === 0 ? 250 : 350;
      
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
        minWidth={index === 4 ? "150px" : "200px"}
        minHeight={index === 4 ? "150px" : index === 0 ? "150px" : "200px"}
        key={id}
        id={id}
        lockAspectRatio={index === 5 || index === 0 ? false : true}
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
        {Components[index]}
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
    }
  }

  return (
    <>
      <meta charset="UTF-8" />
      <div className="App">
        <header className="App-header">
          <div className="flex flex-col w-full h-full justify-center items-center">
            <div className="absolute right-2.5 left-2.5 top-2.5 bottom-2.5">
              {generatedComponents}
            </div>
            <div className="toolbar-container w-full h-[10%] mb-2.5">
              <Toolbar setComponentList={setComponentList} activeIndex={activeIndex} setActiveIndex={setActiveIndex} hoveringTrash={hoveringTrashId !== null} />
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
