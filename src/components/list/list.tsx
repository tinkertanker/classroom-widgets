import { useState, useRef, useEffect } from "react";
import * as React from "react";

interface ListProps {
  toggleConfetti: (value: boolean) => boolean;
  savedState?: {
    inputs: string[];
    completed: boolean[];
  };
  onStateChange?: (state: any) => void;
}

const List: React.FC<ListProps> = ({ toggleConfetti, savedState, onStateChange }) => {
  const [inputs, setInputs] = useState<string[]>(savedState?.inputs || []);
  const [completed, setCompleted] = useState<boolean[]>(savedState?.completed || []);

  const inputRefs = useRef<HTMLInputElement[]>([]);

  // Notify parent of state changes
  const updateState = () => {
    if (onStateChange) {
      onStateChange({
        inputs: inputs,
        completed: completed
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
  }, [inputs, completed]);

  const handleAddInput = () => {
    setInputs((prevInputs) => {
      const newInputs = [...prevInputs, ""];
      setTimeout(() => {
        inputRefs.current[newInputs.length - 1]?.focus(); // Focus the last added input after updating state
      }, 0);
      return newInputs;
    });
    setCompleted([...completed, false]);
    toggleConfetti(false);
  };

  const handleInputChange = (index: number, value: string) => {
    const newInputs = [...inputs];
    newInputs[index] = value;
    setInputs(newInputs);
  };

  const toggleCompleted = (index: number) => {
    const updatedCompleted = [...completed];
    updatedCompleted[index] = !updatedCompleted[index];
    setCompleted(updatedCompleted);

    // get sum of all elements in completed using Number() [elements are true/false]
    const sumCompleted = updatedCompleted.reduce((sum, value) => sum + Number(value), 0);
    console.log(sumCompleted);

    if (inputs.length === sumCompleted && inputs.length > 0) {
      console.log('hi');
      // if (useConfetti) return;
      toggleConfetti(false);
      setTimeout(() => toggleConfetti(true), 1000);
    }
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
    const newCompleted = completed.filter((_, i) => i !== index);
    setInputs(newInputs);
    setCompleted(newCompleted);
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
      <div className="bg-soft-white rounded-lg shadow-sm border border-warm-gray-200 w-full h-full flex flex-col">
        <div className="flex-1 overflow-y-auto px-4 pt-4">
          <div className="pt-0">
            <div className="flex flex-col space-y-1 pt-0">
              {inputs.map((input, index) => (
                  <div className="flex flex-row items-center gap-1" key={index}>
                    <button
                        onClick={() => toggleCompleted(index)}
                        aria-label="Complete task"
                        className={`p-2 rounded transition-colors duration-200 ${
                          completed[index]
                            ? "bg-green-500 hover:bg-green-600 text-white"
                            : "bg-warm-gray-200 hover:bg-warm-gray-300 text-black"
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    <div className="relative flex-1">
                      <input
                        ref={(el) => (inputRefs.current[index] = el!)}
                        value={input}
                        onChange={(e) => handleInputChange(index, e.target.value)}
                        placeholder="Type away!"
                        className={`w-full px-3 py-2 pr-10 rounded text-warm-gray-800 placeholder-warm-gray-500 transition-colors duration-200 ${
                          completed[index]
                            ? "bg-green-100 hover:bg-green-200 line-through"
                            : "bg-warm-gray-100 hover:bg-warm-gray-200"
                        }`}
                      />
                      <button
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded text-warm-gray-800 hover:bg-dusty-rose-600 hover:text-white transition-colors duration-200"
                        aria-label="Delete Task"
                        onClick={() => handleDeleteInput(index)}
                        tabIndex={-1}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
              ))
            </div>
          </div>
        </div>
        <div className="p-4 border-t flex items-center">
          <button
            className="px-3 py-1.5 bg-sage-500 hover:bg-sage-600 text-white text-sm rounded transition-colors duration-200"
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
