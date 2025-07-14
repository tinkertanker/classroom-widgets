import * as React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import SlotMachine from "./slotMachine";
import RandomiserSettings from "./RandomiserSettings";
import { useModal } from "../../contexts/ModalContext";
import { RandomiserProps, RandomiserState } from "./types";
import { FaDice, FaRotate, FaGear } from 'react-icons/fa6';
import celebrateSoundFile from "./celebrate.mp3";

// Removed Chakra UI imports

let actual_choices: string[];

let yay = new Audio(celebrateSoundFile);

function Randomiser({ toggleConfetti, savedState, onStateChange }: RandomiserProps) {
  const initialResultFocus = React.useRef(null);
  const [result, setResult] = useState("Enter a list to randomise!");
  const [input, setInput] = useState(savedState?.input || "");
  const [choices, setChoices] = useState<string[]>(savedState?.choices || []);
  const choicesRef = useRef(choices);

  const [removedChoices, setRemovedChoices] = useState<string[]>([]);
  const removedChoicesRef = useRef(removedChoices);

  const [buttonsettings, setButtonSettings] = useState("normal");

  const [textheight, setTextheight] = useState(0);
  const [boxheight, setBoxheight] = useState(0);

  // Use global modal
  const { showModal } = useModal();

  const openSettings = () => {
    showModal({
      title: "Randomiser Settings",
      content: (
        <RandomiserSettings
          choices={choices}
          removedChoices={removedChoices}
          onUpdateChoices={(newChoices) => {
            setChoices(newChoices);
            choicesRef.current = newChoices;
            setInput(newChoices.join('\n'));
          }}
          onUpdateRemovedChoices={(newRemovedChoices) => {
            setRemovedChoices(newRemovedChoices);
            removedChoicesRef.current = newRemovedChoices;
          }}
        />
      ),
      className: "bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-xl max-w-3xl",
      onClose: () => {
        console.log("Settings modal closed, final choices:", choicesRef.current);
        console.log("Settings modal closed, removed choices:", removedChoicesRef.current);
        // Update displayChoices to show items immediately if there are active choices
        const activeChoices = choicesRef.current.filter(choice => !removedChoicesRef.current.includes(choice));
        if (activeChoices.length > 0) {
          setDisplayChoices(activeChoices);
          // Reset spinning state and select first item
          setIsSpinning(false);
          setSelectedItemIndex(0);
        } else {
          // Clear display choices if no active choices
          setDisplayChoices([]);
          setResult("Enter a list to randomise!");
        }
      }
    });
  };


  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);

  const [loading, setLoading] = useState(false);
  const [displayChoices, setDisplayChoices] = useState<string[]>([]);

  // Notify parent of state changes
  const updateState = () => {
    if (onStateChange) {
      onStateChange({
        input: input,
        choices: choices,
        removedChoices: removedChoices
      });
    }
  };

  // Update state whenever input or choices change (skip initial render)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    updateState();
  }, [input, choices]);

  const handlerandomise = () => {
    toggleConfetti(false);
    yay.pause();
    yay.currentTime = 0;

    const processedChoices = processChoices();
    setChoices(processedChoices); // Update choices when randomizing

    if (processedChoices.length !== 0) {
      setLoading(true);
      // localStorage.setItem("input", input);
      // Filter out removed items
      actual_choices = processedChoices.filter(choice => !removedChoices.includes(choice));

      if (actual_choices.length === 0) {
        setLoading(false);
        alert("All items have been removed! Please restore some items or add new ones.");
        openSettings();
        return;
      }

      // Set the display choices to the filtered list
      setDisplayChoices(actual_choices);

      // Don't clean up removed items - they should persist even if not in active list

      // Randomize the order of elements in actual_choices using Fisher-Yates shuffle algorithm
      for (let i = actual_choices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [actual_choices[i], actual_choices[j]] = [
          actual_choices[j],
          actual_choices[i],
        ];
      }

    } else {
      setResult("Nothing to randomise! Click me to enter a list to randomise!");
      setInput("");
      setChoices([]);
      setTimeout(function () {
        setResult("Enter a list to randomise!");
      }, 2000);
    }
  };

  

  // Process choices only when needed (before randomizing)
  const processChoices = () => {
    let temporarychoices = input.split("\n");
    temporarychoices = temporarychoices.map((value) => value.trim()); // remove leading and trailing spaces
    temporarychoices = temporarychoices.filter((value, index, array) => {
      if (value === "") {
        return false;
      } else {
        if (array.indexOf(value) !== index) {
          return false;
        } else {
          return true;
        }
      }
    });
    return temporarychoices;
  };

  // Removed the effect that was resetting buttonsettings to normal

  // Update result message when choices change
  useEffect(() => {
    if (choices.length > 0 && result === "Enter a list to randomise!") {
      setResult("Ready to randomise!");
    } else if (choices.length === 0 && result === "Ready to randomise!") {
      setResult("Enter a list to randomise!");
    }
  }, [choices, result]);

  // Keep choices in sync with input
  useEffect(() => {
    const processedChoices = processChoices();
    if (JSON.stringify(processedChoices) !== JSON.stringify(choices)) {
      setChoices(processedChoices);
    }
  }, [input]); // eslint-disable-line react-hooks/exhaustive-deps

  // Slot machine animation effect
  useEffect(() => {
    if (loading === true) {
      // Select a random index from actual_choices
      const randomIndex = Math.floor(Math.random() * actual_choices.length);
      setSelectedItemIndex(randomIndex);
      setIsSpinning(true);
      
      // Fixed spin duration
      const spinDuration = 3600; // 3.6 seconds
      
      // Set result after spinning completes
      setTimeout(() => {
        const selectedItem = actual_choices[randomIndex];
        setResult(selectedItem);
        actual_choices = [];
        setButtonSettings("result");
        setLoading(false);
        setIsSpinning(false);
        toggleConfetti(true);
        yay.play();
      }, spinDuration);
    }
  }, [loading]);

  const textRef = useCallback((node: HTMLElement | null) => {
    if (node !== null) {
      setTextheight(node.getBoundingClientRect().height);
      const resizeObserver = new ResizeObserver(() => {
        setTextheight(node.getBoundingClientRect().height);
        // console.log(node.getBoundingClientRect().height);
      });
      resizeObserver.observe(node);
    }
  }, []);

  const boxRef = useCallback((node: HTMLElement | null) => {
    if (node !== null) {
      setBoxheight(node.getBoundingClientRect().height);
      const resizeObserver2 = new ResizeObserver(() => {
        setBoxheight(node.getBoundingClientRect().height);
      });
      resizeObserver2.observe(node);
    }
  }, []);

  return (
    <>
      <div
        className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full flex flex-col relative"
        id="jason"
      >
        <div className="flex-1 overflow-hidden p-4">
          <button
            className={`w-full h-full p-0 rounded transition-colors duration-200 ${
              displayChoices.length > 0 
                ? 'bg-transparent hover:bg-white/10' 
                : 'bg-warm-gray-100 dark:bg-warm-gray-700 hover:bg-warm-gray-200 dark:hover:bg-warm-gray-600'
            }`}
            onDoubleClick={() => {
              if (loading === false) {
                openSettings();
              }
            }}
            title="Double-click to open settings"
          >
            {/* Super duper cool functionality here, if the height of the text is greater than box height then the text will align top, if not the text will align center, this is for use cases when the text is super long or when the box is resized */}
            <div
              ref={boxRef}
              className="h-full w-full overflow-y-auto flex justify-center"
              style={{
                alignItems: textheight > boxheight ? "start" : "center"
              }}
            >
              {displayChoices.length > 0  ? (
                <div className="w-full h-full flex items-center justify-center">
                  <SlotMachine
                    key={displayChoices.join(',')}
                    items={displayChoices}
                    selectedIndex={selectedItemIndex}
                    isSpinning={isSpinning}
                    duration={3600}
                  />
                </div>
              ) : (
                <div className="flex flex-col justify-center items-center w-[95%] gap-3">
                  <p
                    className="whitespace-normal break-words text-2xl text-center text-warm-gray-800 dark:text-warm-gray-200"
                    ref={textRef}
                  >
                    {result}
                  </p>
                  {result === "Enter a list to randomise!" && (
                    <button
                      className="px-3 py-1.5 bg-terracotta-500 hover:bg-terracotta-600 text-white text-sm rounded transition-colors duration-200 flex items-center gap-1.5"
                      onClick={openSettings}
                    >
                      <FaGear className="text-xs" />
                      Settings
                    </button>
                  )}
                </div>
              )}
            </div>
          </button>
        </div>
        {buttonsettings === "normal" ? (
          <div className="p-3 border-t border-warm-gray-200 dark:border-warm-gray-700 flex items-center justify-between">
            <button
              className="px-3 py-1.5 bg-sage-500 hover:bg-sage-600 dark:bg-sage-600 dark:hover:bg-sage-700 text-white text-sm rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              onClick={()=>handlerandomise()}
              disabled={loading}
            >
              <FaDice className="text-xs" />
              Randomise!!
            </button>
            <button
              className="p-2 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 rounded transition-colors duration-200"
              onClick={openSettings}
              title="Settings"
            >
              <FaGear className="text-terracotta-500 hover:text-terracotta-600 text-sm" />
            </button>
          </div>
        ) : buttonsettings === "result" ? (
          <div className="p-3 border-t border-warm-gray-200 dark:border-warm-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1.5 bg-dusty-rose-500 hover:bg-dusty-rose-600 dark:bg-dusty-rose-600 dark:hover:bg-dusty-rose-700 text-white text-sm rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => {
                  if (result && !removedChoices.includes(result)) {
                    // Add to removed list
                    const newRemovedChoices = [...removedChoices, result];
                    setRemovedChoices(newRemovedChoices);
                    removedChoicesRef.current = newRemovedChoices;
                    
                    // Remove from choices array
                    const newChoices = choices.filter(choice => choice !== result);
                    setChoices(newChoices);
                    choicesRef.current = newChoices;
                    setInput(newChoices.join('\n'));
                    
                    // Update display choices - filter out all removed items
                    const activeChoices = newChoices.filter(choice => !newRemovedChoices.includes(choice));
                    if (activeChoices.length > 0) {
                      setDisplayChoices(activeChoices);
                    } else {
                      // No more active choices, clear display
                      setDisplayChoices([]);
                      setResult("Enter a list to randomise!");
                    }
                    
                    // Reset to normal state after removing
                    setButtonSettings("normal");
                  }
                }}
                disabled={removedChoices.includes(result)}
              >
                {removedChoices.includes(result) ? "Already removed" : "Remove option"}
              </button>
              <button
                disabled={loading}
                ref={initialResultFocus}
                className="px-3 py-1.5 bg-sage-500 hover:bg-sage-600 dark:bg-sage-600 dark:hover:bg-sage-700 text-white text-sm rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                onClick={() => {
                  handlerandomise();
                }}
              >
                <FaRotate className="text-xs" />
                Again!
              </button>
            </div>
            <button
              className="p-2 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 rounded transition-colors duration-200"
              onClick={openSettings}
              title="Settings"
            >
              <FaGear className="text-terracotta-500 hover:text-terracotta-600 text-sm" />
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}

export default Randomiser;
