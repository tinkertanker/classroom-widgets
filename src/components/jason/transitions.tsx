import * as React from "react";

import {
  ChakraProvider,
  Fade,
  ScaleFade,
  Slide,
  SlideFade,
  Collapse,Text
} from "@chakra-ui/react";

function Transitions({
  choice,
  open,
  animationspeed,
  slowanimation,
  children
}) {
  console.log(choice);
  switch (choice) {
    case "Fade":
      return (
        <ChakraProvider>
          <Fade
            in={open}
            transition={{
              exit: { duration: animationspeed + slowanimation },
              enter: { duration: animationspeed + slowanimation },
            }}
          >
            {children}
          </Fade>
        </ChakraProvider>
      );
    case "ScaleFade":
      return (
        <ChakraProvider>
          <ScaleFade
            in={open}
            initialScale={0.5}
            transition={{
              exit: { duration: animationspeed + slowanimation },
              enter: { duration: animationspeed + slowanimation },
            }}
          >
            {children}
          </ScaleFade>
        </ChakraProvider>
      );
    case "SlideFade":
      return (
        <ChakraProvider>
          <SlideFade
            in={open}
            offsetY="20px"
            transition={{
              exit: { duration: animationspeed + slowanimation },
              enter: { duration: animationspeed + slowanimation },
            }}
          >
            {children}
          </SlideFade>
        </ChakraProvider>
      );
  }
}
export default Transitions;
