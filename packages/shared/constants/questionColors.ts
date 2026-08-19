// Teacher question-card colors, one family per option index.
// Values are complete literal Tailwind class strings (same contract as
// pollColors.ts) so Tailwind's content scanner can extract them.
export const questionColors = [
  {
    // Option A
    bg: 'bg-sage-100 dark:bg-sage-900/30',
  },
  {
    // Option B
    bg: 'bg-terracotta-100 dark:bg-terracotta-900/30',
  },
  {
    // Option C
    bg: 'bg-sky-100 dark:bg-sky-900/30',
  },
  {
    // Option D
    bg: 'bg-amber-100 dark:bg-amber-900/30',
  },
  {
    // Option E
    bg: 'bg-dusty-rose-100 dark:bg-dusty-rose-900/30',
  },
];

export const getQuestionColor = (index: number) => {
  return questionColors[index % questionColors.length];
};
