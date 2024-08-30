import "./App.css";
import Randomiser from "./components/randomiser/randomiser.tsx";
import Timer from "./components/timer/timer.tsx";
import List from "./components/list/list.tsx";
import Work from "./components/work/work.tsx";
import TrafficLight from "./components/trafficLight/trafficLight.tsx";
import AudioVolumeMonitor from "./components/volumeLevel/volumeLevel.tsx";
import ShortenLink from "./components/shortenLink/shortenLink.tsx";
import { useEffect, useState, useRef } from "react";
import { Rnd } from "react-rnd";
import { v4 as uuidv4 } from 'uuid'; // Import UUID package

import Confetti from "react-confetti";
import Time from "./components/clock/clock.tsx";
import {
  ChakraProvider,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  Button,
  Input,
  useDisclosure,
  PinInput,
  PinInputField,
  HStack,
  VStack,
  Text,
  IconButton,
  SimpleGrid,
  Heading,
  Box,
  Card,
  CardBody,
  Flex,
} from "@chakra-ui/react";
import { DeleteIcon, HamburgerIcon, Icon } from "@chakra-ui/icons";

function App() {
  const [useconfetti, setUseconfetti] = useState(false);
  const [useconfetti2, setUseconfetti2] = useState(false);
  const [componentList, setComponentList] = useState([]);
  const [activeIndex, setActiveIndex] = useState(null);
  const [generatedComponents, setGeneratedComponents] = useState([]);

  const Components = [
    <Randomiser toggleConfetti={setUseconfetti} />,
    <Timer />,
    <List toggleConfetti={setUseconfetti2} />,
    <Work />,
    <Time />,
    <TrafficLight />,
    <AudioVolumeMonitor />,
    <ShortenLink />,
  ];

  const ComponentNames = [
    "Randomiser",
    "Timer",
    "List",
    "Work Symbols",
    "Clock",
    "Traffic Light",
    "Loudness Monitor",
    "Link Shortener",
  ];

  function Toolbar() {
    return (
      <Card width="90%" height="100%">
        <CardBody width="100%" height="100%">
          <HStack alignItems="center" justifyContent="center" width="100%" height="100%">
            {ComponentNames.map((ComponentName, index) => (
              <Button
                key={index}
                onClick={() => {
                  setComponentList((e) => [
                    ...e,
                    { id: uuidv4(), index }
                  ]);
                }}
                colorScheme="teal"
                justifyContent={"center"}
              >
                {ComponentName}
              </Button>
            ))}
            <Text>{componentList.length}</Text>
            <Flex justifyContent="right">
              <DeleteIcon id="trash" />
            </Flex>
          </HStack>
        </CardBody>
      </Card>
    );
  }

  useEffect(() => {
    const components = componentList.map(({ id, index }) => (
      <Rnd
        default={{
          x: 0,
          y: 0,
          width: index === 4 ? '150px' : '350px',
          height: index === 4 ? '150px' : '350px',
        }}
        minWidth={index === 4 ? '150px' : '200px'}
        minHeight={index === 4 ? '150px' : '200px'}
        key={id}
        id={id}
        lockAspectRatio={index === 5 ? false : true}
        enableUserSelectHack={true}
        bounds="parent"
        // dragGrid={[100, 100]} // can implement grid if future interns want
        // resizeGrid={[1, 1]}
        style={{
          zIndex: activeIndex === id ? 998 : 'auto',
          
          // borderWidth: activeIndex === id ? "2px":"0px",
          // borderColor:"skyblue" // for future interns to implement
        }}
        onDragStart={()=>{
          setActiveIndex(id);
        }}
        onResizeStart={()=>{
          setActiveIndex(id);
        }}
        onTouchStart={() => {
          setActiveIndex(id);
        }}
        onDragStop={(e, data) => {
          trashHandler(e, data, id);
          const element = document.getElementById(id);
          if (element) {
            const { x, y } = element.getBoundingClientRect();
            if (x === 10 && y === 10) {
              // If the element is still at the top-left corner after being dragged,
              // stop the event propagation and reset the active index but this needs further work
              // setActiveIndex(null);
            }
          }
          
          
        }}

       
       
      >
        {Components[index]}
      </Rnd>
    ));

    setGeneratedComponents(components);
  }, [componentList, activeIndex]);

  function trashHandler(mouseEvent, data, id) {
    const trashLocation = document
      .getElementById("trash")
      .getBoundingClientRect();
    if (
      mouseEvent.x >= trashLocation.x &&
      mouseEvent.x <= trashLocation.x + trashLocation.width &&
      mouseEvent.y >= trashLocation.y &&
      mouseEvent.y <= trashLocation.y + trashLocation.height
    ) {
      setComponentList((oldList) =>
        oldList.filter((component) => component.id !== id)
      );
    }
  }

  return (
    <ChakraProvider>
      <div className="App">
        <header className="App-header">
          <VStack
            width="100%"
            height="100%"
            justifyContent="center"
            alignItems="center"
          >
            <Box
              position="absolute"
              right="10px"
              left="10px"
              top="10px"
              bottom="10px"
            >
              {generatedComponents}
            </Box>
            <Box className="toolbar-container" width="100%" height="10%" marginBottom="10px">
              <Toolbar />
            </Box>
          </VStack>
        </header>
      </div>
      {useconfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
          wind={0.01}
          colors={["#FFC700", "#FF0000", "#2E3192", "#41BBC7"]}
          confettiSource={{ x: 0, y: 0, w: window.innerWidth, h: 0 }}
          style={{zIndex:1000}}
        />
      )}
      {useconfetti2 && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
          wind={0.01}
          colors={["#FFC700", "#FF0000", "#2E3192", "#41BBC7"]}
          confettiSource={{ x: 0, y: 0, w: window.innerWidth, h: 0 }}
        />
      )}
    </ChakraProvider>
  );
}

export default App;
