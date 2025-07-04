import { v4 as uuidv4 } from 'uuid'; // Import UUID package
import React from 'react';

export default function Toolbar({setComponentList,activeIndex,setActiveIndex,hoveringTrash}) {

  const ComponentNames = [
    "Randomiser",
    "Timer",
    "List",
    "Work Symbols",
    "Clock",
    "Traffic Light",
    "Loudness Monitor",
    "Link Shortener",
  ];

  return (
    <div className="w-[90%] h-full bg-white rounded-lg shadow-md">
      <div className="w-full h-full px-2.5 py-0">
        <div className="flex items-center justify-start w-full h-full overflow-x-auto overflow-y-visible space-x-2">
          {ComponentNames.map((ComponentName, index) => (
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
              className="px-4 py-2 bg-teal-500 text-white rounded-md hover:bg-teal-600 transition-colors duration-200 text-xs sm:text-sm md:text-base lg:text-lg xl:text-lg flex-shrink-0"
            >
              {ComponentName}
            </button>
          ))}
          <div className="flex justify-end">
            <svg
              id="trash"
              className={`w-6 h-6 cursor-pointer transition-all duration-200 ${
                hoveringTrash 
                  ? 'text-red-500 transform scale-125' 
                  : 'text-gray-500'
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
