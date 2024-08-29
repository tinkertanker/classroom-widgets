import * as React from "react";
import { Rnd } from "react-rnd";
import { useState } from "react";

// 1. import `ChakraProvider` component
import { ChakraProvider, Card } from "@chakra-ui/react";

function Widget({ width, height, children }) {
  const [borderW, setBorder] = useState("2px");

  window.onclick = function (e) {
    if (
      e.target === document.getElementById("widget1") ||
      e.target === document.getElementById("widget1big")
    ) {
      setBorder("2px");
    } else if (
      e.target.parentNode === document.getElementById("widget1inside")
    ) {
      setBorder("2px");
    } else {
      setBorder("0px");
    }
    console.log(e.target);
  };

  return (
    <ChakraProvider>
      <Rnd
        id="widget1big"
        default={{
          x: -400,
          y: -400,
          width: width,
          height: height,
        }}
        minWidth="125px"
        lockAspectRatio={true}
      >
        <Card
          id="widget1"
          padding="5%"
          borderWidth={borderW}
          borderColor={"skyblue"}
        >
          {children}
        </Card>
      </Rnd>
    </ChakraProvider>
  );
}
export default Widget;
