import * as React from "react";
import { Rnd } from "react-rnd";
import { useState } from "react";

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
      <div
        id="widget1"
        className="bg-white rounded-lg shadow-md p-[5%] transition-all"
        style={{
          borderWidth: borderW,
          borderColor: borderW === "2px" ? "skyblue" : "transparent"
        }}
      >
        {children}
      </div>
    </Rnd>
  );
}
export default Widget;
