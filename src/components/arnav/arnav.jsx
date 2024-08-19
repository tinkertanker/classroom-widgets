import { useState, useEffect } from 'react';

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
} from '@chakra-ui/react'

import ReusableButton from './reusableButton.jsx';

function Arnav() {
  const [initialTime, setInitialTime] = useState(0);
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showStart, setShowStart] = useState(true);
  const [showResume, setShowResume] = useState(false);

  const startTimer = () => {
    setInitialTime(10);
    setTime(initialTime);
    setIsRunning(true);
    setShowStart(false);
  }
  const pauseTimer = () => {
    setIsRunning(false);
    setShowResume(true);
  }
  const resumeTimer = () => {
    setIsRunning(true);
    setShowResume(false);
  }
  const restartTimer = () => {
    setIsRunning(false);
    setShowStart(true);
    setShowResume(false);
    setTime(initialTime);
  }

  useEffect = () => ({
    // if (isRunning) {
    //   time -= 0.1;
    //   console.log('hi')
    //   // timer function
    // }
  } [isRunning])

  console.log(isRunning);

  return (
    <ChakraProvider>
      <Card
        overflow='hidden'
        variant='outline'
        width='100%'
        height='200px'
      >
        <CardBody>
          
        </CardBody>

        <CardFooter>
          {
            showStart ? (
              <ReusableButton onClick={startTimer}>
                Start
              </ReusableButton>
            ) : (
              <>
                {
                  showResume ? (
                    <ReusableButton onClick={resumeTimer}>
                      Resume
                    </ReusableButton>
                  ) : (
                    <ReusableButton onClick={pauseTimer}>
                      Pause
                    </ReusableButton>
                  )
                }
                <ReusableButton onClick={restartTimer}>
                  Restart
                </ReusableButton>
              </>
            )
          }

          <Progress value={initialTime-time/initialTime * 100} width='100%' />
        </CardFooter>
      </Card>
    </ChakraProvider>
  )
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