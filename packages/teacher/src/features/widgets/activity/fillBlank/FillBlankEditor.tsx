import React, { useState } from 'react';
import { FaPlus, FaXmark } from 'react-icons/fa6';
import { buttons } from '@shared/utils/styles';
import { parseAnswers, type CodeLanguage } from '../shared/activityBuilders';
import { useSessionEditor, type SessionEditorScope } from '../../../session/hooks/useSessionEditor';
import { SessionEditorRecovery } from '../../shared/components/SessionEditorRecovery';
import { renderBlankPreview } from './blankPreview';
import type { FillBlankData, FillBlankVariant } from './variants';

interface FillBlankEditorProps {
  variant: FillBlankVariant;
  editorScope?: SessionEditorScope;
  initialData?: Partial<FillBlankData>;
  onSave: (data: FillBlankData) => void;
  onClose: () => void;
}

/**
 * Editor for fill-in-the-blank and code fill-in-the-blank activities.
 * The teacher marks blanks with {{answer}}, e.g.
 * "The {{mitochondria}} is the powerhouse of the {{cell}}." or
 * "def {{greet}}(name):".
 */
export function FillBlankEditor({ variant, initialData, onSave, onClose, editorScope }: FillBlankEditorProps) {
  const { editor: config, mono } = variant;
  const editor = useSessionEditor(editorScope);
  const [template, setTemplate] = useState(initialData?.template || '');
  const [distractors, setDistractors] = useState<string[]>(initialData?.distractors || []);
  const [newDistractor, setNewDistractor] = useState('');
  const [language, setLanguage] = useState<CodeLanguage>(initialData?.language || 'python');
  // Only the code variant has a language; it is saved and drafted after the shared fields.
  const languageField = config.hasLanguage ? { language } : {};

  // Parse answers from template ({{answer}} markers)
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
    if (!editor.canSave()) return;
    if (answers.length === 0) {
      alert('Please add at least one blank using {{answer}} syntax');
      return;
    }
    onSave({
      template,
      answers,
      distractors,
      title: variant.defaults.title,
      instructions: variant.defaults.instructions,
      ...languageField
    });
  };

  const monoClass = mono ? ' font-mono' : '';

  return (
    <div className="space-y-4 p-4 max-w-2xl">
      {config.hasLanguage && (
        <div>
          <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-1">
            Programming Language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as CodeLanguage)}
            className="w-full px-3 py-2 rounded-lg border border-warm-gray-300 dark:border-warm-gray-600 bg-white dark:bg-warm-gray-800 text-warm-gray-800 dark:text-warm-gray-200"
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="text">Plain Text</option>
          </select>
        </div>
      )}

      {/* Template Input */}
      <div>
        <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-1">
          {config.templateLabel}
        </label>
        <p className="text-xs text-warm-gray-500 dark:text-warm-gray-400 mb-2">
          Use <code className="bg-warm-gray-100 dark:bg-warm-gray-700 px-1 rounded">{"{{answer}}"}</code> to mark blanks.
          Example: {config.templateExample}
        </p>
        <textarea
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          placeholder={config.templatePlaceholder}
          rows={config.templateRows}
          className={config.templateClassName}
          spellCheck={config.spellCheck}
        />
      </div>

      {/* Detected Answers */}
      {answers.length > 0 && (
        <div className="bg-sage-50 dark:bg-sage-900/20 p-3 rounded-lg">
          <p className="text-sm font-medium text-sage-700 dark:text-sage-300 mb-2">
            {config.detectedLabel} ({answers.length}):
          </p>
          <div className="flex flex-wrap gap-2">
            {answers.map((answer, index) => (
              <span
                key={index}
                className={`px-2 py-1 bg-sage-200 dark:bg-sage-800 text-sage-800 dark:text-sage-200 rounded text-sm${monoClass}`}
              >
                {answer}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {template && config.renderPreview(renderBlankPreview(template, variant.blankClassName))}

      {/* Distractors */}
      <div>
        <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-1">
          {config.distractorLabel}
        </label>
        <p className="text-xs text-warm-gray-500 dark:text-warm-gray-400 mb-2">
          {config.distractorHint}
        </p>

        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newDistractor}
            onChange={(e) => setNewDistractor(e.target.value)}
            placeholder={config.distractorPlaceholder}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddDistractor())}
            className={`flex-1 px-3 py-2 rounded-lg border border-warm-gray-300 dark:border-warm-gray-600 bg-white dark:bg-warm-gray-800 text-warm-gray-800 dark:text-warm-gray-200${monoClass}`}
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
                className={`inline-flex items-center gap-1 px-2 py-1 bg-warm-gray-200 dark:bg-warm-gray-700 text-warm-gray-700 dark:text-warm-gray-300 rounded text-sm${monoClass}`}
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

      {config.note}

      <SessionEditorRecovery editor={editor} draft={JSON.stringify({ template, distractors, ...languageField }, null, 2)} />
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
          disabled={answers.length === 0 || !editor.canSave()}
          className={`${buttons.primary} px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          Save Activity
        </button>
      </div>
    </div>
  );
}

export default FillBlankEditor;
