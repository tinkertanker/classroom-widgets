import React, { useState, useEffect } from 'react';

interface RandomiserSettingsProps {
  choices: string[];
  removedChoices: string[];
  onUpdateChoices: (choices: string[]) => void;
  onUpdateRemovedChoices: (removedChoices: string[]) => void;
  onSave?: (activeChoices: string[]) => void;
  onClose?: () => void;
}

const RandomiserSettings: React.FC<RandomiserSettingsProps> = ({
  choices,
  removedChoices,
  onUpdateChoices,
  onUpdateRemovedChoices,
  onSave,
  onClose
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [input, setInput] = useState(choices.join('\n'));
  const [removedInput, setRemovedInput] = useState(removedChoices.join('\n'));

  const handleRestoreAll = () => {
    if (removedInput.trim()) {
      // Add removed items back to input
      const currentItems = input.trim() ? input + '\n' : '';
      const newInput = currentItems + removedInput;
      setInput(newInput);
      setRemovedInput('');
    }
  };

  // Process and update choices whenever input changes
  useEffect(() => {
    let processedChoices = input.split('\n');
    processedChoices = processedChoices.map(value => value.trim());
    processedChoices = processedChoices.filter((value, index, array) => {
      if (value === '') return false;
      if (array.indexOf(value) !== index) return false;
      return true;
    });
    onUpdateChoices(processedChoices);
  }, [input, onUpdateChoices]);

  // Update removed choices whenever removedInput changes
  useEffect(() => {
    let processedRemoved = removedInput.split('\n');
    processedRemoved = processedRemoved.map(value => value.trim());
    processedRemoved = processedRemoved.filter(value => value !== '');
    onUpdateRemovedChoices(processedRemoved);
  }, [removedInput, onUpdateRemovedChoices]);

  // Helper to process choices from input string
  const processChoicesFromInput = (inputStr: string) => {
    let processed = inputStr.split('\n');
    processed = processed.map(value => value.trim());
    processed = processed.filter((value, index, array) => {
      if (value === '') return false;
      if (array.indexOf(value) !== index) return false;
      return true;
    });
    return processed;
  };

  // Helper to get active choices (excluding removed)
  const getActiveChoicesFromInputs = () => {
    const currentChoices = processChoicesFromInput(input);
    const currentRemoved = processChoicesFromInput(removedInput);
    return currentChoices.filter(choice => !currentRemoved.includes(choice));
  };

  const handleSave = () => {
    const activeChoices = getActiveChoicesFromInputs();
    onSave?.(activeChoices);
  };

  return (
    <div className="w-[700px] max-w-full">
      <div className="px-6 py-4">
        <div className="flex flex-col space-y-4">
          <div className="flex flex-row items-center justify-between">
            <h3 className="text-base font-semibold text-warm-gray-800 dark:text-warm-gray-200">Randomiser Lists</h3>
            <div className="flex space-x-2">
              <div className="relative">
                <button
                  className="px-3 py-1.5 bg-terracotta-500 hover:bg-terracotta-600 dark:bg-terracotta-600 dark:hover:bg-terracotta-700 text-white text-sm rounded transition-colors duration-200 inline-flex items-center"
                  onClick={() => setMenuOpen(!menuOpen)}
                >
                  Suggestions
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {menuOpen && (
                  <div className="absolute mt-1 w-full bg-soft-white dark:bg-warm-gray-700 rounded-md shadow-lg z-10">
                    <button
                      className="w-full text-left px-4 py-2 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-600 text-warm-gray-800 dark:text-warm-gray-200 text-sm"
                      onClick={() => {
                        const numbers = "1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15\n16\n17\n18\n19\n20\n21\n22\n23\n24\n25\n26\n27\n28\n29\n30";
                        setInput(numbers);
                        setMenuOpen(false);
                      }}
                    >
                      Generate numbers 1 to 30
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-600 text-warm-gray-800 dark:text-warm-gray-200 text-sm"
                      onClick={() => {
                        const alphabet = "A\nB\nC\nD\nE\nF\nG\nH\nI\nJ\nK\nL\nM\nN\nO\nP\nQ\nR\nS\nT\nU\nV\nW\nX\nY\nZ";
                        setInput(alphabet);
                        setMenuOpen(false);
                      }}
                    >
                      Generate the alphabet
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-600 text-warm-gray-800 dark:text-warm-gray-200 text-sm"
                      onClick={() => {
                        const fruits = "Apple\nBanana\nOrange\nMango\nStrawberry\nGrapes\nWatermelon\nPineapple\nPeach\nCherry";
                        setInput(fruits);
                        setMenuOpen(false);
                      }}
                    >
                      Generate fruits
                    </button>
                  </div>
                )}
              </div>
              <button
                className="px-3 py-1.5 bg-dusty-rose-500 hover:bg-dusty-rose-600 dark:bg-dusty-rose-600 dark:hover:bg-dusty-rose-700 text-white text-sm rounded transition-colors duration-200"
                onClick={() => {
                  setInput("");
                  setRemovedInput("");
                }}
              >
                Clear all
              </button>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-2 block">
                Active Items
              </label>
              <textarea
                onChange={(e) => setInput(e.target.value)}
                value={input}
                id="textarea"
                placeholder="Start typing a list to randomise..."
                className="w-full h-[300px] px-3 py-2 border border-warm-gray-300 dark:border-warm-gray-600 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-warm-gray-700 text-warm-gray-800 dark:text-warm-gray-200 text-sm placeholder-warm-gray-500 dark:placeholder-warm-gray-400"
              />
            </div>
            
            <div className="flex flex-col justify-center">
              <button
                onClick={handleRestoreAll}
                disabled={!removedInput.trim()}
                className="px-3 py-2 bg-sage-500 hover:bg-sage-600 dark:bg-sage-600 dark:hover:bg-sage-700 text-white rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Restore all removed items"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1">
              <label className="text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-2 block">
                Removed Items
              </label>
              <textarea
                value={removedInput}
                onChange={(e) => setRemovedInput(e.target.value)}
                placeholder="Removed items will appear here..."
                className="w-full h-[300px] px-3 py-2 border border-warm-gray-300 dark:border-warm-gray-600 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-warm-gray-700 text-warm-gray-800 dark:text-warm-gray-200 text-sm placeholder-warm-gray-500 dark:placeholder-warm-gray-400"
              />
            </div>
          </div>
          
          <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
            Note: All leading and trailing spaces, empty rows, and duplicates in the list are automatically removed when generating.
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-warm-gray-200 dark:border-warm-gray-600">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 rounded transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm bg-sage-500 hover:bg-sage-600 dark:bg-sage-600 dark:hover:bg-sage-700 text-white rounded transition-colors duration-200"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RandomiserSettings;