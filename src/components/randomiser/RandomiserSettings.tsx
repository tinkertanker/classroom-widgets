import React, { useState } from 'react';

interface RandomiserSettingsProps {
  input: string;
  setInput: (value: string) => void;
  setChoices: (choices: string[]) => void;
  setSelected: (selected: string[]) => void;
  remember: boolean;
  setRemember: (value: boolean) => void;
  selected: string[];
  animation: boolean;
  setAnimation: (value: boolean) => void;
  animationspeed: number;
  setAnimationspeed: (value: number) => void;
}

const RandomiserSettings: React.FC<RandomiserSettingsProps> = ({
  input,
  setInput,
  setChoices,
  setSelected,
  remember,
  setRemember,
  selected,
  animation,
  setAnimation,
  animationspeed,
  setAnimationspeed
}) => {
  const [tabIndex, setTabIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="w-[450px] max-w-full">
      <div className="px-6 py-4 border-b">
        <div className="flex space-x-4">
          <button
            className={`pb-2 border-b-2 text-sm ${tabIndex === 0 ? 'border-blue-500 text-blue-500' : 'border-transparent text-warm-gray-700 dark:text-warm-gray-300'}`}
            onClick={() => setTabIndex(0)}
          >
            List
          </button>
          <button
            className={`pb-2 border-b-2 text-sm ${tabIndex === 1 ? 'border-blue-500 text-blue-500' : 'border-transparent text-warm-gray-700 dark:text-warm-gray-300'}`}
            onClick={() => setTabIndex(1)}
          >
            Settings
          </button>
        </div>
      </div>
      <div className="h-[500px] overflow-y-auto px-6 py-4">
        {tabIndex === 0 ? (
          <div className="flex flex-col space-y-4">
            <div className="flex flex-row items-center justify-between pb-5">
              <h3 className="text-base font-semibold text-warm-gray-800 dark:text-warm-gray-200">My list</h3>
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
                          setInput("1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15\n16\n17\n18\n19\n20\n21\n22\n23\n24\n25\n26\n27\n28\n29\n30");
                          setMenuOpen(false);
                        }}
                      >
                        Generate numbers 1 to 30
                      </button>
                      <button
                        className="w-full text-left px-4 py-2 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-600 text-warm-gray-800 dark:text-warm-gray-200 text-sm"
                        onClick={() => {
                          setInput("A\nB\nC\nD\nE\nF\nG\nH\nI\nJ\nK\nL\nM\nN\nO\nP\nQ\nR\nS\nT\nU\nV\nW\nX\nY\nZ");
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
                    setInput("");
                    setChoices([]);
                    setSelected([]);
                  }}
                >
                  Clear list
                </button>
              </div>
            </div>

            <textarea
              onChange={(e) => setInput(e.target.value)}
              value={input}
              id="textarea"
              placeholder="Start typing a list to randomise..."
              className="w-full h-[250px] px-3 py-2 border border-warm-gray-300 dark:border-warm-gray-600 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-warm-gray-700 text-warm-gray-800 dark:text-warm-gray-200 text-sm placeholder-warm-gray-500 dark:placeholder-warm-gray-400"
            />
            <p className="pt-8 text-sm text-warm-gray-600 dark:text-warm-gray-400">
              Note: All leading and trailing spaces, empty rows, and
              duplicates in the list are automatically removed when
              generating.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-start space-y-4">
              <h3 className="text-base font-semibold text-warm-gray-800 dark:text-warm-gray-200">Randomiser Settings</h3>

              <label className="flex items-center pt-5">
                <input
                  type="checkbox"
                  defaultChecked={remember}
                  onChange={(e) => {
                    setRemember(e.target.checked);
                    if (e.target.checked === false) {
                      setSelected([]);
                    }
                  }}
                  className="mr-2 w-4 h-4 text-terracotta-500 border-warm-gray-300 rounded focus:ring-terracotta-500"
                />
                <span className="text-warm-gray-700 dark:text-warm-gray-300 text-sm">Prevent picked options from repeating</span>
              </label>
              <p className="pt-2.5 pb-1.5 text-warm-gray-700 dark:text-warm-gray-300 text-sm">
                Options removed: {selected.join(", ")}
              </p>
            </div>
            <div className="flex flex-col items-start space-y-4">
              <h3 className="text-base font-semibold text-warm-gray-800 dark:text-warm-gray-200">Animation Settings</h3>
              <label className="flex items-center pt-2.5">
                <input
                  type="checkbox"
                  defaultChecked={animation}
                  onChange={(e) => {
                    setAnimation(e.target.checked);
                  }}
                  className="mr-2 w-4 h-4 text-terracotta-500 border-warm-gray-300 rounded focus:ring-terracotta-500"
                />
                <span className="text-warm-gray-700 dark:text-warm-gray-300 text-sm">Enable Animation</span>
              </label>
              <p className="pt-2.5 pb-1.5 text-warm-gray-700 dark:text-warm-gray-300 text-sm">
                Animation Duration
              </p>
              <div className="w-full relative pt-8">
                <input
                  type="range"
                  disabled={!animation}
                  defaultValue={15}
                  min={5}
                  max={30}
                  onChange={(e) => setAnimationspeed(Number(e.target.value) / 300)}
                  className={`w-full h-2 bg-warm-gray-200 dark:bg-warm-gray-600 rounded-lg appearance-none cursor-pointer ${!animation ? 'opacity-50' : ''}`}
                />
                <div className="flex justify-between text-sm mt-2">
                  <span className="ml-[-12px] text-warm-gray-600 dark:text-warm-gray-400">Short</span>
                  <span className="ml-[-24px] text-warm-gray-600 dark:text-warm-gray-400">Medium</span>
                  <span className="ml-[-14px] text-warm-gray-600 dark:text-warm-gray-400">Long</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="px-6 py-3 border-t"></div>
    </div>
  );
};

export default RandomiserSettings;