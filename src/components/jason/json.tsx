import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Rnd } from "react-rnd";
import Transitions from "./transitions.tsx";
import Confetti from "react-confetti";
// import  sound from './yay.mp3';

import { ChakraProvider, useDisclosure } from "@chakra-ui/react";
import {
  Checkbox,
  Radio,
  RadioGroup,
  Box,
  Card,
  CardBody,
  VStack,
  HStack,
  Heading,
  Text,
  Textarea,
  Button,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  SliderMark,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from "@chakra-ui/react";
import { ChevronDownIcon } from "@chakra-ui/icons";

let temporarytime = 0;
let actual_choices: any[];

const sound = require("./yay.mp3");
let yay = new Audio(sound);
function Jason({ toggleConfetti }) {
  const initialFocus = React.useRef(null);
  const initialResultFocus = React.useRef(null);
  const [result, setResult] = useState("Enter a list to randomise!");
  const [input, setInput] = useState(localStorage.getItem("input") ?? ""); // if there is nothing in local storage then input is ""
  const [choices, setChoices] = useState<any[]>([]);

  const [remember, setRemember] = useState(false);
  const [pressedDisable, setpressedDisable] = useState(false);
  const [selected, setSelected] = useState<any[]>([]);
  const [clearedstorage, setClearedStorage] = useState(false);

  const [open, setOpen] = useState(true);
  const [buttonsettings, setButtonSettings] = useState("normal");

  const [textheight, setTextheight] = useState(0);
  const [boxheight, setBoxheight] = useState(0);

  const { isOpen, onOpen, onClose } = useDisclosure();
  // const {
  //   isOpen: isresultOpen,
  //   onOpen: onresultOpen,
  //   onClose: onresultClose,
  // } = useDisclosure();

  const [animation, setAnimation] = useState(true);
  const [animationtracker, setAnimationtracker] = useState(0);
  const [animationcount, setAnimationcount] = useState(20);
  const [animationspeed, setAnimationspeed] = useState(0.04);
  const [slowanimation, setSlowanimation] = useState(0);
  const [animationtransition, setAnimationtransition] = useState("ScaleFade");
  const [useconfetti, setUseconfetti] = useState(false);

  const [loading, setLoading] = useState(false);

  const handlerandomise = () => {

    setClearedStorage(false);

    setpressedDisable(false);
    toggleConfetti(false);
    yay.pause();
    yay.currentTime = 0;

    if (choices.length != 0) {
      setLoading(true);
      localStorage.setItem("input", input);
      actual_choices = choices;

      actual_choices = actual_choices.filter((choice) => {
        if (!!~selected.indexOf(choice)) {
          return;
        } else {
          return choice;
        }
      });
      if (actual_choices.length == 0) {
        setLoading(false);
        alert(
          "All entries in the list have been chosen once! Please edit the list or your settings! "
        );
        onOpen();
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

  function Displaybuttons({ buttonsettings }) {
    switch (buttonsettings) {
      case "normal":
        return (
          <Button
            colorScheme="teal"
            width="37.5%"
            height="12.5%"
            padding="0"
            onClick={handlerandomise}
            isDisabled={loading}
          >
            <Text fontSize="1.1em"> Randomise!!</Text>
          </Button>
        );
      case "result":
        return (
          <HStack width="100%" height="12.5%" justifyContent="center">
            <Button
              hidden={loading}
              isDisabled={remember ? true : pressedDisable}
              colorScheme="yellow"
              width="35%"
              height="100%"
              padding="0"
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
            </Button>
            <Button
              isDisabled={loading}
              ref={initialResultFocus}
              colorScheme="teal"
              width="35%"
              height="100%"
              onClick={() => {
                handlerandomise();
              }}
            >
              Again!
            </Button>
          </HStack>
        );
    }
  }

  useEffect(() => {
    if (input == "") {
      // This is on initialisation thus no modification should happen
      return;
    }
    if (selected.length != 0) {
      setSelected([]);
    }
    if (buttonsettings == "result") {
      setButtonSettings("normal");
    }
    let temporarychoices = input.split("\n");
    temporarychoices = temporarychoices.map((value) => value.trim()); // remove leading and trailing spaces
    temporarychoices = temporarychoices.filter((value, index, array) => {
      if (value == "") {
        // there are only spaces in that line, dont return
        console.log(value);
      } else {
        if (array.indexOf(value) !== index) {
          // prevents duplicates, dont return if value exists in array
          console.log(value);
        } else {
          return value;
        }
      }
    });
    setChoices(temporarychoices);
  }, [input]);

  // Recursive use effect that acts like a for loop and works, normal for loop doesnt work cause setInterval is async
  useEffect(() => {
    if (loading == true) {
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
      } else if (animationtracker == animationcount) {
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
        console.log(node.getBoundingClientRect().height);
      });
      resizeObserver.observe(node);
    }
  }, []);

  const boxRef = useCallback((node) => {
    if (node !== null) {
      setBoxheight(node.getBoundingClientRect().height);
      const resizeObserver2 = new ResizeObserver(() => {
        setBoxheight(node.getBoundingClientRect().height);
        console.log(node.getBoundingClientRect().height);
      });
      resizeObserver2.observe(node);
    }
  }, []);

  useEffect(()=>{
    setAnimationtransition("SlideFade")
  },[])
  return (
    <ChakraProvider>
      {/* {useconfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={500} // Increase number of pieces
          gravity={0.3} // Adjust gravity for a slower fall
          wind={0.01} // Add a slight wind effect
          colors={["#FFC700", "#FF0000", "#2E3192", "#41BBC7"]} // Custom colors
          confettiSource={{x: 0, y: 0, w: window.innerWidth, h:0}}
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
        <Card
          width="400px"
          height="400px"
          id='jason'
          padding='3px'
          // width='100%'
          // height='100%'


          // position="fixed"
          // onMouseDown={mouseDown}
          // top={cardy + "px"}
          // left={cardx + "px"}
        >
          <CardBody width="100%" height="100%" padding="0">
            <VStack width="100%" height="100%">
              <Button
                width="87.5%"
                height="75%"
                marginTop="5%"
                marginBottom="2%"
                padding="0"
                onClick={() => {
                  if (loading == false) {
                    onOpen();
                  }
                }}
              >
                {/* Super duper cool functionality here, if the height of the text is greater than box height then the text will align top, if not the text will align center, this is for use cases when the text is super long or when the box is resized */}
                <Box
                  ref={boxRef}
                  height="100%"
                  width="100%"
                  overflowY="auto"
                  display="flex"
                  alignItems={textheight > boxheight ? "start" : "center"}
                  justifyContent="center"
                >
                  <Box
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    width="95%"
                  >
                    <Transitions
                      choice={animationtransition}
                      open={open}
                      animationspeed={animationspeed}
                      slowanimation={slowanimation}
                    >
                      <Text
                        whiteSpace="normal"
                        wordBreak="break-word"
                        fontSize="2xl"
                        textAlign="center"
                        ref={textRef}
                      >
                        {result}
                      </Text>
                    </Transitions>
                  </Box>
                </Box>
              </Button>
              <Displaybuttons buttonsettings={buttonsettings}></Displaybuttons>
              {/* <Button
                colorScheme="teal"
                width="37.5%"
                height="12.5%"
                padding="0"
                onClick={handlerandomise}
                isLoading={loading}
              >
                <Text fontSize="1.1em"> Randomise!!</Text>
              </Button> */}
            </VStack>

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
            <Modal
              isOpen={isOpen}
              onClose={onClose}
              initialFocusRef={initialFocus}
              isCentered
            >
              <ModalOverlay />
              <ModalContent>
                <Tabs w='450px'>
                  <ModalHeader>
                    <HStack align="center">
                      <TabList>
                        <Tab marginBottom="0px">List</Tab>
                        <Tab marginBottom="0px">Settings</Tab>
                      </TabList>
                      <ModalCloseButton
                        position="static"
                        marginLeft="220px"
                        size="md"
                        marginTop="1px"
                      />
                    </HStack>
                  </ModalHeader>
                  <ModalBody h="500px" overflowY="auto">
                    <TabPanels>
                      <TabPanel>
                        <VStack>
                          <HStack paddingBottom="20px">
                            <Heading size="md">My list</Heading>

                            <Menu>
                              <MenuButton
                                marginLeft="45px"
                                as={Button}
                                rightIcon={<ChevronDownIcon />}
                                colorScheme="yellow"
                              >
                                Suggestions
                              </MenuButton>
                              <MenuList>
                                <MenuItem
                                  onClick={() =>
                                    setInput(
                                      "1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15\n16\n17\n18\n19\n20\n21\n22\n23\n24\n25\n26\n27\n28\n29\n30"
                                    )
                                  }
                                >
                                  Generate numbers 1 to 30
                                </MenuItem>
                                <MenuItem
                                  onClick={() =>
                                    setInput(
                                      "A\nB\nC\nD\nE\nF\nG\nH\nI\nJ\nK\nL\nM\nN\nO\nP\nQ\nR\nS\nT\nU\nV\nW\nX\nY\nZ"
                                    )
                                  }
                                >
                                  Generate the alphabet
                                </MenuItem>
                              </MenuList>
                            </Menu>
                            <Button
                              colorScheme="red"
                              size="md"
                              onClick={() => {
                                setInput("");
                                setChoices([]);
                                setSelected([]);
                              }}
                            >
                              Clear list
                            </Button>
                          </HStack>

                          <Textarea
                            onChange={(e) => setInput(e.target.value)}
                            ref={initialFocus}
                            resize="none"
                            value={input}
                            id="textarea"
                            placeholder="Start typing a list to randomise..."
                            height="250px"
                          ></Textarea>
                          <Text paddingTop="30px" fontSize="md">
                            Note: All leading and trailing spaces, empty rows,
                            and duplicates in the list are automatically removed
                            when generating.
                          </Text>
                        </VStack>
                      </TabPanel>
                      <TabPanel>
                        <VStack align="left" paddingBottom="20px">
                          <Heading size="md">Randomiser Settings</Heading>

                          <Checkbox
                            colorScheme="green"
                            defaultChecked={remember}
                            paddingTop="20px"
                            onChange={(e) => {
                              setRemember(e.target.checked);
                              if (e.target.checked === false) {
                                setSelected([]);
                              }
                            }}
                          >
                            Prevent picked options from repeating
                          </Checkbox>
                          <Text paddingTop="10px" paddingBottom="5px">
                            Options removed: {selected.join(", ")}
                          </Text>
                          <Button
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
                          </Button>
                        </VStack>
                        <VStack align="left">
                          <Heading size="md">Animation Settings</Heading>
                          <Checkbox
                            colorScheme="green"
                            defaultChecked={animation}
                            paddingTop="10px"
                            onChange={(e) => {
                              setAnimation(e.target.checked);
                              if (e.target.checked === false) {
                                temporarytime = animationcount;
                                setAnimationcount(0);
                              } else {
                                setAnimationcount(temporarytime);
                              }
                            }}
                          >
                            Enable Animation
                          </Checkbox>
                          <Text paddingTop="10px" paddingBottom="5px">
                            Animation Type
                          </Text>
                          <RadioGroup
                            isDisabled={!animation}
                            onChange={(e) => {
                              setAnimationtransition(e);
                            }}
                            value={animationtransition}
                          >
                            <HStack direction="row">
                              <Radio value="Fade">Fade</Radio>
                              <Radio value="ScaleFade">ScaleFade</Radio>
                              <Radio value="SlideFade">SlideFade</Radio>
                            </HStack>
                          </RadioGroup>
                          <Text paddingTop="10px" paddingBottom="5px">
                            Animation Duration
                          </Text>
                          <Slider
                            isDisabled={!animation}
                            defaultValue={
                              animation ? animationcount : temporarytime
                            }
                            min={0}
                            max={30}
                            onChangeEnd={(val) => setAnimationcount(val)}
                          >
                            <SliderMark value={0} mt="2" ml="-3" fontSize="sm">
                              Short
                            </SliderMark>
                            <SliderMark value={15} mt="2" ml="-6" fontSize="sm">
                              Medium
                            </SliderMark>
                            <SliderMark
                              value={30}
                              mt="2"
                              ml="-3.5"
                              fontSize="sm"
                            >
                              Long
                            </SliderMark>
                            <SliderTrack>
                              <SliderFilledTrack />
                            </SliderTrack>
                            <SliderThumb />
                          </Slider>
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
                        </VStack>
                      </TabPanel>
                    </TabPanels>
                  </ModalBody>
                  <ModalFooter
                    paddingTop="3px"
                    paddingBottom="3px"
                  ></ModalFooter>
                </Tabs>
              </ModalContent>
            </Modal>
          </CardBody>
        </Card>
      {/* </Rnd> */}
    </ChakraProvider>
  );
}

export default Jason;
