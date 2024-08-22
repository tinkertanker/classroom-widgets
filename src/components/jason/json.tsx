import * as React from "react";
import { useState, useEffect } from "react";
import Transitions from "./transitions.tsx";

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

let newX = 0,
  newY = 0,
  startX = 0,
  startY = 0;
let temporarytime = 0;
let actual_choices: any[];

function Jason() {
  const initialFocus = React.useRef(null);
  const initialResultFocus = React.useRef(null);
  const [result, setResult] = useState("Type a list to randomise!");
  const [input, setInput] = useState("");
  const [choices, setChoices] = useState<any[]>([]);

  const [remember, setRemember] = useState(false);
  const [selected, setSelected] = useState<any[]>([]);

  const [open, setOpen] = useState(true);
  const [cardx, setCardx] = useState(window.innerWidth / 2 - 200);
  const [cardy, setCardy] = useState(window.innerHeight / 2 - 200);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isresultOpen,
    onOpen: onresultOpen,
    onClose: onresultClose,
  } = useDisclosure();

  const [animation, setAnimation] = useState(true);
  const [animationtracker, setAnimationtracker] = useState(0);
  const [animationcount, setAnimationcount] = useState(20);
  const [animationspeed, setAnimationspeed] = useState(0.04);
  const [slowanimation, setSlowanimation] = useState(0);
  const [animationtransition, setAnimationtransition] = useState("SlideFade");

  const [loading, setLoading] = useState(false);

  const handlerandomise = () => {
    if (choices.length != 0) {
      setLoading(true);
      actual_choices = choices;

      actual_choices = actual_choices.filter((choice) => {
        if (selected.includes(choice)) {
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
      setResult("Nothing to randomise!");
      setInput("");
      setChoices([]);
      onOpen();
      setTimeout(function () {
        setResult("Type a list to randomise!");
      }, 2000);
    }
  };

  let thiscard;

  function mouseDown(e) {
    thiscard = document.getElementById("random");

    startX = e.clientX;
    startY = e.clientY;

    document.addEventListener("mousemove", mouseMove);
    document.addEventListener("mouseup", mouseUp);
  }
  function mouseMove(e) {
    newX = startX - e.clientX;
    newY = startY - e.clientY;

    startX = e.clientX;
    startY = e.clientY;

    setCardx(thiscard.offsetLeft - newX);
    setCardy(thiscard.offsetTop - newY);

    unFocus();
  }
  function mouseUp() {
    document.removeEventListener("mousemove", mouseMove);
  }

  let unFocus = function () {
    if (window.getSelection()) {
      window.getSelection()!.empty();
    } else {
      window.getSelection()!.removeAllRanges();
    }
  };

  useEffect(() => {
    if (input == "") {
      // This is on initialisation thus no modification should happen
      return;
    }
    setSelected([]);
    let temporarychoices = input.split("\n");
    temporarychoices = temporarychoices.filter((value, index, array) => {
      // remove leading and trailing spaces
      value = value.trim();

      if (value == "") {
        // there are only spaces in that line, dont return
        console.log(value + " just space");
      } else {
        if (array.indexOf(value) !== index) {
          // prevents duplicates, dont return
          console.log(value + " duplicate");
        } else {
          return value;
        }
      }
    });
    console.log(temporarychoices);
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
            console.log(animationspeed + temporaryslowness);
          }, (animationspeed + temporaryslowness) * 1000);
        }, (animationspeed + slowanimation) * 2 * 1000);
      } else if (animationtracker == animationcount) {
        console.log(animationspeed, slowanimation);
        // let closedelaytime = 0.02;
        // let opendelaytime = 20;
        // if (animation) {
        //   closedelaytime = animationspeed;
        //   opendelaytime = 500;
        // }
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
              setLoading(false);
              setTimeout(
                function () {
                  onresultOpen();
                },
                animation ? 300 : 0
              );
            },
            animation ? 500 : 20
          );
        }, (animation ? animationspeed : 0.02 + slowanimation) * 2 * 1000);
      }
    }
  }, [animationtracker, loading]);

  return (
    <ChakraProvider>
      <Card
        size="lg"
        width="400px"
        height="400px"
        position="fixed"
        id="random"
        onMouseDown={mouseDown}
        top={cardy + "px"}
        left={cardx + "px"}
      >
        <CardBody>
          <VStack>
            <Button width="350px" height="300px" onClick={()=>{if(loading==false){onOpen()}}}>
              {/* <SlideFade
                in={open}
                offsetY="20px"
                transition={{
                  exit: { duration: animationspeed + slowanimation },
                  enter: { duration: animationspeed + slowanimation },
                }}
              >
                <Text>{result}</Text>
              </SlideFade> */}
              <Transitions
                choice={animationtransition}
                open={open}
                animationspeed={animationspeed}
                slowanimation={slowanimation}
              >
                <Box
                  height="300px"
                  width="350px"
                  overflowY="auto"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Box
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    width="330px"
                  >
                    <Text
                      whiteSpace="normal"
                      wordBreak="break-word"
                      fontSize="2xl"
                      textAlign="left"
                    >
                      {result}
                    </Text>
                  </Box>
                </Box>
              </Transitions>
            </Button>
            <Button
              colorScheme="teal"
              size="lg"
              onClick={handlerandomise}
              isLoading={loading}
            >
              Randomise!!
            </Button>
            <Modal
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
                    <Button ref={initialResultFocus} colorScheme='teal'
                      onClick={() => {
                        onresultClose();
                        handlerandomise();
                      }}
                    >
                      Again!
                    </Button>
                    <Button onClick={onresultClose} colorScheme='red'>Close</Button>
                  </HStack>
                </ModalFooter>
              </ModalContent>
            </Modal>
            <Modal
              isOpen={isOpen}
              onClose={onClose}
              initialFocusRef={initialFocus}
              isCentered
            >
              <ModalOverlay />
              <ModalContent>
                <Tabs>
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
                  <ModalBody h="450px" overflowY="auto">
                    <TabPanels>
                      <TabPanel>
                        <VStack>
                          <HStack paddingBottom="20px">
                            <Heading size="md">
                              My list
                            </Heading>

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
                            height="200px"
                          ></Textarea>
                          <Text
                            paddingTop="30px"
                            fontSize="md"
                            
                          >
                            Note: All leading and trailing spaces, empty rows,
                            and duplicates in the list are automatically removed
                            when generating.
                          </Text>
                        </VStack>
                      </TabPanel>
                      <TabPanel>
                        <VStack
                          align="left"
                          paddingBottom="50px"
                         
                        >
                          <Heading size="md">Randomiser Settings</Heading>
                          <Checkbox
                            colorScheme="green"
                            defaultChecked={remember}
                            paddingTop="10px"
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
                        </VStack>
                        <VStack align="left" >
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
                              console.log(e);
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
          </VStack>
        </CardBody>
      </Card>
    </ChakraProvider>
  );
}

export default Jason;
