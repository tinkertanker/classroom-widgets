import { useState, useRef, useEffect } from "react";

import * as React from "react";
import AlertDialogExample from "../main/alert.tsx";

interface ListProps {
  title: string;
  toggleConfetti: (value: boolean) => boolean;
}

const List: React.FC<ListProps> = ({ title="", toggleConfetti }) => {
  const [localTitle, setLocalTitle] =     useState<string>(/*localStorage.getItem('title') ||*/ title);
  const [inputs, setInputs] =             useState<string[]>(/*JSON.parse(localStorage.getItem('inputs') ||*/ []);
  const [completed, setCompleted] =       useState<boolean[]>(/*JSON.parse(localStorage.getItem('completed') ||*/ []);
  const [hideComplete, setHideComplete] = useState<boolean>(/*JSON.parse(localStorage.getItem('hideComplete') ||*/ false);
  const [isChecklist, setIsChecklist] =   useState<boolean>(/*JSON.parse(localStorage.getItem('isChecklist') ||*/ true);

  const [isOpen, setIsOpen] = useState(false);
  const onOpen = () => setIsOpen(true);
  const onClose = () => setIsOpen(false);
  const initialFocus = React.useRef(null);
  const inputRefs = useRef<HTMLInputElement[]>([]);

  const handleRadioChange = (value: string) => {
    setIsChecklist(value === '1');
  };

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

  const handleDeleteConfirm = (confirm: boolean) => {
    if (confirm) {
      setInputs([]);
      setCompleted([]);
      onClose();
    }
  };

  const handleHideCompletedItemsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setHideComplete(event.target.checked);
  };

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
        <div className="px-4 pt-4 pb-2">
          <input
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            placeholder="Title"
            className="w-full text-2xl font-bold text-warm-gray-800 placeholder-gray-400 border-b border-warm-gray-300 focus:border-blue-500 focus:outline-none px-1 py-1"
          />
        </div>
        <div className="flex-1 overflow-y-auto mt-2 px-4">
          <div className="pt-0">
            <div className="flex flex-col space-y-1 pt-0">
              {inputs.map((input, index) =>
                hideComplete && completed[index] && isChecklist ? null : (
                  <div className="flex flex-row items-center gap-1" key={index}>
                    {isChecklist ? (
                      <button
                        onClick={() => toggleCompleted(index)}
                        aria-label="Complete task"
                        className={`p-2 rounded transition-colors duration-200 ${
                          completed[index] && isChecklist
                            ? "bg-green-500 hover:bg-green-600 text-white"
                            : "bg-warm-gray-200 hover:bg-warm-gray-300 text-black"
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    ) : null}
                    <div className="relative flex-1">
                      <input
                        ref={(el) => (inputRefs.current[index] = el!)}
                        value={input}
                        onChange={(e) => handleInputChange(index, e.target.value)}
                        placeholder="Type away!"
                        className={`w-full px-3 py-2 pr-10 rounded text-warm-gray-800 placeholder-warm-gray-500 transition-colors duration-200 ${
                          completed[index] && isChecklist
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
                )
              )}
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
          <button
            aria-label="Settings"
            className="ml-auto p-2 bg-warm-gray-800 hover:bg-warm-gray-700 text-white rounded transition-colors duration-200"
            onClick={onOpen}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>
      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={onClose}
          />
          
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-soft-white rounded-lg shadow-xl max-w-md w-full">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <p className="text-base font-semibold text-warm-gray-800">Settings</p>
                <button
                  onClick={onClose}
                  className="text-warm-gray-500 hover:text-warm-gray-700"
                >
                  ✕
                </button>
              </div>
              <div className="px-6 py-4">
                <div className="flex flex-col space-y-4">
                  <h3 className="text-sm font-semibold text-warm-gray-800">List Settings</h3>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={hideComplete}
                      onChange={handleHideCompletedItemsChange}
                      className="mr-2 w-4 h-4 text-blue-600 border-warm-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-warm-gray-700 text-sm">Hide Completed Items</span>
                  </label>
                  <p className="text-warm-gray-700 text-sm">List Type</p>
                  <div className="flex flex-row space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="listType"
                        value="1"
                        checked={isChecklist}
                        onChange={() => handleRadioChange("1")}
                        className="mr-2"
                      />
                      <span className="text-warm-gray-700 text-sm">Checklist</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="listType"
                        value="2"
                        checked={!isChecklist}
                        onChange={() => handleRadioChange("2")}
                        className="mr-2"
                      />
                      <span className="text-warm-gray-700 text-sm">Normal List</span>
                    </label>
                  </div>
                  <h3 className="text-sm font-semibold text-warm-gray-800">Item Settings</h3>
                  <AlertDialogExample onDeleteConfirm={handleDeleteConfirm} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default List;
