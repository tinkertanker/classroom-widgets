import React, { useState, useCallback } from 'react';
import { WidgetInput } from '@shared/components/WidgetInput';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';
import SavedCollectionsDialog from '@shared/components/SavedCollectionsDialog';
import { SavedPollQuestion } from '@shared/types/storage';

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
  const [showSavedDialog, setShowSavedDialog] = useState(false);

  const { savePollQuestion, getPollQuestions, deletePollQuestion } = useWorkspaceStore();

  const handleSaveToCollection = useCallback((name: string) => {
    if (question && options.filter(o => o).length > 0) {
      savePollQuestion(name, question, options.filter(o => o));
    }
  }, [question, options, savePollQuestion]);

  const handleLoadFromCollection = useCallback((item: SavedPollQuestion) => {
    setQuestion(item.question);
    setOptions(item.options);
    setShowSavedDialog(false);
  }, []);

  const handleDeleteFromCollection = useCallback((id: string) => {
    deletePollQuestion(id);
  }, [deletePollQuestion]);

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
          {/* Saved Polls button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowSavedDialog(true)}
              className="px-3 py-1.5 text-sm bg-warm-gray-100 hover:bg-warm-gray-200 dark:bg-warm-gray-700 dark:hover:bg-warm-gray-600 text-warm-gray-700 dark:text-warm-gray-300 rounded-md transition-colors"
            >
              Saved Polls
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-2">
              Question
            </label>
            <WidgetInput
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What's your poll question?"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-2">
              Options
            </label>
            {options.map((option, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <WidgetInput
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  className="flex-1"
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

      {/* Saved collections dialog */}
      {showSavedDialog && (
        <SavedCollectionsDialog
          type="poll"
          items={getPollQuestions()}
          currentItemCount={question && options.filter(o => o).length > 0 ? 1 : 0}
          defaultSaveName={question}
          onSave={handleSaveToCollection}
          onLoad={handleLoadFromCollection}
          onDelete={handleDeleteFromCollection}
          onClose={() => setShowSavedDialog(false)}
        />
      )}
    </div>
  );
};

export default PollSettings;