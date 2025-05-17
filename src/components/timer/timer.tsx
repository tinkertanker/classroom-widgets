import * as React from "react";
import { useState, useEffect, useRef } from "react";

import {
  Card,
  CardBody,
  CardFooter,
  ChakraProvider,
  Stack, VStack, HStack,
  Text,
  Box,
  Input,
  CircularProgress,
  CircularProgressLabel,
  AspectRatio,
} from "@chakra-ui/react";

import ReusableButton from "../main/reusableButton.tsx";

const Timer = () => {
  const [initialTime, setInitialTime] = useState(10);
  const [time, setTime] = useState(10);
  const [changeTime, setChangeTime] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [inEditMode, setInEditMode] = useState(false);
  const [showStart, setShowStart] = useState(true);
  const [showResume, setShowResume] = useState(false);
  const [showPauseResume, setShowPauseResume] = useState(true);

  const [values, setValues] = useState(['', '', '']);
  const [timeValues, setTimeValues] = useState([0, 0, 0]);
  const inputDisplays = ["hh", "mm", "ss"];
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (e, index) => {
    const newValues = [...values];
    if (/^[0-9]/.test(e.target.value) || e.target.value === '') {
      newValues[index] = e.target.value;
    }
    setValues(newValues);
    setTimeValues(newValues.map((x) => Number(x)));

    if (e.target.value.length === 2 && index < inputRefs.current.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  useEffect(() => {
    if (time <= 0) {
      setIsRunning(false);
      setShowPauseResume(false);
      console.log("Done!");
    }
  }, [time]);

  const startTimer = (isResume=false) => {
    if (!timeValues[0] && !timeValues[1] && !timeValues[2]) return;

    let changes = [0, 0, 0];
    let incomingTime = timeValues[2] + timeValues[1]*60 + timeValues[0]*3600;
    if (timeValues[2] > 60) {
      changes[1] += 1;
      changes[2] -= 60;
    }
    if (timeValues[1]+changes[1] > 60) {
      changes[0] += 1;
      changes[1] -= 60;
    }
    if (timeValues[0]+changes[0] > 23) {
      let change = timeValues[0]+changes[0]-23;
      changes[0] -= change;
      incomingTime -= change*3600;
    }

    let finalValues = timeValues.map((a, i) => a+changes[i]);
    setTimeValues(finalValues);
    setValues(finalValues.map((a) => String(a).length<2 ? '0'+String(a) : String(a)));
    setInitialTime(isResume ? incomingTime-time+initialTime : incomingTime);
    setTime(incomingTime);
    setTimeout(() => setChangeTime(changeTime+1), 1000);

    setIsRunning(true);
    setInEditMode(false);
    setShowStart(false);
    setShowPauseResume(true);
  };
  const pauseTimer = () => {
    setIsRunning(false);
    setInEditMode(true);
    setShowResume(true);
  };
  const resumeTimer = () => {
    setShowResume(false);
    startTimer(true);
  };
  const restartTimer = () => {
    setIsRunning(false);
    setInEditMode(true);
    setShowStart(true);
    setShowResume(false);
    setTime(initialTime);

    let actualValues = [0, 0, 0];
    actualValues[0] = Math.floor(initialTime/3600);
    actualValues[1] = Math.floor(initialTime/60) > 59 ? 59 : Math.floor(initialTime/60);
    actualValues[2] = initialTime % 60;

    setTimeValues(actualValues);
    setValues(actualValues.map((a) => String(a)));
  };

  // Timer logic
  useEffect(() => {
    if (isRunning) {
      if (time > 0) {
        let changes = [0, 0 ,0];

        if (timeValues[2] > 0) {
          changes[2]--;
        } else if (timeValues[1] > 0) {
          changes[1]--;
          changes[2]+=59;
        } else if (timeValues[0] > 0) {
          changes[0]--;
          changes[1]+=59;
          changes[2]+=59;
        }

        let finalValues = timeValues.map((a, i) => a+changes[i]);
        setTimeValues(finalValues);
        setValues(finalValues.map((a) => String(a).length<2 ? '0'+String(a) : String(a)));
        setTime(time-1);
        setTimeout(() => setChangeTime(changeTime+1), 1000);
      }
    } else {
      !showResume && setTime(initialTime);
    }
  }, [changeTime]);

  return (
    <ChakraProvider>
      <Card overflow="hidden" variant="outline" width="100%" height="100%">
        <CardBody height="85%" py={1}>
            <AspectRatio ratio={1} width="100%" height="100%" py={1}>
              <CircularProgress
                value={((initialTime - time) / initialTime) * 100}
                size="100%"
                thickness="10px"
                color="gray.200"
                trackColor="blue.400"
                position="relative"
              >
                <Box
                  as="button"
                  position="absolute"
                  top="50%"
                  left="50%"
                  transform="translate(-50%, -50%)"
                  onClick={() => {
                    if (isRunning) {
                      pauseTimer();
                    }
                  }}
                >
                  {isRunning && !inEditMode ? (
                    /* DISPLAY MODE */
                    <VStack spacing={1} align="centel" pt={6}>
                      <HStack spacing={2}>
                        <Text fontSize="clamp(1rem, 7vw, 6rem)" lineHeight="1">{values[0]}</Text>
                        <Text fontSize="clamp(1rem, 7vw, 6rem)" lineHeight="1">:</Text>
                        <Text fontSize="clamp(1rem, 7vw, 6rem)" lineHeight="1">{values[1]}</Text>
                      </HStack>
                      <Text fontSize="clamp(1rem, 5vw, 2rem)">{values[2]}</Text>
                    </VStack>
                  ) : (
                     /* EDIT MODE */
                  <HStack spacing={1}>
                    {values.map((val, idx) => (
                    <React.Fragment key={idx}>
                      <Input
                        key={idx}
                        value={val}
                        placeholder={inputDisplays[idx]}
                        onChange={(e) => handleChange(e, idx)}
                        onFocus={(e) => e.target.select()}
                        maxLength={2}
                        size="lg"
                        px={0}
                        textAlign="center"
                        maxLength={2}
                        readOnly={isRunning && !inEditMode}
                      />
                      
                      {/* Add a colon after each input, except the last one */}
                      {idx < values.length - 1 && (
                       <Text fontSize="24px" lineHeight="1">
                      :
                       </Text>
                      )}
                    </React.Fragment>
                    ))}
                  </HStack>
                  )}
                </Box>
              </CircularProgress>
            </AspectRatio>

        </CardBody>
        <CardFooter pt={0}>
          <HStack width="100%" gap="5%" height="100%">
            {showStart ? (
              <ReusableButton onClick={startTimer}>Start {'\u25B6'}</ReusableButton>
            ) : (
              <>
                {showPauseResume ?
                  (showResume ? (
                    <ReusableButton onClick={resumeTimer}>Resume {'\u25B6'}</ReusableButton>
                  ) : (
                    <ReusableButton onClick={pauseTimer}>Pause {'\u2590'} {'\u258C'}</ReusableButton>
                  )) : (
                    <></>
                  )}
                <ReusableButton onClick={restartTimer}>Restart {'\u21BB'}</ReusableButton>
              </>
            )}
          </HStack>

        </CardFooter>
      </Card>
    </ChakraProvider>
  );
}

export default Timer;

