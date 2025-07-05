import "./App.css";
import Toolbar from "./components/toolbar/toolbar.tsx";
import Randomiser from "./components/randomiser/randomiser.tsx";
import Time from "./components/clock/clock.tsx";
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
  const Components = [
    <Randomiser toggleConfetti={setUseconfetti} />,
    <Timer />,
    <List toggleConfetti={setUseconfetti2} />,
    <Work />,
    <Time />,
    <TrafficLight />,
    <AudioVolumeMonitor />,
    <ShortenLink />, //for some reason the link shortener doesnt work when deployed due to cors, to be fixed in future
  ];


  useEffect(() => {
    const components = componentList.map(({ id, index }) => (
      <Rnd
        default={{
          x: 0,
          y: 0,
          width: index === 4 ? "150px" : "350px",
          height: index === 4 ? "150px" : index === 0 ? "250px" : "350px",
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
        }}
       
      >
        {Components[index]}
      </Rnd>
    ));

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
