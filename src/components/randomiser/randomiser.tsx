import * as React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import SlotMachine from "./slotMachine";
import RandomiserSettings from "./RandomiserSettings";
import { useModal } from "../../contexts/ModalContext";
// import  sound from './yay.mp3';

// Removed Chakra UI imports

let actual_choices: any[];

const sound = require("./yay.mp3");
let yay = new Audio(sound);

interface RandomiserProps {
  toggleConfetti: (value: boolean) => void;
  savedState?: {
    input: string;
    choices: any[];
  };
  onStateChange?: (state: any) => void;
}

function Randomiser({ toggleConfetti, savedState, onStateChange }: RandomiserProps) {
  const initialResultFocus = React.useRef(null);
  const [result, setResult] = useState("Enter a list to randomise!");
  const [input, setInput] = useState(savedState?.input || "");
  const [choices, setChoices] = useState<any[]>(savedState?.choices || []);

  const [remember, setRemember] = useState(false);
  const [pressedDisable, setpressedDisable] = useState(false);
  const [selected, setSelected] = useState<any[]>([]);

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
          input={input}
          setInput={setInput}
          setChoices={setChoices}
          setSelected={setSelected}
          remember={remember}
          setRemember={setRemember}
          selected={selected}
          animation={animation}
          setAnimation={setAnimation}
          animationspeed={animationspeed}
          setAnimationspeed={setAnimationspeed}
        />
      ),
      className: "bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-xl max-w-2xl"
    });
  };
  // const {
  //   isOpen: isresultOpen,
  //   onOpen: onresultOpen,
  //   onClose: onresultClose,
  // } = useDisclosure();

  const [animation, setAnimation] = useState(true);
  const [animationspeed, setAnimationspeed] = useState(0.04);
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);

  const [loading, setLoading] = useState(false);

  // Notify parent of state changes
  const updateState = () => {
    if (onStateChange) {
      onStateChange({
        input: input,
        choices: choices
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
    console.log("what");

    setpressedDisable(false);
    toggleConfetti(false);
    yay.pause();
    yay.currentTime = 0;

    if (choices.length !== 0) {
      setLoading(true);
      // localStorage.setItem("input", input);
      actual_choices = choices;

      actual_choices = actual_choices.filter((choice) => {
        if (!!~selected.indexOf(choice)) {
          return;
        } else {
          return choice;
        }
      });
      if (actual_choices.length === 0) {
        setLoading(false);
        alert(
          "All entries in the list have been chosen once! Please edit the list or your settings! "
        );
        openSettings();
      }

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

  

  useEffect(() => {
    if (input === "") {
      // This is on initialisation thus no modification should happen
      return;
    }
    if (selected.length != 0) {
      setSelected([]);
    }
    if (buttonsettings === "result") {
      setButtonSettings("normal");
    }
    let temporarychoices = input.split("\n");
    temporarychoices = temporarychoices.map((value) => value.trim()); // remove leading and trailing spaces
    temporarychoices = temporarychoices.filter((value, index, array) => {
      if (value === "") {
        // there are only spaces in that line, dont return
        // console.log(value);
      } else {
        if (array.indexOf(value) !== index) {
          // prevents duplicates, dont return if value exists in array
          // console.log(value);
        } else {
          return value;
        }
      }
    });
    setChoices(temporarychoices);
  }, [input]);

  // Slot machine animation effect
  useEffect(() => {
    if (loading === true) {
      // Select a random index from actual_choices
      const randomIndex = Math.floor(Math.random() * actual_choices.length);
      setSelectedItemIndex(randomIndex);
      setIsSpinning(true);
      
      // Duration based on animation settings - increased 3x
      const spinDuration = animation ? (animationspeed * 1000 * 90) : 1500;
      
      // Set result after spinning completes
      setTimeout(() => {
        const selectedItem = actual_choices[randomIndex];
        setResult(selectedItem);
        if (remember) {
          setSelected([...selected, selectedItem]);
        }
        actual_choices = [];
        setButtonSettings("result");
        setLoading(false);
        setIsSpinning(false);
        toggleConfetti(true);
        yay.play();
      }, spinDuration);
    }
  }, [loading]);

  const textRef = useCallback((node) => {
    if (node !== null) {
      setTextheight(node.getBoundingClientRect().height);
      const resizeObserver = new ResizeObserver(() => {
        setTextheight(node.getBoundingClientRect().height);
        // console.log(node.getBoundingClientRect().height);
      });
      resizeObserver.observe(node);
    }
  }, []);

  const boxRef = useCallback((node) => {
    if (node !== null) {
      setBoxheight(node.getBoundingClientRect().height);
      const resizeObserver2 = new ResizeObserver(() => {
        setBoxheight(node.getBoundingClientRect().height);
        // console.log(node.getBoundingClientRect().height);
      });
      resizeObserver2.observe(node);
    }
  }, []);

  return (
    <>
      {/* {useConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={500} // Increase number of pieces
          gravity={0.3} // Adjust gravity for a slower fall
          wind={0.01} // Add a slight wind effect
          colors={["#FFC700", "#FF0000", "#2E3192", "#41BBC7"]} // Custom colors
          confettiSource={{ x: 0, y: 0, w: window.innerWidth, h: 0 }}
        />
      )} */}
      {/* <Rnd
        id="widget1big"
        default={{
          x: window.innerWidth / 2 - 200,
          y: window.innerHeight / 2 - 200,
          width: "400px",
          height: "400px",
        }}
        minWidth="125px"
        lockAspectRatio={true}
      > */}
      <div
        className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full flex flex-col"
        id="jason"
      >
        <div className="flex-1 overflow-hidden p-4">
          <button
            className="w-full h-full p-0 bg-warm-gray-100 dark:bg-warm-gray-700 hover:bg-warm-gray-200 dark:hover:bg-warm-gray-600 rounded transition-colors duration-200"
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
              {choices.length > 0 ? (
                <div className="w-full h-full flex items-center justify-center">
                  <SlotMachine
                    items={choices}
                    selectedIndex={selectedItemIndex}
                    isSpinning={isSpinning}
                    duration={animation ? (animationspeed * 1000 * 90) : 1500}
                  />
                </div>
              ) : (
                <div className="flex justify-center items-center w-[95%]">
                  <p
                    className="whitespace-normal break-words text-2xl text-center text-warm-gray-800 dark:text-warm-gray-200"
                    ref={textRef}
                  >
                    {result}
                  </p>
                </div>
              )}
            </div>
          </button>
        </div>
        {buttonsettings === "normal" ? (
          <div className="p-3 border-t border-warm-gray-200 dark:border-warm-gray-700 flex items-center">
            <button
              className="px-3 py-1.5 bg-sage-500 hover:bg-sage-600 dark:bg-sage-600 dark:hover:bg-sage-700 text-white text-sm rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={()=>handlerandomise()}
              disabled={loading}
            >
              Randomise!!
            </button>
          </div>
        ) : buttonsettings === "result" ? (
          <div className="p-3 border-t border-warm-gray-200 dark:border-warm-gray-700 flex items-center gap-2">
            <button
              className={`px-3 py-1.5 bg-terracotta-500 hover:bg-terracotta-600 dark:bg-terracotta-600 dark:hover:bg-terracotta-700 text-white text-sm rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${loading ? 'hidden' : ''}`}
              disabled={remember ? true : pressedDisable}
              onClick={() => {
                setSelected([...selected, result]);
                setpressedDisable(true);
              }}
            >
              {remember
                ? "Option removed"
                : pressedDisable
                ? "Option removed"
                : "Remove option"}
            </button>
            <button
              disabled={loading}
              ref={initialResultFocus}
              className="px-3 py-1.5 bg-sage-500 hover:bg-sage-600 dark:bg-sage-600 dark:hover:bg-sage-700 text-white text-sm rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => {
                handlerandomise();
              }}
            >
              Again!
            </button>
          </div>
        ) : null}
      </div>

      {/* <Modal
              initialFocusRef={initialResultFocus}
              onClose={onresultClose}
              isOpen={isresultOpen}
              isCentered
            >
              <ModalOverlay />
              <ModalContent>
                <ModalHeader>Result:</ModalHeader>
                <ModalCloseButton />
                <ModalBody maxHeight="300px" overflowY="auto">
                  <Card align="center">
                    <CardBody>
                      <Text
                        whiteSpace="normal"
                        wordBreak="break-word"
                        fontSize="6xl"
                      >
                        {result}
                      </Text>
                    </CardBody>
                  </Card>
                </ModalBody>
                <ModalFooter>
                  <HStack>
                    <Button
                      isDisabled={remember}
                      onClick={() => {
                        setSelected([...selected, result]);
                        onresultClose();
                      }}
                    >
                      {remember ? "Option removed" : "Remove option"}
                    </Button>
                    <Button
                      ref={initialResultFocus}
                      colorScheme="teal"
                      onClick={() => {
                        onresultClose();
                        handlerandomise();
                      }}
                    >
                      Again!
                    </Button>
                    <Button onClick={onresultClose} colorScheme="red">
                      Close
                    </Button>
                  </HStack>
                </ModalFooter>
              </ModalContent>
            </Modal> */}
      {/* </Rnd> */}
    </>
  );
}

export default Randomiser;
