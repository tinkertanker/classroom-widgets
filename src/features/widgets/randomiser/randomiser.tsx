import * as React from "react";
import { useState, useEffect } from "react";
import SlotMachine from "./slotMachine";
import RandomiserSettings from "./RandomiserSettings";
import { useModal } from "../../../contexts/ModalContext";
import { useConfetti } from "../../../contexts/ConfettiContext";
import { RandomiserProps } from "./types";
import { FaDice, FaRotate, FaGear } from 'react-icons/fa6';
import celebrateSoundFile from "./celebrate.mp3";
import { 
  useChoiceManager, 
  useSlotMachineAnimation, 
  useRandomiserAudio, 
  useResponsiveHeight 
} from './hooks';

function Randomiser({ savedState, onStateChange }: RandomiserProps) {
  const initialResultFocus = React.useRef(null);
  const widgetRef = React.useRef<HTMLDivElement>(null);
  const [result, setResult] = useState("Enter a list to randomise!");
  const [buttonSettings, setButtonSettings] = useState("normal");

  // Use global modal and confetti
  const { showModal } = useModal();
  const { triggerConfetti } = useConfetti();

  // Choice management
  const {
    input,
    setInput,
    choices,
    removedChoices,
    processChoices,
    getActiveChoices,
    removeChoice,
    updateChoices,
    updateRemovedChoices
  } = useChoiceManager({
    initialInput: savedState?.input || "",
    initialChoices: savedState?.choices || [],
    initialRemovedChoices: [],
    onStateChange
  });

  // Slot machine animation
  const {
    selectedItemIndex,
    isSpinning,
    isLoading,
    displayChoices,
    startAnimation,
    resetAnimation,
    setDisplayChoices,
    setIsLoading
  } = useSlotMachineAnimation({
    onAnimationComplete: (selectedItem) => {
      setResult(selectedItem);
      setButtonSettings("result");
      triggerConfetti(widgetRef.current);
      playCelebration();
    }
  });

  // Audio management
  const { playCelebration, stopSound } = useRandomiserAudio({
    soundFile: celebrateSoundFile
  });

  // Responsive height calculations
  const { textHeight, boxHeight, textRef, boxRef, shouldAlignTop } = useResponsiveHeight();

  const openSettings = () => {
    showModal({
      title: "Randomiser Settings",
      content: (
        <RandomiserSettings
          choices={choices}
          removedChoices={removedChoices}
          onUpdateChoices={(newChoices) => {
            updateChoices(newChoices);
          }}
          onUpdateRemovedChoices={(newRemovedChoices) => {
            updateRemovedChoices(newRemovedChoices);
          }}
        />
      ),
      className: "bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-xl max-w-3xl",
      onClose: () => {
        // Update displayChoices to show items immediately if there are active choices
        const activeChoices = getActiveChoices();
        if (activeChoices.length > 0) {
          setDisplayChoices(activeChoices);
          // Reset animation state
          resetAnimation();
        } else {
          // Clear display choices if no active choices
          setDisplayChoices([]);
          setResult("Enter a list to randomise!");
        }
      }
    });
  };

  const handleRandomise = () => {
    stopSound();

    const processedChoices = processChoices(input);
    updateChoices(processedChoices);

    if (processedChoices.length !== 0) {
      // Filter out removed items
      const activeChoices = processedChoices.filter(choice => !removedChoices.includes(choice));

      if (activeChoices.length === 0) {
        alert("All items have been removed! Please restore some items or add new ones.");
        openSettings();
        return;
      }

      // Start the animation
      const animationData = startAnimation(activeChoices);
      if (animationData) {
        setIsLoading(true);
        setDisplayChoices(animationData.shuffledChoices);
      }
    } else {
      setResult("Nothing to randomise! Click me to enter a list to randomise!");
      setInput("");
      updateChoices([]);
      setTimeout(() => {
        setResult("Enter a list to randomise!");
      }, 2000);
    }
  };

  const handleRemoveResult = () => {
    if (result && !removedChoices.includes(result)) {
      const removalResult = removeChoice(result);
      if (removalResult) {
        // Update display choices
        if (removalResult.activeChoices.length > 0) {
          setDisplayChoices(removalResult.activeChoices);
        } else {
          setDisplayChoices([]);
          setResult("Enter a list to randomise!");
        }
        setButtonSettings("normal");
      }
    }
  };

  // Update result message when choices change
  useEffect(() => {
    if (choices.length > 0 && result === "Enter a list to randomise!") {
      setResult("Ready to randomise!");
    } else if (choices.length === 0 && result === "Ready to randomise!") {
      setResult("Enter a list to randomise!");
    }
  }, [choices, result]);

  return (
    <>
      <div
        ref={widgetRef}
        className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full flex flex-col relative"
        id="jason"
      >
        <div className="flex-1 overflow-hidden p-4">
          <div
            className={`w-full h-full p-0 rounded transition-colors duration-200 cursor-pointer ${
              displayChoices.length > 0 
                ? 'bg-transparent hover:bg-white/10' 
                : 'bg-warm-gray-100 dark:bg-warm-gray-700 hover:bg-warm-gray-200 dark:hover:bg-warm-gray-600'
            }`}
            onDoubleClick={() => {
              if (!isLoading) {
                openSettings();
              }
            }}
            title="Double-click to open settings"
          >
            <div
              ref={boxRef}
              className="h-full w-full overflow-y-auto flex justify-center"
              style={{
                alignItems: shouldAlignTop ? "start" : "center"
              }}
            >
              {displayChoices.length > 0 ? (
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
                      className="px-3 py-1.5 bg-terracotta-100 hover:bg-terracotta-200 dark:bg-terracotta-900/30 dark:hover:bg-terracotta-900/40 border-2 border-terracotta-500 dark:border-terracotta-400 text-terracotta-700 dark:text-terracotta-300 text-sm rounded transition-colors duration-200 flex items-center gap-1.5"
                      onClick={openSettings}
                    >
                      <FaGear className="text-xs" />
                      Settings
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {buttonSettings === "normal" ? (
          <div className="p-3 border-t border-warm-gray-200 dark:border-warm-gray-700 flex items-center justify-between">
            <button
              className="px-3 py-1.5 bg-sage-100 hover:bg-sage-200 dark:bg-sage-900/30 dark:hover:bg-sage-900/40 border-2 border-sage-500 dark:border-sage-400 text-sage-700 dark:text-sage-300 text-sm rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              onClick={handleRandomise}
              disabled={isLoading}
            >
              <FaDice className="text-xs" />
              Randomise!!
            </button>
            <button
              className="p-2 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 rounded transition-colors duration-200"
              onClick={openSettings}
              title="Settings"
            >
              <FaGear className="text-warm-gray-600 dark:text-warm-gray-400 hover:text-warm-gray-700 dark:hover:text-warm-gray-300 text-sm" />
            </button>
          </div>
        ) : buttonSettings === "result" ? (
          <div className="p-3 border-t border-warm-gray-200 dark:border-warm-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1.5 bg-dusty-rose-100 hover:bg-dusty-rose-200 dark:bg-dusty-rose-900/30 dark:hover:bg-dusty-rose-900/40 border-2 border-dusty-rose-500 dark:border-dusty-rose-400 text-dusty-rose-700 dark:text-dusty-rose-300 text-sm rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleRemoveResult}
                disabled={removedChoices.includes(result)}
              >
                {removedChoices.includes(result) ? "Already removed" : "Remove option"}
              </button>
              <button
                disabled={isLoading}
                ref={initialResultFocus}
                className="px-3 py-1.5 bg-sage-100 hover:bg-sage-200 dark:bg-sage-900/30 dark:hover:bg-sage-900/40 border-2 border-sage-500 dark:border-sage-400 text-sage-700 dark:text-sage-300 text-sm rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                onClick={handleRandomise}
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
              <FaGear className="text-warm-gray-600 dark:text-warm-gray-400 hover:text-warm-gray-700 dark:hover:text-warm-gray-300 text-sm" />
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}

export default Randomiser;