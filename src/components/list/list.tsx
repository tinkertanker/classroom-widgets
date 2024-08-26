// TODO : Add YAY when everything done
// Local Storage
// TODO : SETTINGS:
// TODO   - Delete Inputs (indiv/all)
// TODO   - Toggle List/Checklist
//        - Option for localstorage

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
} from "@chakra-ui/react";
import { useState } from "react";
import { CheckIcon, SettingsIcon } from "@chakra-ui/icons";

import * as React from "react";

interface ListProps {
  title: string;
}

const List: React.FC<ListProps> = ({ title }) => {
  const [inputs, setInputs] = useState<string[]>([]);
  const [completed, setCompleted] = useState<boolean[]>([]);

  const handleAddInput = () => {
    setInputs([...inputs, ""]);
    setCompleted([...completed, false]);
  };

  const handleInputChange = (index: number, value: string) => {
    const updatedInputs = [...inputs];
    updatedInputs[index] = value;
    setInputs(updatedInputs);
  };

  const toggleCompleted = (index: number) => {
    const updatedCompleted = [...completed];
    updatedCompleted[index] = !updatedCompleted[index];
    setCompleted(updatedCompleted);
  };

  return (
    <ChakraProvider>
      <Card width="400px" maxHeight="400px">
        <CardHeader>
          <Input
            value={title}
            variant="flushed"
            placeholder="Title"
            fontSize="2xl"
            fontWeight="bold"
          />
        </CardHeader>
        <CardBody overflowY="auto" mt={2}>
          <Box>
            <Stack spacing={1}>
              {inputs.map((input, index) => (
                <Stack direction="row" align="center" key={index} spacing={1}>
                  <IconButton
                    icon={<CheckIcon />}
                    onClick={() => toggleCompleted(index)}
                    aria-label="Complete task"
                    bg={completed[index] ? "green.500" : "gray.200"}
                    color={completed[index] ? "white" : "black"}
                    _hover={{ bg: completed[index] ? "green.600" : "gray.300" }}
                  />
                  <Input
                    value={input}
                    onChange={(e) => handleInputChange(index, e.target.value)}
                    variant="filled"
                    placeholder="Click to Add a Task"
                    textDecoration={completed[index] ? "line-through" : "none"}
                    bg={completed[index] ? "green.100" : "gray.100"}
                  />
                </Stack>
              ))}
            </Stack>
          </Box>
        </CardBody>
        <CardFooter>
          <Button onClick={handleAddInput}>Add Input</Button>
          <IconButton
            aria-label="Settings"
            icon={<SettingsIcon />}
            ml="auto"
            bg="gray.800"
            color="white"
            _hover={{ bg: "gray.700" }}
          />
        </CardFooter>
      </Card>
    </ChakraProvider>
  );
};

export default List;