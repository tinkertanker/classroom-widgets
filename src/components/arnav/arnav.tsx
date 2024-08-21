import * as React from "react";
import { useState, useEffect, useRef } from "react";

import {
  Card,
  CardBody,
  CardFooter,
  Text,
  ChakraProvider,
  Stack,
  Box,
  Progress,
  Input,
} from "@chakra-ui/react";

import ReusableButton from "../main/reusableButton.tsx";

// TODO find a way to make values[] update when time changes
//      can do this by simply changing timeValues[] directly and updating values[] from there

const Arnav = () => {
  const [initialTime, setInitialTime] = useState(10);
  const [time, setTime] = useState(10);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showStart, setShowStart] = useState(true);
  const [showResume, setShowResume] = useState(false);
  const [showTimerButtons, setShowTimerButtons] = useState(true);

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
    if (isRunning) {
      setShowStart(false);
      setShowTimerButtons(false);
    }
  }, [time]);

  const startTimer = () => {
    if (initialTime === 0) return;

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
      let change = timeValues[0]-23;
      changes[0] -= change;
      incomingTime -= change*3600;
    }

    let finalValues = timeValues.map((a, i) => a+changes[i]);
    setTimeValues(finalValues);
    setValues(finalValues.map((a) => String(a)));
    setInitialTime(incomingTime);
    setTime(incomingTime);

    setIsRunning(true);
  };
  const pauseTimer = () => {
    setIsRunning(false);
    setShowResume(true);
  };
  const resumeTimer = () => {
    setShowResume(false);
    startTimer();
  };
  const restartTimer = () => {
    setIsRunning(false);
    setShowStart(true);
    setShowResume(false);
    setTime(initialTime);
    setShowTimerButtons(true);
  };

  React.useEffect(() => {
    // when updating time, check again if isRunning is true
    if (isRunning) {
      if (time > 0) setTimeout(() => setTime(time - 1), 1000);
      else setIsCompleted(true);
    } else {
      !showResume && setTime(initialTime);
    }
    console.log("running:", time);
  }, [time, isRunning]);

  // useEffect(() => {
  //   setTime(initialTime);
  // }, [initialTime]);

  useEffect(() => {
    setIsRunning(false);
    if (isCompleted) console.log("Done!");
  }, [isCompleted]);

  return (
    <ChakraProvider>
      <Card overflow="hidden" variant="outline" width="400px" height="400px">
        <CardBody>
          <Box p={5}>
            <Stack direction="row" spacing={4}>
              {values.map((value, index) => (
                <Input
                  key={index}
                  value={value}
                  placeholder={inputDisplays[index]}
                  isReadOnly={isRunning}       // for paused -> {... || (!isRunning && showResume)}
                  onChange={(e) => handleChange(e, index)}
                  maxLength={2}
                  type="text"
                  inputMode="numeric"
                  ref={(el) => (inputRefs.current[index] = el)}
                />
              ))}
            </Stack>
          </Box>
        </CardBody>


        <CardFooter>
          <Stack width="100%">
            {showStart ? (
              <ReusableButton onClick={startTimer}>Start</ReusableButton>
            ) : (
              <>
                {showResume ? (
                  <ReusableButton onClick={resumeTimer}>Resume</ReusableButton>
                ) : (
                  <ReusableButton onClick={pauseTimer}>Pause</ReusableButton>
                )}
                <ReusableButton onClick={restartTimer}>Restart</ReusableButton>
              </>
            )}

            <Progress
              value={((initialTime - time) / initialTime) * 100}
              width="100%"
            />
          </Stack>
        </CardFooter>
      </Card>
    </ChakraProvider>
  );
}

export default Arnav;
