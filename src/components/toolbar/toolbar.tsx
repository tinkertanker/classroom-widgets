import { v4 as uuidv4 } from 'uuid'; // Import UUID package
import React from 'react';
import {
  Button,
  Card,
  CardBody,
  Flex,
  HStack,
  Text
} from "@chakra-ui/react";
import { DeleteIcon } from "@chakra-ui/icons";

export default function Toolbar({setComponentList,activeIndex,setActiveIndex}) {

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
        <CardBody width="100%" height="100%" paddingX='10px' paddingY='0'>
          <HStack
            alignItems="center"
            justifyContent="left"
            width="100%"
            height="100%"
            overflowX='auto'
            overflowY='visible'
          >
            {ComponentNames.map((ComponentName, index) => (
              <Button
                key={index}
                onClick={() => {
                  const element = document.getElementById(activeIndex!);
                  if (element) {
                    const { x, y } = element.getBoundingClientRect();
                    if (x === 10 && y === 10) {
                      setActiveIndex(null);
                    }
                  }
                  setComponentList((e) => [...e, { id: uuidv4(), index }]);
                }}
                colorScheme="teal"
                justifyContent="center"
                fontSize={{
                  base: "0.3rem",
                  sm: "0.5rem",
                  md: "0.8rem",
                  lg: "1.1rem",
                  xl: "1.1rem",
                }}
 
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
