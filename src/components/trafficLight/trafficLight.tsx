// Removed Chakra UI imports
import React, { useState, useCallback, useEffect, useRef } from "react";
import ContextMenus from "../obselete_dont_delete/contextMenu.tsx";

function TrafficLight() {
  const [state, setState] = useState({
    activeLight: "#ff0000",
    boxWidth: 100,
    contextMenu: { show: false, x: 0, y: 0 },
    num: 0,
  });

  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (boxRef.current) {
      const node = boxRef.current;
      const resizeObserver = new ResizeObserver(() => {
        const newWidth = Math.round(
          (node.getBoundingClientRect().height / 5) * 2
        );
        setState((prevState) => ({
          ...prevState,
          boxWidth: newWidth,
        }));
      });

      // Set initial box width
      setState((prevState) => ({
        ...prevState,
        boxWidth: Math.round((node.getBoundingClientRect().height / 5) * 2),
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
      <div className="bg-soft-white dark:bg-warm-gray-800 rounded-md shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full" id="baller">
        <div
          className="rounded-md flex flex-row w-full h-full bg-soft-white dark:bg-warm-gray-800"
          ref={boxRef}
        >
          <div
            className="flex rounded-md bg-black flex-grow flex-shrink h-full"
            id="boxlol"
            style={{
              maxWidth: `${state.boxWidth}px`,
              minWidth: `${state.boxWidth}px`
            }}
          >
            <div
              className="flex flex-col items-center h-full w-full"
            >
              {["#ff0000", "#ffff00", "#00ff00"].map((color, index) => (
                <div
                  key={color}
                  className="w-1/2 h-1/5 rounded-full cursor-pointer m-[12.5%]"
                  style={{
                    boxShadow: state.activeLight === color ? `0px 0px 20px 10px ${color}` : "none",
                    backgroundColor: color,
                    filter: state.activeLight === color ? "brightness(200%)" : "brightness(30%)",
                    marginTop: index === 0 ? "25%" : "12.5%",
                    marginBottom: index === 2 ? "25%" : "12.5%"
                  }}
                  onClick={() => handleLightClick(color)}
                />
              ))}
            </div>
          </div>
          <div
            id="balls"
            className="flex flex-col bg-soft-white dark:bg-warm-gray-800 h-full justify-evenly flex-grow px-4"
          >
          <h1 className="text-warm-gray-800 dark:text-warm-gray-200">
            {state.activeLight === "#ff0000" && "Teacher's turn to speak. Be attentive and quiet."}
            {state.activeLight === "#ffff00" && "Work on your own quietly."}
            {state.activeLight === "#00ff00" && "Discuss with your partners using your inside voice."}
          </h1>
          </div>
        </div>
      </div>
    </>
  );
}

export default TrafficLight;