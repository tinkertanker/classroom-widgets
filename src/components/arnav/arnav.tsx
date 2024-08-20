import * as React from "react";
import { useState, useEffect } from "react";
import ContentEditable from 'react-contenteditable';

import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Text,
  ChakraProvider,
  Stack,
  Heading,
  Button,
  Image,
  CircularProgress,
  CircularProgressLabel,
  useColorModeValue,
  Box,
  Progress,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverCloseButton,
  PopoverHeader,
  PopoverBody,
  Input,
} from "@chakra-ui/react";

import ReusableButton from "./reusableButton.tsx";

function Arnav() {
  const [initialTime, setInitialTime] = useState(10);
  const [time, setTime] = useState(10);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showStart, setShowStart] = useState(true);
  const [showResume, setShowResume] = useState(false);
  const [showTimerButtons, setShowTimerButtons] = useState(true);

  const changeTimer = () => {
    setInitialTime(initialTime + 10);
  };

  const startTimer = () => {
    if (initialTime != 0) {
      setIsRunning(true);
      setShowStart(false);
      setShowTimerButtons(false);
    }
  };
  const pauseTimer = () => {
    setIsRunning(false);
    setShowResume(true);
  };
  const resumeTimer = () => {
    setIsRunning(true);
    setShowResume(false);
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
    isRunning && time > 0 && setTimeout(() => setTime(time - 1), 1000);
    !isRunning && !showResume && setTime(initialTime);
    console.log("running:", time);
    // if (isRunning && time > 0) {
    //   setTimeout(() => setTime(time - 1), 1000);
    // }
  }, [time, isRunning]);

  useEffect(() => {
    setTime(initialTime);
  }, [initialTime]);

  // const timer = setInterval(function() {
  //   if (isRunning && !isCompleted) {
  //     setTime(time - 1);
  //     console.log(time);
  //   }
  //   if (time === 0) {
  //     clearInterval(timer);
  //     setIsCompleted(true);
  //   }
  // }, 1000);

  useEffect(() => {
    setIsRunning(false);
    if (isCompleted) console.log("Done!");
  }, [isCompleted]);

  const [value, setValue] = useState('10');

  const handleChange = (event) => {
    let inputValue = event.target.value;
    console.log(inputValue, '');
    // Check if the input is a number and does not exceed 2 characters
    if ((/^[0-9]{0,2}$/.test(inputValue))) {
      setValue(inputValue > 60 ? 60 : inputValue === '' ? 0 : inputValue[0] === '0' ? inputValue.slice(1) : inputValue);
    }
  };

  // const validateNumber = (event) => {
  //   const keyCode = event.keyCode || event.which
  //   const string = String.fromCharCode(keyCode)
  //   const regex = /[0-9,]|\./
  
  //   if (!regex.test(string)) {
  //     event.returnValue = false
  //     if (event.preventDefault) event.preventDefault()
  //   }
  // }

  // useEffect = () => (function() {
  //   // if (isRunning) {
  //   //   time -= 0.1;
  //   //   console.log('hi')
  //   // //   // timer function
  //   // }
  // } [isRunning]);

  console.log(isRunning);

  return (
    <ChakraProvider>
      <Card overflow="hidden" variant="outline" width="400px" height="400px">
        <CardBody>
          <Popover>
            <PopoverTrigger>
              <Button>{value}</Button>
            </PopoverTrigger>
            <PopoverContent>
              <PopoverArrow />
              <PopoverCloseButton />
              <PopoverBody>
                {/* create a content editable text that only has 2 digits max, only numbers */}
                <Input
                  value={value}
                  onChange={handleChange}
                  placeholder="Enter numbers only"
                />

                {/* <Text contentEditable="true" >
                  {Math.floor(time / 60)
                    .toString()
                    .padStart(2, "0")}
                  :{(time % 60).toString().padStart(2, "0")}
                </Text> */}
              </PopoverBody>
            </PopoverContent>
          </Popover>

          {/* <Text contentEditable='true'>
            {Math.floor(time / 60).toString().padStart(2, '0')}:{(time % 60).toString().padStart(2, '0')}
          </Text>

          {
            showTimerButtons ? (
              <>
                <ReusableButton onClick={changeTimer}>
                  +10s
                </ReusableButton>
                <ReusableButton onClick={changeTimer}>
                  -10s
                </ReusableButton>
              </>
            ) : (
              <></>
            )
          } */}
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

// function Arnav() {
//   const [initialTime, setInitialTime] = useState(0);
//   const [time, setTime] = useState(0);
//   const [isRunning, setIsRunning] = useState(false);
//   const [isReset, setIsReset] = useState(false);
//   const [isCompleted, setIsCompleted] = useState(false);

//   return (
//     <ChakraProvider>

//       <Card
//         direction={{ base: 'column', sm: 'row' }}
//         overflow='hidden'
//         variant='outline'
//         width='100%'
//       >
//       </Card>
//     </ChakraProvider>
//   );
// }

// <CircularProgress size='100%' value={initialTime-time/initialTime * 100}>
//   <CircularProgressLabel fontSize='100%'>
//       {Math.floor(time / 60).toString().padStart(2, '0')}:{(time % 60).toString().padStart(2, '0')}
//   </CircularProgressLabel>
// </CircularProgress>

// <Stack width='full'>
//   <CardFooter>
//     <Button variant='solid' colorScheme='blue'>
//       Start
//     </Button>
//   </CardFooter>
// </Stack>
