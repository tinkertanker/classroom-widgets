import React, { type ReactNode } from 'react';
import type { IconType } from 'react-icons';
import { FaPenNib, FaCode } from 'react-icons/fa6';
import type { ActivityDefinition } from '@shared/types/activity.types';
import {
  buildFillBlankActivity,
  buildCodeFillBlankActivity,
  codeLanguageClass,
  type CodeFillBlankState,
  type CodeLanguage,
  type FillBlankState
} from '../shared/activityBuilders';

/** Saved `activityData` of either widget; only the code variant sets `language`. */
export type FillBlankData = FillBlankState & { language?: CodeLanguage };

/**
 * Everything that differs between the Fill in the Blanks and the Code
 * Fill-in-the-Blanks widgets. Both render through FillBlankWidget and
 * FillBlankEditor.
 */
export interface FillBlankVariant {
  /** Tag for debug logs. */
  debugName: string;
  icon: IconType;
  /** Shown in the empty state and stats label, and as `<title> Editor` on the editor modal. */
  title: string;
  description: string;
  /** Initial `activityData`. Its title and instructions are also what the editor saves. */
  defaults: FillBlankData;
  buildActivity: (data: FillBlankData) => Partial<ActivityDefinition>;
  /** Render answer and distractor chips (and the distractor input) in monospace. */
  mono: boolean;
  blankClassName: string;
  renderPreview: (data: FillBlankData, blanks: ReactNode) => ReactNode;
  showWordBank: boolean;
  editor: {
    hasLanguage: boolean;
    templateLabel: string;
    templateExample: ReactNode;
    templatePlaceholder: string;
    templateRows: number;
    templateClassName: string;
    spellCheck?: boolean;
    detectedLabel: string;
    renderPreview: (blanks: ReactNode) => ReactNode;
    distractorLabel: string;
    distractorHint: string;
    distractorPlaceholder: string;
    note?: ReactNode;
  };
}

export const fillBlankVariant: FillBlankVariant = {
  debugName: 'FillBlank',
  icon: FaPenNib,
  title: 'Fill in the Blanks',
  description: 'Create interactive fill-in-the-blank activities',
  defaults: {
    template: '',
    answers: [],
    distractors: [],
    title: 'Fill in the Blanks',
    instructions: 'Drag the words to fill in the blanks.'
  },
  buildActivity: buildFillBlankActivity,
  mono: false,
  blankClassName: 'inline-block w-20 h-6 mx-1 bg-warm-gray-300 dark:bg-warm-gray-600 rounded align-middle',
  renderPreview: (_data, blanks) => (
    <div className="bg-warm-gray-50 dark:bg-warm-gray-800/50 p-4 rounded-lg">
      <p className="text-warm-gray-700 dark:text-warm-gray-300 text-lg leading-relaxed">
        {blanks}
      </p>
    </div>
  ),
  showWordBank: true,
  editor: {
    hasLanguage: false,
    templateLabel: 'Sentence with Blanks',
    templateExample: <>The {"{{mitochondria}}"} is the powerhouse of the {"{{cell}}"}.</>,
    templatePlaceholder: 'The {{mitochondria}} is the powerhouse of the {{cell}}.',
    templateRows: 4,
    templateClassName: 'w-full px-3 py-2 rounded-lg border border-warm-gray-300 dark:border-warm-gray-600 bg-white dark:bg-warm-gray-800 text-warm-gray-800 dark:text-warm-gray-200 font-mono text-sm',
    detectedLabel: 'Detected Answers',
    renderPreview: (blanks) => (
      <div className="bg-warm-gray-50 dark:bg-warm-gray-800/50 p-3 rounded-lg">
        <p className="text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-2">
          Preview:
        </p>
        <p className="text-warm-gray-800 dark:text-warm-gray-200 leading-relaxed">
          {blanks}
        </p>
      </div>
    ),
    distractorLabel: 'Distractor Words (Optional)',
    distractorHint: 'Add extra words to make the activity more challenging.',
    distractorPlaceholder: 'Add a distractor word'
  }
};

export const codeFillBlankVariant: FillBlankVariant = {
  debugName: 'CodeFillBlank',
  icon: FaCode,
  title: 'Code Fill-in-the-Blanks',
  description: 'Create interactive code completion activities',
  defaults: {
    template: '',
    answers: [],
    distractors: [],
    title: 'Code Fill-in-the-Blanks',
    instructions: 'Complete the code by filling in the blanks.',
    language: 'python'
  },
  buildActivity: (data) => buildCodeFillBlankActivity(data as CodeFillBlankState),
  mono: true,
  blankClassName: 'inline-block w-16 h-5 mx-0.5 bg-warm-gray-600 dark:bg-warm-gray-500 rounded align-middle',
  renderPreview: (data, blanks) => (
    <div className="bg-warm-gray-900 dark:bg-warm-gray-950 p-4 rounded-lg overflow-x-auto">
      <pre className={`text-sm font-mono whitespace-pre-wrap ${codeLanguageClass(data.language)}`}>
        {blanks}
      </pre>
    </div>
  ),
  showWordBank: false,
  editor: {
    hasLanguage: true,
    templateLabel: 'Code Template',
    templateExample: <code className="bg-warm-gray-100 dark:bg-warm-gray-700 px-1 rounded">def {"{{greet}}"}(name):</code>,
    templatePlaceholder: `def {{greet}}(name):
    message = "Hello, " + {{name}}
    {{return}} message`,
    templateRows: 8,
    templateClassName: 'w-full px-3 py-2 rounded-lg border border-warm-gray-300 dark:border-warm-gray-600 bg-warm-gray-900 dark:bg-warm-gray-950 text-warm-gray-200 font-mono text-sm',
    spellCheck: false,
    detectedLabel: 'Detected Blanks',
    renderPreview: (blanks) => (
      <div className="bg-warm-gray-900 dark:bg-warm-gray-950 p-3 rounded-lg">
        <p className="text-sm font-medium text-warm-gray-400 mb-2">
          Preview:
        </p>
        <pre className="text-warm-gray-200 font-mono text-sm whitespace-pre-wrap">
          {blanks}
        </pre>
      </div>
    ),
    distractorLabel: 'Distractor Options (Optional)',
    distractorHint: 'Add extra code snippets to make the activity more challenging.',
    distractorPlaceholder: "Add a distractor (e.g., 'print')",
    note: (
      <div className="bg-warm-gray-50 dark:bg-warm-gray-800/50 p-3 rounded-lg text-sm text-warm-gray-600 dark:text-warm-gray-400">
        <strong>Note:</strong> Answers are matched with flexible whitespace (extra spaces are ignored).
      </div>
    )
  }
};
