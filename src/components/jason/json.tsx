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
import { Fade, ScaleFade, Slide, SlideFade, Collapse } from "@chakra-ui/react";
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
let actualresult = false;
let temporaryslider = 0;

function Jason() {
  const initialFocus = React.useRef(null);
  const [result, setResult] = useState("Type a list to randomise!");
  const [input, setInput] = useState("");
  const [choices, setChoices] = useState<any[]>([""]);
  const [selected, setSelected] = useState<any[]>([]);
  const [open, setOpen] = useState(true);
  const [cardx, setCardx] = useState(window.innerWidth / 2 - 200);
  const [cardy, setCardy] = useState(window.innerHeight / 2 - 200);

  const { isOpen, onOpen, onClose } = useDisclosure();

  const [animation, setAnimation] = useState(true);
  const [animationtime, setAnimationtime] = useState(15);

  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    setLoading(true);
    console.log(choices[0]);
    if (choices[0] != "") {
      for (let j = 0; j < animationtime; j++) {
        setTimeout(function () {
          setOpen(false);
          setTimeout(function () {
            // Because j exceeds choices.length
            setResult(choices[j % choices.length]);
            setOpen(true);
            console.log(choices[j % choices.length]);
          }, 50);
        }, 100 * j);
      }
      setTimeout(function () {
        setOpen(false);
        setTimeout(function () {
          let placeholder = choices[Math.floor(Math.random() * choices.length)];
          setResult(placeholder);
          setSelected([...selected, placeholder]);
          setOpen(true);
          setLoading(false);
        }, 500);
      }, 100 * animationtime);
    } else {
      setResult("Nothing to randomise!");
      onOpen();
      setLoading(false);
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

    console.log(thiscard.offsetLeft - newX, thiscard.offsetTop - newY);
    console.log({ startX, startY });
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
    setChoices(input.split("\n"));
  }, [input]);



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
              <SlideFade
                in={open}
                offsetY="20px"
                transition={{
                  exit: { duration: 0.05 },
                  enter: { duration: 0.05 },
                }}
              >
                <Text>{result}</Text>
              </SlideFade>
            </Button>
            <Button
              colorScheme="teal"
              size="lg"
              onClick={handleClick}
              id="randomise"
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
                        <HStack spacing="160px" paddingBottom="30px">
                          <Heading size="md">My list</Heading>
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
                          placeholder="Start typing things to randomise..."
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
                              console.log(animation,animationtime,temporaryslider);
                              if (e.target.checked == false) {
                                temporaryslider = animationtime;
                                setAnimationtime(0);
                              } else {
                                setAnimationtime(temporaryslider);
                              }
                            }}
                          >
                            Enable Animation
                          </Checkbox>
                          <Text paddingTop="10px" paddingBottom="5px">
                            Animation Duration
                          </Text>
                          <Slider
                            isDisabled={!animation}
                            defaultValue={animation? animationtime:temporaryslider}
                            min={0}
                            max={30}
                            id='slider'
                            onChangeEnd={(val) => setAnimationtime(val)}
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
                        </VStack>
                        <VStack align="left">
                          <Heading size="md">Randomiser Settings</Heading>
                          <Checkbox
                            colorScheme="green"
                            defaultChecked
                            paddingTop="10px"
                          >
                            Remember chosen entries
                          </Checkbox>
                          <Text paddingTop="10px" paddingBottom="5px">
                            {selected}
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

// <Popover initialFocusRef={initialFocusRef} >
//     <>
//     <PopoverTrigger>
//         <Button width='300px' height='300px'>
//             <SlideFade in={open} offsetY='20px'>
//                 <Text>
//                     {result}
//                 </Text>
//             </SlideFade>
//         </Button>
//     </PopoverTrigger>

//     <Portal placement='top'>
//         <PopoverContent>
//             <PopoverArrow />
//             <PopoverHeader>Type the list of entries to randomise!</PopoverHeader>
//             <PopoverCloseButton />

//             <PopoverBody>
//                 <Textarea onChange={handleList} ref={initialFocusRef}></Textarea>
//             </PopoverBody>
//         </PopoverContent>
//     </Portal>
//     </>
// </Popover>
