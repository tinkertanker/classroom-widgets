import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Rnd } from "react-rnd";
import Transitions from "./transitions.tsx";
import Confetti from "react-confetti";
// import  sound from './yay.mp3';

// Removed Chakra UI imports

let temporarytime = 0;
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

  const [open, setOpen] = useState(true);
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
  const [animationtracker, setAnimationtracker] = useState(0);
  const [animationcount, setAnimationcount] = useState(30);
  const [animationspeed, setAnimationspeed] = useState(0.04);
  const [slowanimation, setSlowanimation] = useState(0);
  const [animationtransition, setAnimationtransition] = useState("ScaleFade");

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

      setAnimationtracker(0);
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

  // Recursive use effect that acts like a for loop and works, normal for loop doesnt work cause setInterval is async
  useEffect(() => {
    if (loading === true) {
      if (animationtracker < animationcount) {
        setTimeout(() => {
          let temporaryslowness = 0;
          if (animationtracker > animationcount * 0.6) {
            temporaryslowness = slowanimation + 0.01;
          }
          setSlowanimation(temporaryslowness);
          setOpen(false);
          setTimeout(() => {
            setResult(actual_choices[animationtracker % actual_choices.length]);
            setOpen(true);
            setAnimationtracker(animationtracker + 1);
          }, (animationspeed + temporaryslowness) * 1000);
        }, (animationspeed + slowanimation) * 2 * 1000);
      } else if (animationtracker === animationcount) {
        setTimeout(function () {
          setOpen(false);
          setTimeout(
            function () {
              let placeholder =
                actual_choices[
                  Math.floor(Math.random() * actual_choices.length)
                ];
              setResult(placeholder);
              if (remember) {
                setSelected([...selected, placeholder]);
              }
              setOpen(true);
              setSlowanimation(0);
              actual_choices = [];
              setButtonSettings("result");
              setLoading(false);
              toggleConfetti(true); // Start confetti
              // setUseconfetti(true)
              yay.play();

              // setTimeout(
              //   function () {
              //     // onresultOpen();
              //     setUseconfetti(false);
              //   },
              //   3000
              // );
            },
            animation ? 500 : 20
          );
        }, (animation ? animationspeed : 0.02 + slowanimation) * 2 * 1000);
      }
    }
  }, [animationtracker, loading]);

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

  // I dont know why this works but it fixes a problem with the animation in swapy so dont touch it
  useEffect(() => {
    setAnimationtransition("SlideFade");
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
        className="bg-white rounded-lg shadow-md w-full h-full p-1"
        id="jason"
      >
        <div className="w-full h-full p-0">
          <div className="flex flex-col w-full h-full">
            <button
              className="w-[87.5%] h-[75%] mt-[5%] mb-[2%] p-0 bg-gray-100 hover:bg-gray-200 rounded transition-colors duration-200"
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
                <div
                  className="flex justify-center items-center w-[95%]"
                >
                  <Transitions
                    choice={animationtransition}
                    open={open}
                    animationspeed={animationspeed}
                    slowanimation={slowanimation}
                  >
                    <p
                      className="whitespace-normal break-words text-2xl text-center text-gray-800"
                      ref={textRef}
                    >
                      {result}
                    </p>
                  </Transitions>
                </div>
              </div>
            </button>
            {buttonsettings === "normal" ? (
              <button
                className="w-[37.5%] h-[13%] p-0 bg-teal-500 hover:bg-teal-600 text-white rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={()=>handlerandomise()}
                disabled={loading}
              >
                <span className="text-sm"> Randomise!!</span>
              </button>
            ) : buttonsettings === "result" ? (
              <div className="flex flex-row w-full h-[13%] justify-center gap-2">
                <button
                  className={`w-[35%] h-full p-0 bg-yellow-500 hover:bg-yellow-600 text-white rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${loading ? 'hidden' : ''}`}
                  disabled={remember ? true : pressedDisable}
                  onClick={() => {
                    setSelected([...selected, result]);
                    setpressedDisable(true);
                  }}
                >
                  <span className="text-sm">
                    {remember
                      ? "Option removed"
                      : pressedDisable
                      ? "Option removed"
                      : "Remove option"}
                  </span>
                </button>
                <button
                  disabled={loading}
                  ref={initialResultFocus}
                  className="w-[35%] h-full bg-teal-500 hover:bg-teal-600 text-white rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => {
                    handlerandomise();
                  }}
                >
                  <span className="text-sm">Again!</span>
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
                <div className="bg-white rounded-lg shadow-xl w-[450px] max-w-full" onClick={(e) => e.stopPropagation()}>
                  <div className="w-full">
                    <div className="px-6 py-4 border-b">
                      <div className="flex items-center">
                        <div className="flex space-x-4">
                          <button
                            className={`pb-2 border-b-2 text-sm ${tabIndex === 0 ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-700'}`}
                            onClick={() => setTabIndex(0)}
                          >
                            List
                          </button>
                          <button
                            className={`pb-2 border-b-2 text-sm ${tabIndex === 1 ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-700'}`}
                            onClick={() => setTabIndex(1)}
                          >
                            Settings
                          </button>
                        </div>
                        <button
                          onClick={onClose}
                          className="ml-auto text-gray-500 hover:text-gray-700"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="h-[500px] overflow-y-auto px-6 py-4">
                      {tabIndex === 0 ? (
                        <div className="flex flex-col space-y-4">
                          <div className="flex flex-row items-center justify-between pb-5">
                            <h3 className="text-base font-semibold text-gray-800">My list</h3>
                            <div className="flex space-x-2">
                              <div className="relative">
                                <button
                                  className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white text-sm rounded transition-colors duration-200 flex items-center"
                                  onClick={() => setMenuOpen(!menuOpen)}
                                >
                                  Suggestions
                                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                                {menuOpen && (
                                  <div className="absolute mt-1 w-full bg-white rounded-md shadow-lg z-10">
                                    <button
                                      className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-800 text-sm"
                                      onClick={() => {
                                        setInput("1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15\n16\n17\n18\n19\n20\n21\n22\n23\n24\n25\n26\n27\n28\n29\n30");
                                        setMenuOpen(false);
                                      }}
                                    >
                                      Generate numbers 1 to 30
                                    </button>
                                    <button
                                      className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-800 text-sm"
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
                                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm rounded transition-colors duration-200"
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
                            className="w-full h-[250px] px-3 py-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-sm placeholder-gray-500"
                          />
                          <p className="pt-8 text-sm text-gray-600">
                            Note: All leading and trailing spaces, empty rows, and
                            duplicates in the list are automatically removed when
                            generating.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-col items-start space-y-4">
                            <h3 className="text-base font-semibold text-gray-800">Randomiser Settings</h3>

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
                              className="mr-2 w-4 h-4 text-green-500 border-gray-300 rounded focus:ring-green-500"
                            />
                            <span className="text-gray-700 text-sm">Prevent picked options from repeating</span>
                          </label>
                          <p className="pt-2.5 pb-1.5 text-gray-700 text-sm">
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
                          <h3 className="text-base font-semibold text-gray-800">Animation Settings</h3>
                          <label className="flex items-center pt-2.5">
                            <input
                              type="checkbox"
                              defaultChecked={animation}
                              onChange={(e) => {
                                setAnimation(e.target.checked);
                                if (e.target.checked === false) {
                                  temporarytime = animationcount;
                                  setAnimationcount(0);
                                } else {
                                  setAnimationcount(temporarytime);
                                }
                              }}
                              className="mr-2 w-4 h-4 text-green-500 border-gray-300 rounded focus:ring-green-500"
                            />
                            <span className="text-gray-700 text-sm">Enable Animation</span>
                          </label>
                          <p className="pt-2.5 pb-1.5 text-gray-700 text-sm">
                            Animation Type
                          </p>
                          <div className="flex flex-row space-x-4">
                            <label className={`flex items-center ${!animation ? 'opacity-50' : ''}`}>
                              <input
                                type="radio"
                                name="animationType"
                                value="Fade"
                                checked={animationtransition === "Fade"}
                                onChange={(e) => setAnimationtransition(e.target.value)}
                                disabled={!animation}
                                className="mr-2"
                              />
                              <span className="text-gray-700 text-sm">Fade</span>
                            </label>
                            <label className={`flex items-center ${!animation ? 'opacity-50' : ''}`}>
                              <input
                                type="radio"
                                name="animationType"
                                value="ScaleFade"
                                checked={animationtransition === "ScaleFade"}
                                onChange={(e) => setAnimationtransition(e.target.value)}
                                disabled={!animation}
                                className="mr-2"
                              />
                              <span className="text-gray-700 text-sm">ScaleFade</span>
                            </label>
                            <label className={`flex items-center ${!animation ? 'opacity-50' : ''}`}>
                              <input
                                type="radio"
                                name="animationType"
                                value="SlideFade"
                                checked={animationtransition === "SlideFade"}
                                onChange={(e) => setAnimationtransition(e.target.value)}
                                disabled={!animation}
                                className="mr-2"
                              />
                              <span className="text-gray-700 text-sm">SlideFade</span>
                            </label>
                          </div>
                          <p className="pt-2.5 pb-1.5 text-gray-700 text-sm">
                            Animation Duration
                          </p>
                          <div className="w-full relative pt-8">
                            <input
                              type="range"
                              disabled={!animation}
                              defaultValue={animation ? animationcount : temporarytime}
                              min={0}
                              max={30}
                              onChange={(e) => setAnimationcount(Number(e.target.value))}
                              className={`w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer ${!animation ? 'opacity-50' : ''}`}
                            />
                            <div className="flex justify-between text-sm mt-2">
                              <span className="ml-[-12px] text-gray-600">Short</span>
                              <span className="ml-[-24px] text-gray-600">Medium</span>
                              <span className="ml-[-14px] text-gray-600">Long</span>
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
