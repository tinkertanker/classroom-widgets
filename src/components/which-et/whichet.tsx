import { AddIcon, ChevronDownIcon } from "@chakra-ui/icons";
import {
  useDisclosure,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  ChakraProvider,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  ModalCloseButton,
  Select,
  ModalBody,
  VStack,
  HStack,
  Button,
  Divider,
  Box,
  Flex,
  ModalFooter
} from "@chakra-ui/react";
import { useState, useRef, useEffect } from "react";
import * as React from "react";

interface WhichEtProps {
  Components: React.ReactNode[];
  ComponentNames: string[];
  ComponentNum: (value: number) => number;
}

const WhichEt: React.FC<WhichEtProps> = ({ Components, ComponentNames, ComponentNum }) => {
  const [chosenComponent, setChosenComponent] = useState<number>(0);
  const [actualChosenComponent, setActualChosenComponent] = useState<React.ReactNode>(Components[0]);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const handleAddComponent = () => {
    ComponentNum(chosenComponent);
  }

  useEffect(() => {
    setActualChosenComponent(Components[chosenComponent]);
  }, [chosenComponent]);

  return (
    <ChakraProvider>
      <Card
        width="100%"
        height="100%"
        bgColor="transparent"
        textAlign="center"
        justifyContent="center"
        alignContent="center"
      >
        <IconButton
          width="100%"
          height="100%"
          icon={<AddIcon />}
          size="lg"
          aria-label="Add"
          bgColor="transparent"
          color="white"
          _hover={{ bgColor: "gray.700" }}
          _active={{ bgColor: "gray.800" }}
          onClick={onOpen}
        />
      </Card>

      <Modal size="2xl" isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            Choose a widget
          </ModalHeader>
          <ModalCloseButton justifyContent="center" alignContent="center" />
          <ModalBody>
            <HStack align="start" spacing={4}>
              <VStack align="start" spacing={2} width="200px">
                {Components.map((Component, index) => (
                  <Button
                    key={index}
                    onClick={() => setChosenComponent(index)}
                    variant={index === chosenComponent ? "solid" : "ghost"}
                    colorScheme="teal"
                    width="100%"
                    justifyContent={"left"}
                  >
                    {ComponentNames[index]}
                  </Button>
                ))}
              </VStack>

              <Divider orientation="vertical" height="100%" />

              <Flex flex="1" justifyContent="center" alignItems="center">
                <Box
                  height="400px"
                  width="400px"
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  borderWidth="1px"
                  borderRadius="md"
                  overflow="hidden"
                  pointerEvents="none"
                >
                  {Components[chosenComponent]}
                </Box>
              </Flex>
            </HStack>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="teal" onClick={handleAddComponent}>
              Add
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </ChakraProvider>
  );
};

export default WhichEt;
