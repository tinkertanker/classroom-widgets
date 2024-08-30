import WhichEt from "./components/which-et/whichet.tsx";
import "./App.css";
import Jason from "./components/jason/json.tsx";
import Arnav from "./components/arnav/arnav.tsx";
import List from "./components/list/list.tsx";
import Boaz from "./components/boaz/boaz.tsx";
import TrafficLight from './components/boaz/boazbutbad.tsx';
import AudioVolumeMonitor from './components/boaz/volumeLevel.tsx';
import ShortenLink from './components/boaz/filename.tsx';
import { useEffect, useState, useRef } from "react";
import { createSwapy } from "swapy";
import { Rnd } from "react-rnd";

import Confetti from "react-confetti";
import Time from "./components/jason/clock.tsx";
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
} from "@chakra-ui/react";
import { HamburgerIcon } from "@chakra-ui/icons";

function App() {
  const [useconfetti, setUseconfetti] = useState(false);
  const [useconfetti2, setUseconfetti2] = useState(false);
  const [componentList, setComponentList] = useState([]);
  const [activeIndex, setActiveIndex] = useState(null);

  const Components = [
    // list of components
    <Jason toggleConfetti={setUseconfetti} />,
    <Arnav />,
    <List toggleConfetti={setUseconfetti2} />,
    <Boaz />,
    <Time />,
    <TrafficLight/>,
    <AudioVolumeMonitor/>,
    <ShortenLink/>
  ];

  const ComponentNames = [
    // list of component names
    "RNG",
    "Timer",
    "List",
    "Work Symbols",
    "Clock",
    "Traffic Light",
    "Loudness Monitor",
    "Link Shortener"
  ];
  function Toolbar() {
    return (
      <Card width="90%">
        <CardBody width="100%">
          <HStack alignItems="center" justifyContent="center">
            {ComponentNames.map((ComponentName, index) => (
              <Button
                key={index}
                onClick={() => {
                  console.log([...componentList, index]);
                  setComponentList((e) => [...e, index]);
                }}
                colorScheme="teal"
                justifyContent={"center"}
              >
                {ComponentName}
              </Button>
            ))}
            <Text>{componentList.length}</Text>
          </HStack>
        </CardBody>
      </Card>
    );
  }

  return (
    <ChakraProvider>
      <div className="App">
        <header className="App-header">
          <VStack width='100%' height='100%' justifyContent='center' alignItems='center'>
          <Box position='absolute' right='10px' left='10px' top='10px' bottom='10px'>

          {componentList.map((number, index) => {
            return (
              <Rnd
              default={{
                x: Math.floor(Math.random() * (window.innerWidth-370)),
                y: Math.floor(Math.random() * (window.innerHeight-370)),
                width: 350,
                height: 350,
              }}
              minWidth='100'
              minHeight='100'
              key={index}
              lockAspectRatio={true}
              enableUserSelectHack={true}
              bounds="parent"
              dragGrid={[100,100]}
              resizeGrid= {[1, 1]}
              style={{
                zIndex: activeIndex === index ? 1000 : 'auto',
                onClick: () => setActiveIndex(index),
                onTouchStart: () => setActiveIndex(index),
              }}
              >
                {Components[number]}
              </Rnd>
            );
          })}
          </Box>
          <Box className="toolbar-container">
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
