import {
  ChakraProvider,
  VStack,
  HStack,
  Heading,
  Checkbox,
  CheckboxGroup,
} from "@chakra-ui/react";
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Text,
  Button,
  Textarea,
} from "@chakra-ui/react";
import {
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  SliderMark,
} from "@chakra-ui/react";
import { Radio, RadioGroup } from "@chakra-ui/react";
import { Fade, ScaleFade, Slide, SlideFade, Collapse } from "@chakra-ui/react";
import Transitions from "./transitions.tsx";
import { useDisclosure } from "@chakra-ui/react";
import { useState, useEffect } from "react";
import * as React from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
} from "@chakra-ui/react";
import { Tabs, TabList, TabPanels, Tab, TabPanel } from "@chakra-ui/react";
import {
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuItemOption,
  MenuGroup,
  MenuOptionGroup,
  MenuDivider,
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
  const [result, setResult] = useState("Type a list to randomise!");
  const [input, setInput] = useState("");
  const [choices, setChoices] = useState<any[]>([]);

  const [remember, setRemember] = useState(true);
  const [selected, setSelected] = useState<any[]>([]);

  const [open, setOpen] = useState(true);
  const [cardx, setCardx] = useState(window.innerWidth / 2 - 200);
  const [cardy, setCardy] = useState(window.innerHeight / 2 - 200);

  const { isOpen, onOpen, onClose } = useDisclosure();

  const [animation, setAnimation] = useState(true);
  const [animationtracker, setAnimationtracker] = useState(0);
  const [animationcount, setAnimationcount] = useState(20);
  const [animationspeed, setAnimationspeed] = useState(0.06);
  const [slowanimation, setSlowanimation] = useState(0);
  const [animationtransition, setAnimationtransition] = useState("SlideFade");

  const [loading, setLoading] = useState(false);

  const handlerandomise = () => {
    if (choices.length != 0) {
      setLoading(true);
      actual_choices = choices;
      if (remember == true) {
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

  function validatechoices(choice) {
    if (choice == null) {
      // this is a new line thus should be ignored
    } else {
      return choice.trim();
    }
  }

  useEffect(() => {
    if (input == "") {
      // This is on initialisation thus no modification should happen
      return;
    }
    setSelected([]);
    let temporarychoices = input.split("\n");

    temporarychoices = temporarychoices.filter(validatechoices);

    setChoices(temporarychoices);
  }, [input]);

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
        let closedelaytime = 0.02;
        let opendelaytime = 20;
        if (animation) {
          closedelaytime = animationspeed;
          opendelaytime = 500;
        }
        setTimeout(function () {
          setOpen(false);
          setTimeout(function () {
            let placeholder =
              actual_choices[Math.floor(Math.random() * actual_choices.length)];
            setResult(placeholder);
            setSelected([...selected, placeholder]);
            setOpen(true);
            setSlowanimation(0);
            actual_choices = [];
            setLoading(false);
          }, opendelaytime);
        }, (closedelaytime + slowanimation) * 2 * 1000);
      }
    }
  }, [animationtracker, loading]);

  return (
    <ChakraProvider>
      <Card
        size="lg"
        colorScheme="pink"
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
            <Button width="300px" height="300px" onClick={onOpen}>
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
                <Text
                  maxWidth="300px"
                  whiteSpace="normal"
                  wordBreak="break-word"
                  fontSize="2xl"
                >
                  {result}
                </Text>
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
              isOpen={isOpen}
              onClose={onClose}
              initialFocusRef={initialFocus}
              isCentered
            >
              <ModalOverlay />
              <ModalContent>
                <Tabs>
                  <ModalHeader>
                    <HStack align="center" justify="left">
                      <TabList>
                        <Tab>List</Tab>
                        <Tab>Settings</Tab>
                      </TabList>
                      <ModalCloseButton />
                    </HStack>
                  </ModalHeader>
                  <ModalBody>
                    <TabPanels>
                      <TabPanel>
                        <HStack paddingBottom="30px">
                          <Heading size="md">My list</Heading>
                          <Button
                            marginLeft="45px"
                            colorScheme="teal"
                            size="md"
                            onClick={() => {
                              setInput("");
                              setChoices([]);
                              setSelected([]);
                            }}
                          >
                            Clear list
                          </Button>
                          <Menu>
                            <MenuButton
                              as={Button}
                              rightIcon={<ChevronDownIcon />}
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
                        </HStack>

                        <Textarea
                          onChange={(e) => setInput(e.target.value)}
                          ref={initialFocus}
                          resize="none"
                          value={input}
                          id="textarea"
                          placeholder="Start typing a list to randomise..."
                        ></Textarea>
                      </TabPanel>
                      <TabPanel>
                        <VStack align="left" paddingBottom="50px">
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
                          <Text paddingTop="40px" paddingBottom="5px">
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
                          </Slider>
                        </VStack>
                        <VStack align="left">
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
                            Avoid repeated results
                          </Checkbox>
                          <Text paddingTop="10px" paddingBottom="5px">
                            Results picked: {selected.join(", ")}
                          </Text>
                        </VStack>
                      </TabPanel>
                    </TabPanels>
                  </ModalBody>
                  <ModalFooter></ModalFooter>
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
