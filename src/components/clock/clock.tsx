import * as React from "react";

import { useEffect, useState } from "react";
import Clock from "react-clock";
import "react-clock/dist/Clock.css";
// Removed Chakra UI imports

function Time() {
  const [value, setValue] = useState(new Date());
  const [formattedTime, setFormattedTime] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setValue(new Date());
    }, 500)

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const date = value;
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const miliseconds = date.getMilliseconds();

    const newFormat = hours >= 12 ? "PM" : "AM";
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? "0" + minutes : minutes;
    const formattedSeconds = seconds < 10 ? "0" + seconds : seconds;
    // const formattedMiliseconds = String(Math.floor(miliseconds / 10)).padStart(2, '0');

    setFormattedTime(
      `${formattedHours}:${formattedMinutes}:${formattedSeconds} ${newFormat}`
    );
  }, [value]);

  return (
    <>
      <div className="bg-soft-white rounded-lg shadow-sm border border-warm-gray-200 text-black w-full h-full">
        <div
          className="w-full h-full flex justify-center items-center p-1"
        >
          <div
            className="flex flex-col w-full h-full justify-center items-center"
          >
            {/* this doesnt work with swapy */}
            {/* <Box height="100%" style={{ aspectRatio: "1/1" }}>
              <Clock
                size="100%"
                value={value}
                renderNumbers={true}
                renderMinuteMarks={true}
                minuteMarksLength={5}
                renderHourMarks={true}
                renderSecondHand={true}
                className="jason"
              />
            </Box> */}
            <p className="text-black text-2xl">{formattedTime}</p>
          </div>
        </div>
      </div>
    </>
  );
}

export default Time;
