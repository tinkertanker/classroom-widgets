import * as React from "react";

import { useEffect, useState } from "react";
import Clock from "react-clock";
import "react-clock/dist/Clock.css";
import { ChakraProvider, Text, Card, CardBody } from "@chakra-ui/react";

function Time() {
  const [value, setValue] = useState(new Date());
  const [formattedtime, setFormattedTime] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      let date = new Date();
      setValue(date);
      let hours = date.getHours();
      let minutes = date.getMinutes();
      let seconds = date.getSeconds();

      // Check whether AM or PM
      let newformat = hours >= 12 ? "PM" : "AM";

      // Find current hour in AM-PM Format
      hours = hours % 12;

      // To display "0" as "12"
      hours = hours ? hours : 12;
      let minutes2 = minutes < 10 ? "0" + minutes : minutes;
      let seconds2 = seconds < 10 ? "0" + seconds : seconds;

      setFormattedTime(
        hours + ":" + minutes2 + ":" + seconds2 + " " + newformat
      );
    }, 1000);

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
          <Text color="black" paddingTop="10px">
            {formattedtime}
          </Text>
        </CardBody>
      </Card>
    </ChakraProvider>
  );
}

export default Time;
