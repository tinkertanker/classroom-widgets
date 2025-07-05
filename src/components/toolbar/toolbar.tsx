import { v4 as uuidv4 } from 'uuid'; // Import UUID package
import React, { useState, useEffect } from 'react';
import { 
  FaDice,           // Randomiser
  FaClock,          // Timer
  FaListCheck,      // List
  FaUserGroup,      // Work Symbols
  FaTrafficLight,   // Traffic Light
  FaVolumeHigh,     // Loudness Monitor
  FaLink            // Link Shortener
} from 'react-icons/fa6';

export default function Toolbar({setComponentList,activeIndex,setActiveIndex,hoveringTrash}) {
  const [formattedTime, setFormattedTime] = useState("");
  const [colonVisible, setColonVisible] = useState(true);

  useEffect(() => {
    const updateTime = () => {
      const date = new Date();
      const hours = date.getHours();
      const minutes = date.getMinutes();

      const formattedHours = hours % 12 || 12;
      const formattedMinutes = minutes < 10 ? "0" + minutes : minutes;

      setFormattedTime(
        `${formattedHours}:${formattedMinutes}`
      );
    };

    updateTime(); // Initial update
    const interval = setInterval(updateTime, 500);

    return () => clearInterval(interval);
  }, []);

  // Separate effect for blinking colon
  useEffect(() => {
    const interval = setInterval(() => {
      setColonVisible(prev => !prev);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const ComponentData = [
    { name: "Randomiser", icon: FaDice },
    { name: "Timer", icon: FaClock },
    { name: "List", icon: FaListCheck },
    { name: "Work Symbols", icon: FaUserGroup },
    { name: "Traffic Light", icon: FaTrafficLight },
    { name: "Loudness Monitor", icon: FaVolumeHigh },
    { name: "Link Shortener", icon: FaLink },
  ];

  return (
    <div className="w-[90%] h-full bg-soft-white rounded-lg shadow-sm border border-warm-gray-200">
      <div className="w-full h-full px-2.5 py-0">
        <div className="flex items-center justify-start w-full h-full overflow-x-auto overflow-y-visible space-x-2">
          {ComponentData.map((component, index) => {
            const Icon = component.icon;
            return (
              <button
                key={index}
                onClick={() => {
                  const element = document.getElementById(activeIndex!);
                  if (element) {
                    const { x, y } = element.getBoundingClientRect();
                    if (x === 10 && y === 10) {
                      setActiveIndex(null);
                    }
                  }
                  setComponentList((e) => [...e, { id: uuidv4(), index }]);
                }}
                className="px-3 py-2 bg-sage-500 text-white rounded-md hover:bg-sage-600 transition-colors duration-200 text-xs sm:text-sm md:text-base lg:text-lg xl:text-lg flex-shrink-0 inline-flex items-center gap-2"
              >
                <Icon className="w-4 h-4" />
                <span>{component.name}</span>
              </button>
            );
          })}
          <div className="flex items-center space-x-4 ml-auto">
            <div className="bg-warm-gray-900 text-sage-400 px-3 py-1 rounded font-mono text-lg tracking-wider whitespace-nowrap">
              {formattedTime.split(':').map((part, index) => (
                <React.Fragment key={index}>
                  {index > 0 && (
                    <span className={`${colonVisible ? 'opacity-100' : 'opacity-0'} transition-opacity duration-100`}>
                      :
                    </span>
                  )}
                  <span>{part}</span>
                </React.Fragment>
              ))}
            </div>
            <svg
              id="trash"
              className={`w-6 h-6 cursor-pointer transition-all duration-200 ${
                hoveringTrash 
                  ? 'text-dusty-rose-500 transform scale-125' 
                  : 'text-warm-gray-500'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );

}
