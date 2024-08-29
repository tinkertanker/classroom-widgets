import logo from "./logo.svg";
import "./App.css";
import Jason from "./components/jason/json.tsx";
import Arnav from "./components/arnav/arnav.tsx";
import List from "./components/list/list.tsx";
import Boaz from "./components/boaz/boaz.js";
import { useEffect, useState, useRef } from "react";
import { createSwapy } from "swapy";
import Confetti from "react-confetti";
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
} from "@chakra-ui/react";
import { HamburgerIcon } from "@chakra-ui/icons";

function App() {
  const [useconfetti, setUseconfetti] = useState(false);
  const [useconfetti2, setUseconfetti2] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const btnRef = useRef();
  const [selected, setSelected] = useState([
    [true, true, false],
    [true, true, false],
    [true, true, false],
  ]);
  const [rowNo, setRowNo] = useState(3);
  const [columnNo, setColumnNo] = useState(2);

  const handleBoxClick = (bigindex, index) => {
    const newSelected = selected.map((innerSelected, indexa) => {
      return innerSelected.map((_, i) => {
        if (indexa <= bigindex) {
          if (i <= index) {
            return true;
          } else {
            return false;
          }
        } else {
          return false;
        }
      });
    });
    setSelected(newSelected);
  };

  const renderBoxes = () => {
    return selected.map((innerSelected, bigindex) => {
      return innerSelected.map((isSelected, index) => (
        <Button
          key={bigindex*3+index+1}
          width="100%"
          height="100%"
          colorScheme={isSelected ? "blue" : "gray"}
          onClick={() => handleBoxClick(bigindex, index)}
          alignItems="center"
          justifyContent="center"
          // _hover={{ bg: isSelected ? "blue.500" : "gray.300" }}
        ></Button>
      ));
    });
  };
  useEffect(() => {
    let rowNumber,columnNumber;
    if (selected.findIndex((row)=>row[0]==false)==-1){
      rowNumber = selected.length
    }else{
      rowNumber = selected.findIndex((row)=>row[0]==false)
    }
    if (selected[0].findIndex((value)=>value==false)==-1){
      columnNumber = selected[0].length
    }else{
      columnNumber = selected[0].findIndex((value)=>value==false)
        }
    setRowNo(rowNumber);
    setColumnNo(columnNumber);

  }, [selected]);
  useEffect(() => {
    document.documentElement.style.setProperty("--grid-columns", columnNo);
    document.documentElement.style.setProperty("--grid-rows", rowNo);

    const container = document.querySelector(".container");
    const swapy = createSwapy(container, {
      animation: "dynamic",
    });
    swapy.enable(true);

    return () => {
      swapy.enable(false);
    };
  }, [columnNo, rowNo]);
  return (
    <ChakraProvider>
      <div className="App">
        <header className="App-header">
          <div className="container">
            <div className="slot section-1" data-swapy-slot="slot1">
              <div className="content" data-swapy-item="itemA">
                {/* <Jason toggleConfetti={setUseconfetti} /> */}
                <List toggleConfetti={setUseconfetti2} />
              </div>
            </div>

            <div className="slot section-2" data-swapy-slot="slot2">
              <div className="content" data-swapy-item="itemB">
              <List toggleConfetti={setUseconfetti2} />
              </div>
            </div>

            <div className="slot section-3" data-swapy-slot="slot3">
              <div className="content" data-swapy-item="itemC">
                <List toggleConfetti={setUseconfetti2} />
              </div>
            </div>

            <div className="slot section-4" data-swapy-slot="slot4">
              <div className="content" data-swapy-item="itemD">
                <List toggleConfetti={setUseconfetti2} />
              </div>
            </div>
          </div>
          <IconButton
            ref={btnRef}
            colorScheme="teal"
            onClick={onOpen}
            icon={<HamburgerIcon />}
          ></IconButton>
        </header>

        <Drawer
          isOpen={isOpen}
          placement="right"
          onClose={onClose}
          finalFocusRef={btnRef}
        >
          <DrawerOverlay />
          <DrawerContent>
            <DrawerCloseButton />
            <DrawerHeader>Formatting</DrawerHeader>

            <DrawerBody width="100%" height="100%">
              {/* <VStack align='left'>
                <HStack>
                  <Text textAlign='center' width='60px'>Row</Text>
                  <Text textAlign='center' width='20px'>x</Text>
                  <Text textAlign='center' width='60px'>Column</Text>
                </HStack>
                
                <HStack>
                  <PinInput
                    defaultValue={rowNo.toString() + columnNo.toString()}
                    placeholder=""
                    onChange={(e)=>{
                      console.log(e)
                    }}
                  >
                    <PinInputField width='60px'/>
                    <Text textAlign='center' width='20px'>x</Text>
                    <PinInputField width='60px' />
                  </PinInput>
                </HStack>
              </VStack> */}
              <VStack width="100%" height="100%" align="left">
                <Text marginBottom="10px" fontSize="xl">
                  Grid Size
                </Text>
                <SimpleGrid
                  columns={3}
                  spacingX={4}
                  spacingY={4}
                  width="100%"
                  height="30%"
                >
                  {renderBoxes()}
                </SimpleGrid>
              </VStack>
            </DrawerBody>

            <DrawerFooter>
                <Button colorScheme="blue" onClick={onClose}>Save</Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
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
      </div>
    </ChakraProvider>
  );
}

export default App;
