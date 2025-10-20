// Removed Chakra UI imports
import React, { useState, useCallback, useEffect, useRef } from "react";
import actionClickSoundFile from '../../../sounds/action_click.mp3';
import { widgetContainer } from '../../../shared/utils/styles';

function TrafficLight() {
  const [state, setState] = useState({
    activeLight: "#ff0000",
    boxHeight: 100,
    num: 0,
  });

  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (boxRef.current) {
      const node = boxRef.current;
      const resizeObserver = new ResizeObserver(() => {
        const newHeight = Math.min(
          Math.round(node.getBoundingClientRect().width / 4.5),
          Math.round(node.getBoundingClientRect().height * 0.4)
        );
        setState((prevState) => ({
          ...prevState,
          boxHeight: newHeight,
        }));
      });

      // Set initial box height
      const initialHeight = Math.min(
        Math.round(node.getBoundingClientRect().width / 4.5),
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


  const handleLightClick = useCallback((color: string) => {
    new Audio(actionClickSoundFile).play();
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
      <div className={`${widgetContainer} p-2`} id="baller">
        <div
          className="rounded-xl flex flex-col w-full h-full"
          ref={boxRef}
        >
          <div className="relative flex justify-center px-12">
            <div
              className="relative flex rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 shadow-2xl overflow-visible"
              id="boxlol"
              style={{
                height: `${state.boxHeight}px`,
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.1)'
              }}
            >
              <div
                className="flex flex-row items-center justify-center h-full px-4 py-2"
              >
              {["#ff0000", "#ffa500", "#008000"].map((color, index) => (
                <div
                  key={color}
                  className="clickable relative rounded-full cursor-pointer mx-1 transition-all duration-300 hover:scale-105"
                  style={{
                    width: `${state.boxHeight * 0.7}px`,
                    height: `${state.boxHeight * 0.7}px`,
                    background: state.activeLight === color 
                      ? `radial-gradient(circle at 30% 30%, ${
                          color === "#ff0000" ? "#ff6666" :
                          color === "#ffa500" ? "#ffcc66" :
                          "#66cc66"
                        }, ${color})`
                      : `radial-gradient(circle at 30% 30%, ${
                          color === "#ff0000" ? "#660000" :
                          color === "#ffa500" ? "#663300" :
                          "#003300"
                        }, ${
                          color === "#ff0000" ? "#330000" :
                          color === "#ffa500" ? "#331a00" :
                          "#001a00"
                        })`,
                    boxShadow: state.activeLight === color 
                      ? `0 0 20px 5px ${
                          color === "#ffa500" ? "rgba(255, 165, 0, 0.5)" : 
                          color === "#008000" ? "rgba(34, 139, 34, 0.5)" : 
                          "rgba(220, 20, 20, 0.5)"
                        }, inset -2px -2px 8px rgba(0, 0, 0, 0.3), inset 2px 2px 8px rgba(255, 255, 255, 0.2)`
                      : "inset -2px -2px 8px rgba(0, 0, 0, 0.5), inset 1px 1px 4px rgba(255, 255, 255, 0.1)",
                    border: "2px solid rgba(0, 0, 0, 0.3)",
                    transform: state.activeLight === color ? "translateZ(10px)" : "translateZ(0)"
                  }}
                  onClick={() => handleLightClick(color)}
                >
                  {/* Glass reflection effect */}
                  <div 
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      top: '10%',
                      left: '15%',
                      width: '40%',
                      height: '35%',
                      background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.4) 0%, transparent 70%)',
                      filter: 'blur(2px)'
                    }}
                  />
                </div>
              ))}
              </div>
            </div>
          </div>
          <div
            id="balls"
            className="flex flex-col w-full flex-1 justify-center items-center px-4 py-3"
          >
            <div className="bg-warm-gray-100/90 dark:bg-warm-gray-800/90 backdrop-blur-sm rounded-xl px-5 py-4 max-w-full shadow-lg border border-warm-gray-200/50 dark:border-warm-gray-700/50">
              <h1 className="text-warm-gray-800 dark:text-warm-gray-200 text-center text-base font-medium leading-relaxed">
                {state.activeLight === "#ff0000" && "Teacher's turn. Listen carefully and stay silent."}
                {state.activeLight === "#ffa500" && "Work quietly on your own. Stay focused and respectful of others' space"}
                {state.activeLight === "#008000" && "Discuss. Talk with your partner using inside voices. Stay on task and share ideas."}
              </h1>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default TrafficLight;