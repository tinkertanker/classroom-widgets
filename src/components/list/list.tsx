import { useState, useRef, useEffect } from "react";
import * as React from "react";

interface ListProps {
  savedState?: {
    inputs: string[];
    statuses: number[];
  };
  onStateChange?: (state: any) => void;
}

const List: React.FC<ListProps> = ({ savedState, onStateChange }) => {
  const [inputs, setInputs] = useState<string[]>(savedState?.inputs || []);
  const [statuses, setStatuses] = useState<number[]>(savedState?.statuses || []); // 0: none, 1: green, 2: yellow, 3: red, 4: faded
  const [isLarge, setIsLarge] = useState(false);

  const inputRefs = useRef<HTMLInputElement[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Notify parent of state changes
  const updateState = () => {
    if (onStateChange) {
      onStateChange({
        inputs: inputs,
        statuses: statuses
      });
    }
  };

  // Update state whenever any value changes (skip initial render)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    updateState();
  }, [inputs, statuses]);

  // Detect widget size
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        // Consider "large" when width is greater than 400px
        setIsLarge(width > 400);
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const handleAddInput = () => {
    setInputs((prevInputs) => {
      const newInputs = [...prevInputs, ""];
      setTimeout(() => {
        inputRefs.current[newInputs.length - 1]?.focus(); // Focus the last added input after updating state
      }, 0);
      return newInputs;
    });
    setStatuses([...statuses, 0]);
  };

  const handleInputChange = (index: number, value: string) => {
    const newInputs = [...inputs];
    newInputs[index] = value;
    setInputs(newInputs);
  };

  const cycleStatus = (index: number) => {
    const updatedStatuses = [...statuses];
    updatedStatuses[index] = (updatedStatuses[index] + 1) % 5; // Cycle through 0, 1, 2, 3, 4
    setStatuses(updatedStatuses);
  };
  // useEffect(() => {
  //   const savedInputs =       JSON.parse(localStorage.getItem('inputs') || '[]');
  //   const savedCompleted =    JSON.parse(localStorage.getItem('completed') || '[]');
  //   const savedHideComplete = JSON.parse(localStorage.getItem('hideComplete') || 'false');
  //   const savedIsChecklist =  JSON.parse(localStorage.getItem('isChecklist') || 'true');

  //   setInputs(savedInputs);
  //   setCompleted(savedCompleted);
  //   setHideComplete(savedHideComplete);
  //   setIsChecklist(savedIsChecklist);
  // }, []);


  const handleDeleteInput = (index: number) => {
    const newInputs = inputs.filter((_, i) => i !== index);
    const newStatuses = statuses.filter((_, i) => i !== index);
    setInputs(newInputs);
    setStatuses(newStatuses);
  };


  // // LOCAL STORAGE
  // useEffect(() => {
  //   localStorage.setItem('title', localTitle);
  // }, [localTitle]);

  // useEffect(() => {
  //   localStorage.setItem('inputs', JSON.stringify(inputs));
  // }, [inputs]);

  // useEffect(() => {
  //   localStorage.setItem('completed', JSON.stringify(completed));
  // }, [completed]);

  // useEffect(() => {
  //   localStorage.setItem('hideComplete', JSON.stringify(hideComplete));
  // }, [hideComplete]);

  // useEffect(() => {
  //   localStorage.setItem('isChecklist', JSON.stringify(isChecklist));
  // }, [isChecklist]);

  return (
    <>
      <div ref={containerRef} className="bg-soft-white rounded-lg shadow-sm border border-warm-gray-200 w-full h-full flex flex-col">
        <div className="flex-1 overflow-y-auto px-4 pt-4">
          <div className="pt-0">
            <div className={`flex flex-col pt-0 ${isLarge ? "space-y-2" : "space-y-1"}`}>
              {inputs.map((input, index) => (
                  <div className="flex flex-row items-center gap-1" key={index}>
                    <button
                        onClick={() => cycleStatus(index)}
                        aria-label="Cycle status"
                        className={`rounded-full flex-shrink-0 transition-colors duration-200 ${
                          statuses[index] === 1 ? "bg-green-500 hover:bg-green-600" :
                          statuses[index] === 2 ? "bg-yellow-500 hover:bg-yellow-600" :
                          statuses[index] === 3 ? "bg-red-500 hover:bg-red-600" :
                          statuses[index] === 4 ? "bg-warm-gray-400 hover:bg-warm-gray-500" :
                          "bg-warm-gray-200 hover:bg-warm-gray-300"
                        } ${
                          isLarge ? "w-12 h-12" : "w-8 h-8"
                        }`}
                      >
                      </button>
                    <div className="relative flex-1">
                      <input
                        ref={(el) => (inputRefs.current[index] = el!)}
                        value={input}
                        onChange={(e) => handleInputChange(index, e.target.value)}
                        placeholder="Type away!"
                        className={`w-full px-3 pr-10 rounded placeholder-warm-gray-500 transition-colors duration-200 ${
                          statuses[index] === 1 ? "bg-green-100 hover:bg-green-200 text-warm-gray-800" :
                          statuses[index] === 2 ? "bg-yellow-100 hover:bg-yellow-200 text-warm-gray-800" :
                          statuses[index] === 3 ? "bg-red-100 hover:bg-red-200 text-warm-gray-800" :
                          statuses[index] === 4 ? "bg-warm-gray-100 hover:bg-warm-gray-200 text-warm-gray-300" :
                          "bg-warm-gray-100 hover:bg-warm-gray-200 text-warm-gray-800"
                        } ${
                          isLarge ? "text-lg py-3" : "text-sm py-2"
                        }`}
                      />
                      <button
                        className={`absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-dusty-rose-600 hover:text-white transition-colors duration-200 ${
                          statuses[index] === 4 ? "text-warm-gray-300" : "text-warm-gray-800"
                        }`}
                        aria-label="Delete Task"
                        onClick={() => handleDeleteInput(index)}
                        tabIndex={-1}
                      >
                        <svg className={isLarge ? "w-5 h-5" : "w-4 h-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4 border-t flex items-center">
          <button
            className={`px-3 bg-sage-500 hover:bg-sage-600 text-white rounded transition-colors duration-200 ${
              isLarge ? "text-base py-2" : "text-sm py-1.5"
            }`}
            onClick={handleAddInput}
          >
            Add Item
          </button>
        </div>
      </div>
    </>
  );
};

export default List;
