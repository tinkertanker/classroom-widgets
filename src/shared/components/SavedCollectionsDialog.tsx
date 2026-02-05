// SavedCollectionsDialog - Shared dialog for saving/loading reusable content

import React, { useState } from 'react';
import { SavedRandomiserList, SavedQuestionBank, SavedPollQuestion } from '../types/storage';
import ModalDialog from './ModalDialog';

type SavedItem = SavedRandomiserList | SavedQuestionBank | SavedPollQuestion;

interface SavedCollectionsDialogPropsBase {
  currentItemCount: number;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

interface SavedCollectionsDialogPropsRandomiser extends SavedCollectionsDialogPropsBase {
  type: 'randomiser';
  items: SavedRandomiserList[];
  onLoad: (item: SavedRandomiserList) => void;
}

interface SavedCollectionsDialogPropsQuestions extends SavedCollectionsDialogPropsBase {
  type: 'questions';
  items: SavedQuestionBank[];
  onLoad: (item: SavedQuestionBank) => void;
}

interface SavedCollectionsDialogPropsPoll extends SavedCollectionsDialogPropsBase {
  type: 'poll';
  items: SavedPollQuestion[];
  onLoad: (item: SavedPollQuestion) => void;
}

type SavedCollectionsDialogProps =
  | SavedCollectionsDialogPropsRandomiser
  | SavedCollectionsDialogPropsQuestions
  | SavedCollectionsDialogPropsPoll;

const SavedCollectionsDialog: React.FC<SavedCollectionsDialogProps> = ({
  type,
  items,
  currentItemCount,
  onSave,
  onLoad,
  onDelete,
  onClose,
}) => {
  const [mode, setMode] = useState<'list' | 'save'>('list');
  const [saveName, setSaveName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const getLabels = () => {
    switch (type) {
      case 'randomiser':
        return { title: 'Saved Lists', itemLabel: 'list', itemLabelPlural: 'lists', saveHint: 'choices' };
      case 'questions':
        return { title: 'Saved Question Banks', itemLabel: 'question bank', itemLabelPlural: 'question banks', saveHint: 'questions' };
      case 'poll':
        return { title: 'Saved Poll Questions', itemLabel: 'poll', itemLabelPlural: 'polls', saveHint: 'poll question' };
    }
  };

  const { title, itemLabel, itemLabelPlural, saveHint } = getLabels();

  const handleSave = () => {
    if (!saveName.trim()) return;
    onSave(saveName.trim());
    setSaveName('');
    setMode('list');
  };

  const handleDelete = (id: string) => {
    onDelete(id);
    setDeleteConfirmId(null);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getItemCount = (item: SavedItem) => {
    if (item.type === 'randomiser') {
      return (item as SavedRandomiserList).choices.length;
    }
    if (item.type === 'questions') {
      return (item as SavedQuestionBank).questions.length;
    }
    // Poll: show number of options
    return (item as SavedPollQuestion).options.length;
  };

  const getItemDescription = (item: SavedItem) => {
    const count = getItemCount(item);
    if (item.type === 'poll') {
      return `${count} option${count === 1 ? '' : 's'}`;
    }
    return `${count} item${count === 1 ? '' : 's'}`;
  };

  const footer = (
    <div className="flex justify-between items-center">
      <div className="text-sm text-warm-gray-500 dark:text-warm-gray-400">
        {items.length} saved {items.length === 1 ? itemLabel : itemLabelPlural}
      </div>
      <div className="flex gap-2">
        {mode === 'list' ? (
          <button
            onClick={() => setMode('save')}
            disabled={currentItemCount === 0}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-warm-gray-300 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors"
          >
            Save Current
          </button>
        ) : (
          <>
            <button
              onClick={() => setMode('list')}
              className="px-4 py-2 bg-warm-gray-200 hover:bg-warm-gray-300 dark:bg-warm-gray-700 dark:hover:bg-warm-gray-600 text-warm-gray-700 dark:text-warm-gray-200 rounded-md text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!saveName.trim()}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-warm-gray-300 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors"
            >
              Save
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <ModalDialog
      title={title}
      onClose={onClose}
      footer={footer}
      maxHeight="500px"
      className="w-[450px]"
    >
      {mode === 'save' ? (
        <div className="p-6">
          <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-2">
            Name for this {itemLabel}
          </label>
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder={`My ${itemLabel}...`}
            maxLength={100}
            autoFocus
            className="w-full px-3 py-2 border border-warm-gray-300 dark:border-warm-gray-600 rounded-md bg-white dark:bg-warm-gray-700 text-warm-gray-800 dark:text-warm-gray-100 placeholder-warm-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-2 text-sm text-warm-gray-500 dark:text-warm-gray-400">
            Saving current {saveHint}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-warm-gray-200 dark:divide-warm-gray-700">
          {items.length === 0 ? (
            <div className="p-8 text-center text-warm-gray-500 dark:text-warm-gray-400">
              <p className="mb-2">No saved {itemLabelPlural} yet</p>
              <p className="text-sm">
                Click "Save Current" to save your current {saveHint}
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 hover:bg-warm-gray-50 dark:hover:bg-warm-gray-750"
              >
                {deleteConfirmId === item.id ? (
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-sm text-warm-gray-600 dark:text-warm-gray-300">
                      Delete "{item.name}"?
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-3 py-1 text-sm text-warm-gray-600 dark:text-warm-gray-400 hover:text-warm-gray-800 dark:hover:text-warm-gray-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0 mr-4">
                      <div className="font-medium text-warm-gray-800 dark:text-warm-gray-100 truncate">
                        {item.name}
                      </div>
                      <div className="text-sm text-warm-gray-500 dark:text-warm-gray-400">
                        {getItemDescription(item)} &middot; {formatDate(item.updatedAt)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onLoad(item as any)}
                        className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(item.id)}
                        className="px-3 py-1.5 text-sm text-warm-gray-500 hover:text-red-500 dark:text-warm-gray-400 dark:hover:text-red-400 transition-colors"
                        aria-label="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </ModalDialog>
  );
};

export default SavedCollectionsDialog;
