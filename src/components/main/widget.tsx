import * as React from "react";
import { Rnd } from "react-rnd";
import { useState } from "react";

interface WidgetProps {
  width: number;
  height: number;
  children: React.ReactNode;
}

function Widget({ width, height, children }: WidgetProps) {
  const [borderW, setBorder] = useState("2px");

  window.onclick = function (e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (
      target === document.getElementById("widget1") ||
      target === document.getElementById("widget1big")
    ) {
      setBorder("2px");
    } else if (
      target.parentNode === document.getElementById("widget1inside")
    ) {
      setBorder("2px");
    } else {
      setBorder("0px");
    }
    console.log(target);
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
        className="bg-white rounded-lg shadow-sm p-[5%] transition-all"
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
