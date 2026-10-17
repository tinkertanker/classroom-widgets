import type { ActivityDefinition, UIBlock } from '@shared/types/activity.types';

/**
 * Pure activity-definition builders shared by the fill-blank widgets.
 * Extracted from the widget components so the logic that is sent to the
 * server (and drives student scoring) is directly unit-testable.
 */

export interface FillBlankState {
  template: string;
  answers: string[];
  distractors: string[];
  title: string;
  instructions: string;
}

export type CodeLanguage = 'python' | 'javascript' | 'text';

export interface CodeFillBlankState extends FillBlankState {
  language: CodeLanguage;
}

/**
 * Text colour for code in a given language. Used by the student code block
 * (via the UI recipe) and the teacher's code preview.
 */
export function codeLanguageClass(language: CodeLanguage | undefined): string {
  return language === 'python' ? 'text-blue-300' :
    language === 'javascript' ? 'text-yellow-300' :
    'text-warm-gray-200';
}

type FillBlankActivityType = 'fill-blank' | 'code-fill-blank';

function emptyActivity(type: FillBlankActivityType, { title, instructions }: FillBlankState): Partial<ActivityDefinition> {
  return { type, title, instructions, items: [], targets: [], uiRecipe: [] };
}

function completeActivity(
  type: FillBlankActivityType,
  { title, instructions }: FillBlankState,
  parts: Pick<ActivityDefinition, 'items' | 'targets' | 'uiRecipe'>
): Partial<ActivityDefinition> {
  return {
    type,
    title,
    instructions,
    ...parts,
    showImmediateFeedback: true,
    allowRetry: true
  };
}

/**
 * Extract blank answers from a template using {{answer}} markers.
 * Shared by the fill-blank and code-fill-blank editors.
 */
export function parseAnswers(text: string): string[] {
  const pattern = /\{\{([^}]+)\}\}/g;
  const matches = [...text.matchAll(pattern)];
  return matches.map(m => m[1].trim());
}

/**
 * Build the drag-and-drop fill-blank activity definition.
 * IMPORTANT: Items are shuffled once and used for both the definition and
 * UI recipe so item IDs match their content consistently.
 */
export function buildFillBlankActivity(data: FillBlankState): Partial<ActivityDefinition> {
  const { template, answers, distractors } = data;
  if (!template || answers.length === 0) return emptyActivity('fill-blank', data);

  // Create items - shuffle ONCE and use everywhere
  // Fisher-Yates: sorting with a random comparator is biased towards the input
  // order, which would tend to list the answers first and in blank order.
  const shuffled = [...answers, ...distractors];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const items = shuffled.map((word, i) => ({
    id: `item-${i}`,
    content: word
  }));

  // Create targets (one per blank). Accept EVERY item with matching content,
  // not just the first - when the same word appears twice (two identical
  // answers, or an answer duplicated as a distractor), any copy must count.
  const targets = answers.map((answer, i) => ({
    id: `blank-${i}`,
    accepts: shuffled
      .map((word, itemIndex) => (word === answer ? `item-${itemIndex}` : null))
      .filter((id): id is string => id !== null)
  }));

  // Generate UI recipe using the SAME shuffled items
  const parts = template.split(/\{\{[^}]+\}\}/);
  const recipe: UIBlock[] = [];

  // Build inline container for the sentence with blanks
  const inlineChildren: UIBlock[] = [];
  parts.forEach((part, index) => {
    if (part) {
      inlineChildren.push({
        id: `text-${index}`,
        type: 'text' as const,
        props: { content: part, variant: 'inline' as const }
      });
    }
    if (index < parts.length - 1) {
      inlineChildren.push({
        id: `dropzone-${index}`,
        type: 'drop-zone' as const,
        props: {
          targetId: `blank-${index}`,
          accepts: 'single' as const,
          inline: true,
          showFeedback: true
        }
      });
    }
  });

  recipe.push({
    id: 'sentence-container',
    type: 'container' as const,
    props: { layout: 'inline' as const, className: 'text-lg leading-relaxed' },
    children: inlineChildren
  });

  // Word bank using the SAME items (consistent IDs and content)
  const wordBankChildren: UIBlock[] = items.map(item => ({
    id: `draggable-${item.id}`,
    type: 'draggable-item' as const,
    props: { itemId: item.id, content: item.content }
  }));

  recipe.push({
    id: 'word-bank',
    type: 'container' as const,
    props: {
      layout: 'row' as const,
      gap: '8px',
      wrap: true,
      className: 'mt-4 p-4 bg-warm-gray-100 dark:bg-warm-gray-800 rounded-lg'
    },
    children: wordBankChildren
  });

  return completeActivity('fill-blank', data, { items, targets, uiRecipe: recipe });
}

/**
 * Build the typed-input code fill-blank activity definition.
 */
export function buildCodeFillBlankActivity(data: CodeFillBlankState): Partial<ActivityDefinition> {
  const { template, answers, language } = data;
  if (!template || answers.length === 0) return emptyActivity('code-fill-blank', data);

  // Create items - each answer becomes an item (no need to shuffle for typed input)
  const items = answers.map((content, i) => ({
    id: `item-${i}`,
    content
  }));

  // Create targets (one per blank) with whitespace-flexible evaluation
  const targets = answers.map((_, i) => ({
    id: `blank-${i}`,
    accepts: [`item-${i}`],
    evaluationMode: 'whitespace-flexible' as const
  }));

  // Generate UI recipe - code with inline text inputs for blanks
  const recipe: UIBlock[] = [];

  // Parse template into lines for code display
  const lines = template.split('\n');
  const codeLines: UIBlock[] = [];
  let blankIndex = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    // Split line by blank markers
    const parts = line.split(/\{\{[^}]+\}\}/);
    const blankMatches = line.match(/\{\{[^}]+\}\}/g) || [];

    const lineChildren: UIBlock[] = [];

    for (let i = 0; i < parts.length; i++) {
      // Add text part
      if (parts[i]) {
        lineChildren.push({
          id: `text-${lineIdx}-${i}`,
          type: 'text' as const,
          props: { content: parts[i], variant: 'inline' as const, className: 'font-mono whitespace-pre' }
        });
      }

      // Add text input for blank if not the last part
      if (i < blankMatches.length) {
        lineChildren.push({
          id: `input-${blankIndex}`,
          type: 'text-input' as const,
          props: {
            targetId: `blank-${blankIndex}`,
            placeholder: '___',
            maxLength: 50
          }
        });
        blankIndex++;
      }
    }

    codeLines.push({
      id: `line-${lineIdx}`,
      type: 'container' as const,
      props: { layout: 'inline' as const, className: 'min-h-[24px]' },
      children: lineChildren
    });
  }

  // Code container with language styling
  recipe.push({
    id: 'code-container',
    type: 'container' as const,
    props: {
      layout: 'column' as const,
      gap: '0',
      className: `font-mono text-sm bg-warm-gray-900 dark:bg-warm-gray-950 p-4 rounded-lg ${codeLanguageClass(language)}`
    },
    children: codeLines
  });

  return completeActivity('code-fill-blank', data, { items, targets, uiRecipe: recipe });
}
