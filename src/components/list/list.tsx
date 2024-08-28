// TODO : Add YAY when everything done

import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  ChakraProvider,
  Stack,
  Box,
  Input,
  Button,
  IconButton,
  Modal,
  useDisclosure,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  InputGroup,
  InputRightElement,
  Heading,
  Text,
  Radio,
  RadioGroup,
  Checkbox,
  ModalCloseButton,
} from "@chakra-ui/react";
import { useState, useRef, useEffect } from "react";
import { CheckIcon, DeleteIcon, SettingsIcon } from "@chakra-ui/icons";

import * as React from "react";
import AlertDialogExample from "../main/alert.tsx";

interface ListProps {
  title: string;
  toggleConfetti: (value: boolean) => boolean;
}

const List: React.FC<ListProps> = ({ title, toggleConfetti }) => {
  const [localTitle, setLocalTitle] =     useState<string>(localStorage.getItem('title') || title);
  const [inputs, setInputs] =             useState<string[]>(JSON.parse(localStorage.getItem('inputs') || '[]'));
  const [completed, setCompleted] =       useState<boolean[]>(JSON.parse(localStorage.getItem('completed') || '[]'));
  const [hideComplete, setHideComplete] = useState<boolean>(JSON.parse(localStorage.getItem('hideComplete') || 'false'));
  const [isChecklist, setIsChecklist] =   useState<boolean>(JSON.parse(localStorage.getItem('isChecklist') || 'true'));

  const { isOpen, onOpen, onClose } = useDisclosure();
  const initialFocus = React.useRef(null);
  const inputRefs = useRef<HTMLInputElement[]>([]);

  const handleRadioChange = (value: string) => {
    setIsChecklist(value === '1');
  };

  const handleAddInput = () => {
    setInputs((prevInputs) => {
      const newInputs = [...prevInputs, ""];
      setTimeout(() => {
        inputRefs.current[newInputs.length - 1]?.focus(); // Focus the last added input after updating state
      }, 0);
      return newInputs;
    });
    setCompleted([...completed, false]);
    toggleConfetti(false);
  };

  const handleInputChange = (index: number, value: string) => {
    const newInputs = [...inputs];
    newInputs[index] = value;
    setInputs(newInputs);
  };

  const toggleCompleted = (index: number) => {
    const updatedCompleted = [...completed];
    updatedCompleted[index] = !updatedCompleted[index];
    setCompleted(updatedCompleted);

    // get sum of all elements in completed using Number() [elements are true/false]
    const sumCompleted = updatedCompleted.reduce((sum, value) => sum + Number(value), 0);
    console.log(sumCompleted);

    if (inputs.length === sumCompleted && inputs.length > 0) {
      console.log('hi');
      // if (useConfetti) return;
      toggleConfetti(false);
      setTimeout(() => toggleConfetti(true), 1000);
    }
  };
  // useEffect(() => {
  //   const savedInputs =       JSON.parse(localStorage.getItem('inputs') || '[]');
  //   const savedCompleted =    JSON.parse(localStorage.getItem('completed') || '[]');
  //   const savedHideComplete = JSON.parse(localStorage.getItem('hideComplete') || 'false');
  //   const savedIsChecklist =  JSON.parse(localStorage.getItem('isChecklist') || 'true');

  //   setInputs(savedInputs);
  //   setCompleted(savedCompleted);
  //   setHideComplete(savedHideComplete);
  //   setIsChecklist(savedIsChecklist);
  // }, []);

  const handleDeleteConfirm = (confirm: boolean) => {
    if (confirm) {
      setInputs([]);
      setCompleted([]);
      onClose();
    }
  };

  const handleHideCompletedItemsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setHideComplete(event.target.checked);
  };

  const handleDeleteInput = (index: number) => {
    const newInputs = inputs.filter((_, i) => i !== index);
    const newCompleted = completed.filter((_, i) => i !== index);
    setInputs(newInputs);
    setCompleted(newCompleted);
  };


  // LOCAL STORAGE
  useEffect(() => {
    localStorage.setItem('title', localTitle);
  }, [localTitle]);

  useEffect(() => {
    localStorage.setItem('inputs', JSON.stringify(inputs));
  }, [inputs]);

  useEffect(() => {
    localStorage.setItem('completed', JSON.stringify(completed));
  }, [completed]);

  useEffect(() => {
    localStorage.setItem('hideComplete', JSON.stringify(hideComplete));
  }, [hideComplete]);

  useEffect(() => {
    localStorage.setItem('isChecklist', JSON.stringify(isChecklist));
  }, [isChecklist]);

  return (
    <ChakraProvider>
      <Card width="400px" maxHeight="400px">
        <CardHeader>
          <Input
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            variant="flushed"
            placeholder="Title"
            fontSize="2xl"
            fontWeight="bold"
          />
        </CardHeader>
        <CardBody overflowY="auto" mt={2}>
          <Box>
            <Stack spacing={1}>
              {inputs.map((input, index) =>
                hideComplete && completed[index] && isChecklist ? null : (
                  <Stack direction="row" align="center" key={index} spacing={1}>
                    {isChecklist ? (
                      <IconButton
                        icon={<CheckIcon />}
                        onClick={() => toggleCompleted(index)}
                        aria-label="Complete task"
                        bg={completed[index] && isChecklist ? "green.500" : "gray.200"}
                        color={completed[index] && isChecklist ? "white" : "black"}
                        _hover={{ bg: completed[index] && isChecklist ? "green.600" : "gray.300" }}
                      />
                    ) : null}
                    <InputGroup>
                      <Input
                        ref={(el) => (inputRefs.current[index] = el!)}
                        value={input}
                        onChange={(e) => handleInputChange(index, e.target.value)}
                        variant="filled"
                        placeholder="Type away!"
                        textDecoration={completed[index] && isChecklist ? "line-through" : "none"}
                        bg={completed[index] && isChecklist ? "green.100" : "gray.100"}
                        _hover={{ bg: completed[index] && isChecklist ? "green.200" : "gray.200" }}
                      />
                      <InputRightElement>
                        <IconButton
                          icon={<DeleteIcon />}
                          size="sm"
                          aria-label="Delete Task"
                          bg="transparent"
                          color="gray.800"
                          _hover={{ bg: "red.600", color: "white" }}
                          onClick={() => handleDeleteInput(index)}
                          tabIndex={-1} // Make the button unselectable via tabbing
                        />
                      </InputRightElement>
                    </InputGroup>
                  </Stack>
                )
              )}
            </Stack>
          </Box>
        </CardBody>
        <CardFooter>
          <Button colorScheme="teal" onClick={handleAddInput}>
            Add Item
          </Button>
          <IconButton
            aria-label="Settings"
            icon={<SettingsIcon />}
            ml="auto"
            bg="gray.800"
            color="white"
            _hover={{ bg: "gray.700" }}
            onClick={onOpen}
          />
        </CardFooter>
      </Card>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        initialFocusRef={initialFocus}
        isCentered
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <Text>Settings</Text>
            <ModalCloseButton />
          </ModalHeader>
          <ModalBody>
            <Stack spacing={2}>
              <Heading size="md">List Settings</Heading>
              <Checkbox
                isChecked={hideComplete} // Bind checkbox state to `hideComplete`
                onChange={handleHideCompletedItemsChange}
              >
                Hide Completed Items
              </Checkbox>
              <Text>List Type</Text>
              <RadioGroup value={isChecklist ? "1" : "2"} onChange={handleRadioChange}>
                <Stack spacing={4} direction="row">
                  <Radio value="1">Checklist</Radio>
                  <Radio value="2">Normal List</Radio>
                </Stack>
              </RadioGroup>
              <Heading size="md">Item Settings</Heading>
              <AlertDialogExample onDeleteConfirm={handleDeleteConfirm} />
            </Stack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </ChakraProvider>
  );
};

export default List;
