// Brand colors for questions (matches teacher app)
export const questionColors = [
  {
    bg: 'bg-sage-50 dark:bg-sage-900/20',
    border: 'border-sage-300 dark:border-sage-700',
    text: 'text-sage-700 dark:text-sage-300',
    answeredBg: 'bg-sage-100 dark:bg-sage-900/30',
    answeredText: 'text-sage-600 dark:text-sage-400'
  },
  {
    bg: 'bg-terracotta-50 dark:bg-terracotta-900/20',
    border: 'border-terracotta-300 dark:border-terracotta-700',
    text: 'text-terracotta-700 dark:text-terracotta-300',
    answeredBg: 'bg-terracotta-100 dark:bg-terracotta-900/30',
    answeredText: 'text-terracotta-600 dark:text-terracotta-400'
  },
  {
    bg: 'bg-sky-50 dark:bg-sky-900/20',
    border: 'border-sky-300 dark:border-sky-700',
    text: 'text-sky-700 dark:text-sky-300',
    answeredBg: 'bg-sky-100 dark:bg-sky-900/30',
    answeredText: 'text-sky-600 dark:text-sky-400'
  },
  {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-300 dark:border-amber-700',
    text: 'text-amber-700 dark:text-amber-300',
    answeredBg: 'bg-amber-100 dark:bg-amber-900/30',
    answeredText: 'text-amber-600 dark:text-amber-400'
  },
  {
    bg: 'bg-dusty-rose-50 dark:bg-dusty-rose-900/20',
    border: 'border-dusty-rose-300 dark:border-dusty-rose-700',
    text: 'text-dusty-rose-700 dark:text-dusty-rose-300',
    answeredBg: 'bg-dusty-rose-100 dark:bg-dusty-rose-900/30',
    answeredText: 'text-dusty-rose-600 dark:text-dusty-rose-400'
  }
];

export const getQuestionColor = (index: number) => {
  return questionColors[index % questionColors.length];
};