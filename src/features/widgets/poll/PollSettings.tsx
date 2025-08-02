import React, { useState } from 'react';

interface PollSettingsProps {
  onClose: () => void;
  onSave?: (data: { question: string; options: string[] }) => void;
  initialData?: { question: string; options: string[] };
}

const PollSettings: React.FC<PollSettingsProps> = ({
  onClose,
  onSave,
  initialData
}) => {
  const pollData = initialData || { question: '', options: ['', ''] };
  const updatePoll = onSave;
  
  const [question, setQuestion] = useState(pollData.question || '');
  const [options, setOptions] = useState(pollData.options?.length > 0 ? pollData.options : ['', '']);

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const addOption = () => {
    setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };
  return (
    <div className="w-[500px] max-w-full">
      <div className="px-6 py-4">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-2">
              Question
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full px-3 py-2 border border-warm-gray-300 dark:border-warm-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-warm-gray-700 text-warm-gray-800 dark:text-warm-gray-200"
              placeholder="What's your poll question?"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-2">
              Options
            </label>
            {options.map((option, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  className="flex-1 px-3 py-2 border border-warm-gray-300 dark:border-warm-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-warm-gray-700 text-warm-gray-800 dark:text-warm-gray-200"
                  placeholder={`Option ${index + 1}`}
                />
                {options.length > 2 && (
                  <button
                    onClick={() => removeOption(index)}
                    className="px-3 py-2 bg-dusty-rose-500 hover:bg-dusty-rose-600 text-white rounded-md text-sm"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addOption}
              className="px-3 py-1.5 bg-sage-500 hover:bg-sage-600 text-white text-sm rounded transition-colors duration-200"
            >
              Add Option
            </button>
          </div>
          
          <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400 mt-4">
            Note: Remember to save your changes before closing this dialog.
          </p>
        </div>
      </div>
      <div className="px-6 pb-4 flex justify-center">
        <button
          onClick={() => {
            if (updatePoll) {
              updatePoll({ question, options });
            }
            onClose();
          }}
          className="px-3 py-1.5 bg-sage-500 hover:bg-sage-600 text-white text-sm rounded transition-colors duration-200"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default PollSettings;