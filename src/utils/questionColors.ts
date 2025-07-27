// Brand colors for questions
export const questionColors = [
  {
    bg: 'bg-sage-50 dark:bg-sage-900/20',
    border: 'border-sage-300 dark:border-sage-700',
    text: 'text-sage-700 dark:text-sage-300',
    icon: 'text-sage-600 dark:text-sage-400',
    iconHover: 'hover:bg-sage-100 dark:hover:bg-sage-900/30'
  },
  {
    bg: 'bg-terracotta-50 dark:bg-terracotta-900/20',
    border: 'border-terracotta-300 dark:border-terracotta-700',
    text: 'text-terracotta-700 dark:text-terracotta-300',
    icon: 'text-terracotta-600 dark:text-terracotta-400',
    iconHover: 'hover:bg-terracotta-100 dark:hover:bg-terracotta-900/30'
  },
  {
    bg: 'bg-sky-50 dark:bg-sky-900/20',
    border: 'border-sky-300 dark:border-sky-700',
    text: 'text-sky-700 dark:text-sky-300',
    icon: 'text-sky-600 dark:text-sky-400',
    iconHover: 'hover:bg-sky-100 dark:hover:bg-sky-900/30'
  },
  {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-300 dark:border-amber-700',
    text: 'text-amber-700 dark:text-amber-300',
    icon: 'text-amber-600 dark:text-amber-400',
    iconHover: 'hover:bg-amber-100 dark:hover:bg-amber-900/30'
  },
  {
    bg: 'bg-dusty-rose-50 dark:bg-dusty-rose-900/20',
    border: 'border-dusty-rose-300 dark:border-dusty-rose-700',
    text: 'text-dusty-rose-700 dark:text-dusty-rose-300',
    icon: 'text-dusty-rose-600 dark:text-dusty-rose-400',
    iconHover: 'hover:bg-dusty-rose-100 dark:hover:bg-dusty-rose-900/30'
  }
];

export const getQuestionColor = (index: number) => {
  return questionColors[index % questionColors.length];
};