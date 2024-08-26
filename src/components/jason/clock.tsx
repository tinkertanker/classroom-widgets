import * as React from "react";

import { useEffect, useState } from "react";
import Clock from "react-clock";
import "react-clock/dist/Clock.css";
import { ChakraProvider, Text, Card, CardBody } from "@chakra-ui/react";

function Time() {
  const [value, setValue] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setValue(new Date()), 1000);
    console.log(value);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <ChakraProvider>
      <Card color="black">
        <CardBody>
          <Clock
            value={value}
            renderNumbers={true}
            size={300} // Increase the size of the clock    
            renderMinuteMarks={true}
            minuteMarksLength={5}
          />
        </CardBody>

        {/* <Text color='black'>{value.toLocaleString()}</Text> */}
      </Card>
    </ChakraProvider>
  );
}

export default Time;
