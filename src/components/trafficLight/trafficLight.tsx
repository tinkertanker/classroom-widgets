// Removed Chakra UI imports
import React, { useState, useCallback, useEffect, useRef } from "react";

function TrafficLight() {
  const [state, setState] = useState({
    activeLight: "#ff0000",
    boxHeight: 100,
    contextMenu: { show: false, x: 0, y: 0 },
    num: 0,
  });

  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (boxRef.current) {
      const node = boxRef.current;
      const resizeObserver = new ResizeObserver(() => {
        const newHeight = Math.min(
          Math.round(node.getBoundingClientRect().width / 3),
          Math.round(node.getBoundingClientRect().height * 0.4)
        );
        setState((prevState) => ({
          ...prevState,
          boxHeight: newHeight,
        }));
      });

      // Set initial box height
      const initialHeight = Math.min(
        Math.round(node.getBoundingClientRect().width / 3),
        Math.round(node.getBoundingClientRect().height * 0.4)
      );
      setState((prevState) => ({
        ...prevState,
        boxHeight: initialHeight,
      }));

      resizeObserver.observe(node);

      return () => {
        resizeObserver.disconnect();
      };
    }
  }, []); // Empty dependency array ensures this runs only once when the component mounts

  const handleContextMenu = useCallback((e) => {
    const target = e.target.closest("#baller");
    if (target) {
      const { pageX, pageY } = e;
      // e.preventDefault(); this is supposed to disable right click but can be explored in future
      setState((prevState) => ({
        ...prevState,
        contextMenu: { show: true, x: pageX, y: pageY },
      }));
    }
  }, []);

  useEffect(() => {
    window.addEventListener("contextmenu", handleContextMenu);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [handleContextMenu]);

  const closeContextMenu = useCallback(() => {
    setState((prevState) => ({
      ...prevState,
      contextMenu: { show: false, x: 0, y: 0 },
    }));
  }, []);

  const handleLightClick = useCallback((color) => {
    setState((prevState) => ({
      ...prevState,
      activeLight: color,
    }));
  }, []);

  const toggleInputButtons = useCallback(() => {
    setState((prevState) => ({
      ...prevState,
      num: prevState.num === 0 ? 2 : 0,
    }));
  }, []);



  return (
    <>
      <div className="w-full h-full" id="baller">
        <div
          className="rounded-md flex flex-col w-full h-full"
          ref={boxRef}
        >
          <div
            className="flex rounded-md bg-black w-full"
            id="boxlol"
            style={{
              height: `${state.boxHeight}px`
            }}
          >
            <div
              className="flex flex-row items-center justify-center w-full h-full"
            >
              {["#ff0000", "#ffa500", "#008000"].map((color, index) => (
                <div
                  key={color}
                  className="rounded-full cursor-pointer mx-2"
                  style={{
                    width: `${state.boxHeight * 0.6}px`,
                    height: `${state.boxHeight * 0.6}px`,
                    boxShadow: state.activeLight === color ? `0px 0px 20px 10px ${
                      color === "#ffa500" ? "#ff8c00" : 
                      color === "#008000" ? "#006400" : 
                      color
                    }` : "none",
                    backgroundColor: color,
                    filter: state.activeLight === color ? "brightness(200%)" : "brightness(30%)"
                  }}
                  onClick={() => handleLightClick(color)}
                />
              ))}
            </div>
          </div>
          <div
            id="balls"
            className="flex flex-col w-full justify-center items-center px-4"
            style={{ height: '75px' }}
          >
          <h1 className="text-warm-gray-800 dark:text-warm-gray-200 text-center text-lg font-medium">
            {state.activeLight === "#ff0000" && "Teacher's turn to speak. Be attentive and quiet."}
            {state.activeLight === "#ffa500" && "Work on your own quietly."}
            {state.activeLight === "#008000" && "Discuss with your partners using your inside voice."}
          </h1>
          </div>
        </div>
      </div>
    </>
  );
}

export default TrafficLight;