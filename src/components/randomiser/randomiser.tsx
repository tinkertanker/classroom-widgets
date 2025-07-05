import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Rnd } from "react-rnd";
import SlotMachine from "./slotMachine.tsx";
import Confetti from "react-confetti";
// import  sound from './yay.mp3';

// Removed Chakra UI imports

let actual_choices: any[];

const sound = require("./yay.mp3");
let yay = new Audio(sound);
function Randomiser({ toggleConfetti }) {
  const initialFocus = React.useRef(null);
  const initialResultFocus = React.useRef(null);
  const [result, setResult] = useState("Enter a list to randomise!");
  const [input, setInput] = useState(/*localStorage.getItem("input") ??*/ ""); // if there is nothing in local storage then input is ""
  const [choices, setChoices] = useState<any[]>([]);

  const [remember, setRemember] = useState(false);
  const [pressedDisable, setpressedDisable] = useState(false);
  const [selected, setSelected] = useState<any[]>([]);
  const [clearedstorage, setClearedStorage] = useState(false);

  const [buttonsettings, setButtonSettings] = useState("normal");

  const [textheight, setTextheight] = useState(0);
  const [boxheight, setBoxheight] = useState(0);

  const [isOpen, setIsOpen] = useState(false);
  const onOpen = () => setIsOpen(true);
  const onClose = () => setIsOpen(false);
  const [tabIndex, setTabIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
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
        onOpen();
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
      {/* {useconfetti && (
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
        className="bg-soft-white rounded-lg shadow-sm border border-warm-gray-200 w-full h-full p-1"
        id="jason"
      >
        <div className="w-full h-full p-0">
          <div className="flex flex-col w-full h-full items-center">
            <button
              className="w-[87.5%] h-[75%] mt-[5%] mb-[2%] p-0 bg-warm-gray-100 hover:bg-warm-gray-200 rounded transition-colors duration-200"
              onClick={() => {
                if (loading === false) {
                  onOpen();
                }
              }}
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
                      className="whitespace-normal break-words text-2xl text-center text-warm-gray-800"
                      ref={textRef}
                    >
                      {result}
                    </p>
                  </div>
                )}
              </div>
            </button>
            {buttonsettings === "normal" ? (
              <div className="flex w-full justify-center mt-2 pb-3">
                <button
                  className="px-3 py-1.5 bg-sage-500 hover:bg-sage-600 text-white text-sm rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={()=>handlerandomise()}
                  disabled={loading}
                >
                  Randomise!!
                </button>
              </div>
            ) : buttonsettings === "result" ? (
              <div className="flex flex-row w-full justify-center gap-2 mt-2 pb-3">
                <button
                  className={`px-3 py-1.5 bg-terracotta-500 hover:bg-terracotta-600 text-white text-sm rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${loading ? 'hidden' : ''}`}
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
                  className="px-3 py-1.5 bg-sage-500 hover:bg-sage-600 text-white text-sm rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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

          {isOpen && (
            <>
              {/* Overlay */}
              <div
                className="fixed inset-0 bg-black bg-opacity-50 z-50"
                onClick={onClose}
              />
              {/* Modal Content */}
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-soft-white rounded-lg shadow-xl w-[450px] max-w-full" onClick={(e) => e.stopPropagation()}>
                  <div className="w-full">
                    <div className="px-6 py-4 border-b">
                      <div className="flex items-center">
                        <div className="flex space-x-4">
                          <button
                            className={`pb-2 border-b-2 text-sm ${tabIndex === 0 ? 'border-blue-500 text-blue-500' : 'border-transparent text-warm-gray-700'}`}
                            onClick={() => setTabIndex(0)}
                          >
                            List
                          </button>
                          <button
                            className={`pb-2 border-b-2 text-sm ${tabIndex === 1 ? 'border-blue-500 text-blue-500' : 'border-transparent text-warm-gray-700'}`}
                            onClick={() => setTabIndex(1)}
                          >
                            Settings
                          </button>
                        </div>
                        <button
                          onClick={onClose}
                          className="ml-auto text-warm-gray-500 hover:text-warm-gray-700"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="h-[500px] overflow-y-auto px-6 py-4">
                      {tabIndex === 0 ? (
                        <div className="flex flex-col space-y-4">
                          <div className="flex flex-row items-center justify-between pb-5">
                            <h3 className="text-base font-semibold text-warm-gray-800">My list</h3>
                            <div className="flex space-x-2">
                              <div className="relative">
                                <button
                                  className="px-3 py-1.5 bg-terracotta-500 hover:bg-terracotta-600 text-white text-sm rounded transition-colors duration-200 inline-flex items-center"
                                  onClick={() => setMenuOpen(!menuOpen)}
                                >
                                  Suggestions
                                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                                {menuOpen && (
                                  <div className="absolute mt-1 w-full bg-soft-white rounded-md shadow-lg z-10">
                                    <button
                                      className="w-full text-left px-4 py-2 hover:bg-warm-gray-100 text-warm-gray-800 text-sm"
                                      onClick={() => {
                                        setInput("1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15\n16\n17\n18\n19\n20\n21\n22\n23\n24\n25\n26\n27\n28\n29\n30");
                                        setMenuOpen(false);
                                      }}
                                    >
                                      Generate numbers 1 to 30
                                    </button>
                                    <button
                                      className="w-full text-left px-4 py-2 hover:bg-warm-gray-100 text-warm-gray-800 text-sm"
                                      onClick={() => {
                                        setInput("A\nB\nC\nD\nE\nF\nG\nH\nI\nJ\nK\nL\nM\nN\nO\nP\nQ\nR\nS\nT\nU\nV\nW\nX\nY\nZ");
                                        setMenuOpen(false);
                                      }}
                                    >
                                      Generate the alphabet
                                    </button>
                                  </div>
                                )}
                              </div>
                              <button
                                className="px-3 py-1.5 bg-dusty-rose-500 hover:bg-dusty-rose-600 text-white text-sm rounded transition-colors duration-200"
                                onClick={() => {
                                  setInput("");
                                  setChoices([]);
                                  setSelected([]);
                                }}
                              >
                                Clear list
                              </button>
                            </div>
                          </div>

                          <textarea
                            onChange={(e) => setInput(e.target.value)}
                            ref={initialFocus}
                            value={input}
                            id="textarea"
                            placeholder="Start typing a list to randomise..."
                            className="w-full h-[250px] px-3 py-2 border border-warm-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-warm-gray-800 text-sm placeholder-warm-gray-500"
                          />
                          <p className="pt-8 text-sm text-warm-gray-600">
                            Note: All leading and trailing spaces, empty rows, and
                            duplicates in the list are automatically removed when
                            generating.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-col items-start space-y-4">
                            <h3 className="text-base font-semibold text-warm-gray-800">Randomiser Settings</h3>

                          <label className="flex items-center pt-5">
                            <input
                              type="checkbox"
                              defaultChecked={remember}
                              onChange={(e) => {
                                setRemember(e.target.checked);
                                if (e.target.checked === false) {
                                  setSelected([]);
                                }
                              }}
                              className="mr-2 w-4 h-4 text-green-500 border-warm-gray-300 rounded focus:ring-green-500"
                            />
                            <span className="text-warm-gray-700 text-sm">Prevent picked options from repeating</span>
                          </label>
                          <p className="pt-2.5 pb-1.5 text-warm-gray-700 text-sm">
                            Options removed: {selected.join(", ")}
                          </p>
                        {/* <Button
                          colorScheme="red"
                          onClick={() => {
                            setClearedStorage(true);
                            localStorage.removeItem("input");
                          }}
                          width="40%"
                          marginTop="20px"
                          isDisabled={clearedstorage}
                        >
                          Clear saved list
                        </Button> */}
                        </div>
                        <div className="flex flex-col items-start space-y-4">
                          <h3 className="text-base font-semibold text-warm-gray-800">Animation Settings</h3>
                          <label className="flex items-center pt-2.5">
                            <input
                              type="checkbox"
                              defaultChecked={animation}
                              onChange={(e) => {
                                setAnimation(e.target.checked);
                              }}
                              className="mr-2 w-4 h-4 text-green-500 border-warm-gray-300 rounded focus:ring-green-500"
                            />
                            <span className="text-warm-gray-700 text-sm">Enable Animation</span>
                          </label>
                          <p className="pt-2.5 pb-1.5 text-warm-gray-700 text-sm">
                            Animation Duration
                          </p>
                          <div className="w-full relative pt-8">
                            <input
                              type="range"
                              disabled={!animation}
                              defaultValue={15}
                              min={5}
                              max={30}
                              onChange={(e) => setAnimationspeed(Number(e.target.value) / 300)}
                              className={`w-full h-2 bg-warm-gray-200 rounded-lg appearance-none cursor-pointer ${!animation ? 'opacity-50' : ''}`}
                            />
                            <div className="flex justify-between text-sm mt-2">
                              <span className="ml-[-12px] text-warm-gray-600">Short</span>
                              <span className="ml-[-24px] text-warm-gray-600">Medium</span>
                              <span className="ml-[-14px] text-warm-gray-600">Long</span>
                            </div>
                          </div>
                        {/* <Text paddingTop="40px" paddingBottom="5px">
                    Animation Speed
                  </Text>
                  <Slider
                    
                    isDisabled={!animation}
                    defaultValue={animationspeed * 100}
                    min={1}
                    max={11}
                    onChangeEnd={(val) => setAnimationspeed(val / 100)}
                  >
                    <SliderMark value={1} mt="2" ml="-3" fontSize="sm">
                      Fast
                    </SliderMark>
                    <SliderMark value={6} mt="2" ml="-6" fontSize="sm">
                      Medium
                    </SliderMark>
                    <SliderMark
                      value={11}
                      mt="2"
                      ml="-3.5"
                      fontSize="sm"
                    >
                      Slow
                    </SliderMark>
                    <SliderTrack>
                      <SliderFilledTrack />
                    </SliderTrack>
                    <SliderThumb />
                  </Slider> */}
                        </div>
                        </>
                      )}
                    </div>
                    <div className="px-6 py-3 border-t"></div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {/* </Rnd> */}
    </>
  );
}

export default Randomiser;
