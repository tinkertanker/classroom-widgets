import React, { useState, useCallback } from 'react';
import { FaPlus, FaXmark } from 'react-icons/fa6';
import { buttons } from '../../../../shared/utils/styles';

interface CodeFillBlankEditorProps {
  initialData?: {
    template: string;
    answers: string[];
    distractors: string[];
    title?: string;
    instructions?: string;
    language?: 'python' | 'javascript' | 'text';
  };
  onSave: (data: {
    template: string;
    answers: string[];
    distractors: string[];
    title: string;
    instructions: string;
    language: 'python' | 'javascript' | 'text';
  }) => void;
  onClose: () => void;
}

/**
 * Editor for creating code fill-in-the-blank activities.
 * Teacher enters code with blanks marked using ___answer___ syntax.
 * Example: "def ___greet___(name):\n    return ___\"Hello, \"___ + name"
 */
export function CodeFillBlankEditor({ initialData, onSave, onClose }: CodeFillBlankEditorProps) {
  const [template, setTemplate] = useState(initialData?.template || '');
  const [language, setLanguage] = useState<'python' | 'javascript' | 'text'>(initialData?.language || 'python');
  const [distractors, setDistractors] = useState<string[]>(initialData?.distractors || []);
  const [newDistractor, setNewDistractor] = useState('');

  // Parse answers from template
  const parseAnswers = useCallback((text: string): string[] => {
    const pattern = /\{\{([^}]+)\}\}/g;
    const matches = [...text.matchAll(pattern)];
    return matches.map(m => m[1].trim());
  }, []);

  const answers = parseAnswers(template);

  const handleAddDistractor = () => {
    if (newDistractor.trim() && !distractors.includes(newDistractor.trim())) {
      setDistractors([...distractors, newDistractor.trim()]);
      setNewDistractor('');
    }
  };

  const handleRemoveDistractor = (index: number) => {
    setDistractors(distractors.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (answers.length === 0) {
      alert('Please add at least one blank using {{answer}} syntax');
      return;
    }
    onSave({
      template,
      answers,
      distractors,
      title: 'Code Fill-in-the-Blanks',
      instructions: 'Complete the code by filling in the blanks.',
      language
    });
  };

  // Render preview with gray blocks for blanks
  const renderCodePreview = (text: string) => {
    const parts = text.split(/(\{\{[^}]+\}\})/);
    return parts.map((part, index) => {
      if (part.match(/^\{\{[^}]+\}\}$/)) {
        return (
          <span
            key={index}
            className="inline-block w-16 h-5 mx-0.5 bg-warm-gray-600 dark:bg-warm-gray-500 rounded align-middle"
          />
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="space-y-4 p-4 max-w-2xl">
      {/* Language Selection */}
      <div>
        <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-1">
          Programming Language
        </label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as 'python' | 'javascript' | 'text')}
          className="w-full px-3 py-2 rounded-lg border border-warm-gray-300 dark:border-warm-gray-600 bg-white dark:bg-warm-gray-800 text-warm-gray-800 dark:text-warm-gray-200"
        >
          <option value="python">Python</option>
          <option value="javascript">JavaScript</option>
          <option value="text">Plain Text</option>
        </select>
      </div>

      {/* Template Input */}
      <div>
        <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-1">
          Code Template
        </label>
        <p className="text-xs text-warm-gray-500 dark:text-warm-gray-400 mb-2">
          Use <code className="bg-warm-gray-100 dark:bg-warm-gray-700 px-1 rounded">{"{{answer}}"}</code> to mark blanks.
          Example: <code className="bg-warm-gray-100 dark:bg-warm-gray-700 px-1 rounded">def {"{{greet}}"}(name):</code>
        </p>
        <textarea
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          placeholder={`def {{greet}}(name):
    message = "Hello, " + {{name}}
    {{return}} message`}
          rows={8}
          className="w-full px-3 py-2 rounded-lg border border-warm-gray-300 dark:border-warm-gray-600 bg-warm-gray-900 dark:bg-warm-gray-950 text-warm-gray-200 font-mono text-sm"
          spellCheck={false}
        />
      </div>

      {/* Detected Answers */}
      {answers.length > 0 && (
        <div className="bg-sage-50 dark:bg-sage-900/20 p-3 rounded-lg">
          <p className="text-sm font-medium text-sage-700 dark:text-sage-300 mb-2">
            Detected Blanks ({answers.length}):
          </p>
          <div className="flex flex-wrap gap-2">
            {answers.map((answer, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-sage-200 dark:bg-sage-800 text-sage-800 dark:text-sage-200 rounded text-sm font-mono"
              >
                {answer}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {template && (
        <div className="bg-warm-gray-900 dark:bg-warm-gray-950 p-3 rounded-lg">
          <p className="text-sm font-medium text-warm-gray-400 mb-2">
            Preview:
          </p>
          <pre className="text-warm-gray-200 font-mono text-sm whitespace-pre-wrap">
            {renderCodePreview(template)}
          </pre>
        </div>
      )}

      {/* Distractors */}
      <div>
        <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-1">
          Distractor Options (Optional)
        </label>
        <p className="text-xs text-warm-gray-500 dark:text-warm-gray-400 mb-2">
          Add extra code snippets to make the activity more challenging.
        </p>

        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newDistractor}
            onChange={(e) => setNewDistractor(e.target.value)}
            placeholder="Add a distractor (e.g., 'print')"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddDistractor())}
            className="flex-1 px-3 py-2 rounded-lg border border-warm-gray-300 dark:border-warm-gray-600 bg-white dark:bg-warm-gray-800 text-warm-gray-800 dark:text-warm-gray-200 font-mono"
          />
          <button
            onClick={handleAddDistractor}
            className={`${buttons.secondary} px-3 py-2`}
          >
            <FaPlus className="w-4 h-4" />
          </button>
        </div>

        {distractors.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {distractors.map((word, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 bg-warm-gray-200 dark:bg-warm-gray-700 text-warm-gray-700 dark:text-warm-gray-300 rounded text-sm font-mono"
              >
                {word}
                <button
                  onClick={() => handleRemoveDistractor(index)}
                  className="text-warm-gray-500 hover:text-dusty-rose-500"
                >
                  <FaXmark className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Whitespace matching note */}
      <div className="bg-warm-gray-50 dark:bg-warm-gray-800/50 p-3 rounded-lg text-sm text-warm-gray-600 dark:text-warm-gray-400">
        <strong>Note:</strong> Answers are matched with flexible whitespace (extra spaces are ignored).
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t border-warm-gray-200 dark:border-warm-gray-700">
        <button
          onClick={onClose}
          className={`${buttons.secondary} px-4 py-2`}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={answers.length === 0}
          className={`${buttons.primary} px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          Save Activity
        </button>
      </div>
    </div>
  );
}

export default CodeFillBlankEditor;
