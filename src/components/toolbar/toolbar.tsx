import { v4 as uuidv4 } from 'uuid'; // Import UUID package

import {
  Button,
  Card,
  CardBody,
  Flex,
  HStack,
  Text
} from "@chakra-ui/react";
import { DeleteIcon } from "@chakra-ui/icons";

export default function Toolbar({setComponentList}) {

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
          <Flex justifyContent="right">
            <DeleteIcon id="trash" />
          </Flex>
        </HStack>
      </CardBody>
    </Card>
  );
}
