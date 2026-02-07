/**
 * Fill-in-the-Blank Recipe Generator
 *
 * Generates a UI recipe from a fill-in-the-blank template.
 * Template format: "The {{blank}} is the powerhouse of the {{blank}}."
 */

/**
 * Parse a fill-in-the-blank template into activity data
 * @param {string} template - Text with {{blank}} markers
 * @param {string[]} answers - Correct answers in order
 * @param {string[]} distractors - Additional wrong options
 * @returns {Object} Activity definition with UI recipe
 */
function generateFillBlankActivity(template, answers, distractors = []) {
  // Parse template to extract blanks
  const blankRegex = /\{\{blank\}\}/g;
  const parts = template.split(blankRegex);
  const blankCount = (template.match(blankRegex) || []).length;

  if (answers.length !== blankCount) {
    throw new Error(`Template has ${blankCount} blanks but ${answers.length} answers provided`);
  }

  // Create items (answers + distractors)
  const items = [];
  const allOptions = [...answers, ...distractors];

  // Shuffle options
  const shuffledOptions = shuffleArray([...allOptions]);

  shuffledOptions.forEach((content, index) => {
    items.push({
      id: `item-${index}`,
      content
    });
  });

  // Create targets (one per blank)
  const targets = answers.map((answer, index) => {
    // Find the item ID for this answer
    const itemIndex = shuffledOptions.indexOf(answer);
    return {
      id: `blank-${index}`,
      accepts: [`item-${itemIndex}`]
    };
  });

  // Generate UI recipe
  const uiRecipe = [];

  // Build inline container with text and drop zones
  const inlineChildren = [];

  parts.forEach((part, index) => {
    // Add text part
    if (part) {
      inlineChildren.push({
        id: `text-${index}`,
        type: 'text',
        props: {
          content: part,
          variant: 'inline'
        }
      });
    }

    // Add drop zone if not the last part
    if (index < parts.length - 1) {
      inlineChildren.push({
        id: `dropzone-${index}`,
        type: 'drop-zone',
        props: {
          targetId: `blank-${index}`,
          accepts: 'single',
          inline: true,
          showFeedback: true
        }
      });
    }
  });

  // Sentence container
  uiRecipe.push({
    id: 'sentence-container',
    type: 'container',
    props: {
      layout: 'inline',
      className: 'text-lg leading-relaxed'
    },
    children: inlineChildren
  });

  // Word bank container
  const wordBankChildren = items.map(item => ({
    id: `draggable-${item.id}`,
    type: 'draggable-item',
    props: {
      itemId: item.id,
      content: item.content
    }
  }));

  uiRecipe.push({
    id: 'word-bank',
    type: 'container',
    props: {
      layout: 'row',
      gap: '8px',
      wrap: true,
      className: 'mt-4 p-4 bg-warm-gray-100 dark:bg-warm-gray-800 rounded-lg'
    },
    children: wordBankChildren
  });

  return {
    type: 'fill-blank',
    items,
    targets,
    uiRecipe,
    showImmediateFeedback: true,
    allowRetry: true
  };
}

/**
 * Fisher-Yates shuffle
 */
function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Parse teacher's template text with blanks
 * @param {string} text - Text like "The ___mitochondria___ is the powerhouse"
 * @returns {Object} Parsed template and answers
 */
function parseTemplateWithAnswers(text) {
  // Match patterns like ___answer___ or {{answer}}
  const pattern = /___([^_]+)___|\{\{([^}]+)\}\}/g;
  const answers = [];
  let template = text;
  let match;

  // Extract answers first
  while ((match = pattern.exec(text)) !== null) {
    const answer = match[1] || match[2];
    if (answer !== 'blank') {
      answers.push(answer.trim());
    }
  }

  // Replace with {{blank}} markers
  template = text.replace(pattern, '{{blank}}');

  return { template, answers };
}

module.exports = {
  generateFillBlankActivity,
  parseTemplateWithAnswers,
  shuffleArray
};
