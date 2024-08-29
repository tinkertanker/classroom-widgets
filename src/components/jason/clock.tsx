import * as React from "react";

import { useEffect, useState } from "react";
import Clock from "react-clock";
import "react-clock/dist/Clock.css";
import {
  ChakraProvider,
  Text,
  Card,
  CardBody,
  Box,
  VStack,
} from "@chakra-ui/react";
import "./clock.tsx";

function Time() {
  const [value, setValue] = useState(new Date());
  const [formattedTime, setFormattedTime] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setValue(new Date());
    }, 500)

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const date = value;
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const miliseconds = date.getMilliseconds();

    const newFormat = hours >= 12 ? "PM" : "AM";
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? "0" + minutes : minutes;
    const formattedSeconds = seconds < 10 ? "0" + seconds : seconds;
    // const formattedMiliseconds = String(Math.floor(miliseconds / 10)).padStart(2, '0');

    setFormattedTime(
      `${formattedHours}:${formattedMinutes}:${formattedSeconds} ${newFormat}`
    );
  }, [value]);

  return (
    <ChakraProvider>
      <Card color="black" width="100%" height="100%">
        <CardBody
          width="100%"
          height="100%"
          display="flex"
          justifyContent="center"
          alignItems="center"
          padding="4px"
        >
          <VStack
            width="100%"
            height="100%"
            justifyContent="center"
            alignItems="center"
          >
            {/* this doesnt work with swapy */}
            {/* <Box height="100%" style={{ aspectRatio: "1/1" }}>
              <Clock
                size="100%"
                value={value}
                renderNumbers={true}
                renderMinuteMarks={true}
                minuteMarksLength={5}
                renderHourMarks={true}
                renderSecondHand={true}
                className="jason"
              />
            </Box> */}
            <Text color="black">{formattedTime}</Text>
          </VStack>
        </CardBody>
      </Card>
    </ChakraProvider>
  );
}

export default Time;
