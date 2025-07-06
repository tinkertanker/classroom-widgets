import React, { useState, useEffect } from 'react';

interface RandomiserSettingsProps {
  input: string;
  setInput: (value: string) => void;
  setChoices: (choices: string[]) => void;
  removed: string[];
  setRemoved: (removed: string[]) => void;
  onClose?: () => void;
}

const RandomiserSettings: React.FC<RandomiserSettingsProps> = ({
  input,
  setInput,
  setChoices,
  removed,
  setRemoved,
  onClose
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [localInput, setLocalInput] = useState(input);

  // Sync local state when parent input changes (e.g., when modal reopens)
  useEffect(() => {
    setLocalInput(input);
  }, [input]);

  const handleRestoreAll = () => {
    if (removed.length > 0) {
      // Add removed items back to input
      const currentItems = localInput.trim() ? localInput + '\n' : '';
      const newInput = currentItems + removed.join('\n');
      setLocalInput(newInput);
      setInput(newInput);
      setRemoved([]);
    }
  };

  const handleBlur = () => {
    // Update parent state when textarea loses focus
    setInput(localInput);
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
                        setLocalInput(numbers);
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
                        setLocalInput(alphabet);
                        setInput(alphabet);
                        setMenuOpen(false);
                      }}
                    >
                      Generate the alphabet
                    </button>
                  </div>
                )}
              </div>
              <button
                className="px-3 py-1.5 bg-dusty-rose-500 hover:bg-dusty-rose-600 dark:bg-dusty-rose-600 dark:hover:bg-dusty-rose-700 text-white text-sm rounded transition-colors duration-200"
                onClick={() => {
                  setLocalInput("");
                  setInput("");
                  setChoices([]);
                  setRemoved([]);
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
                onChange={(e) => setLocalInput(e.target.value)}
                onBlur={handleBlur}
                value={localInput}
                id="textarea"
                placeholder="Start typing a list to randomise..."
                className="w-full h-[300px] px-3 py-2 border border-warm-gray-300 dark:border-warm-gray-600 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-warm-gray-700 text-warm-gray-800 dark:text-warm-gray-200 text-sm placeholder-warm-gray-500 dark:placeholder-warm-gray-400"
              />
            </div>
            
            <div className="flex flex-col justify-center">
              <button
                onClick={handleRestoreAll}
                disabled={removed.length === 0}
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
                value={removed.join('\n')}
                readOnly
                placeholder="Removed items will appear here..."
                className="w-full h-[300px] px-3 py-2 border border-warm-gray-300 dark:border-warm-gray-600 rounded-md resize-none bg-warm-gray-50 dark:bg-warm-gray-900 text-warm-gray-800 dark:text-warm-gray-200 text-sm placeholder-warm-gray-500 dark:placeholder-warm-gray-400 cursor-not-allowed"
              />
            </div>
          </div>
          
          <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
            Note: All leading and trailing spaces, empty rows, and duplicates in the list are automatically removed when generating.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RandomiserSettings;