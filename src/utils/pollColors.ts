// Brand colors for poll choices
export const pollColors = [
  {
    bg: 'bg-sage-500',
    bgLight: 'bg-sage-50',
    bgDark: 'dark:bg-sage-900/20',
    border: 'border-sage-500',
    borderLight: 'border-sage-300',
    borderDark: 'dark:border-sage-700',
    hover: 'hover:border-sage-500 hover:bg-sage-50',
    hoverDark: 'dark:hover:bg-sage-900/30',
    text: 'text-sage-700',
    textDark: 'dark:text-sage-300',
    progress: 'bg-sage-500',
    progressLight: 'bg-sage-500/20'
  },
  {
    bg: 'bg-terracotta-500',
    bgLight: 'bg-terracotta-50',
    bgDark: 'dark:bg-terracotta-900/20',
    border: 'border-terracotta-500',
    borderLight: 'border-terracotta-300',
    borderDark: 'dark:border-terracotta-700',
    hover: 'hover:border-terracotta-500 hover:bg-terracotta-50',
    hoverDark: 'dark:hover:bg-terracotta-900/30',
    text: 'text-terracotta-700',
    textDark: 'dark:text-terracotta-300',
    progress: 'bg-terracotta-500',
    progressLight: 'bg-terracotta-500/20'
  },
  {
    bg: 'bg-sky-500',
    bgLight: 'bg-sky-50',
    bgDark: 'dark:bg-sky-900/20',
    border: 'border-sky-500',
    borderLight: 'border-sky-300',
    borderDark: 'dark:border-sky-700',
    hover: 'hover:border-sky-500 hover:bg-sky-50',
    hoverDark: 'dark:hover:bg-sky-900/30',
    text: 'text-sky-700',
    textDark: 'dark:text-sky-300',
    progress: 'bg-sky-500',
    progressLight: 'bg-sky-500/20'
  },
  {
    bg: 'bg-amber-500',
    bgLight: 'bg-amber-50',
    bgDark: 'dark:bg-amber-900/20',
    border: 'border-amber-500',
    borderLight: 'border-amber-300',
    borderDark: 'dark:border-amber-700',
    hover: 'hover:border-amber-500 hover:bg-amber-50',
    hoverDark: 'dark:hover:bg-amber-900/30',
    text: 'text-amber-700',
    textDark: 'dark:text-amber-300',
    progress: 'bg-amber-500',
    progressLight: 'bg-amber-500/20'
  },
  {
    bg: 'bg-dusty-rose-500',
    bgLight: 'bg-dusty-rose-50',
    bgDark: 'dark:bg-dusty-rose-900/20',
    border: 'border-dusty-rose-500',
    borderLight: 'border-dusty-rose-300',
    borderDark: 'dark:border-dusty-rose-700',
    hover: 'hover:border-dusty-rose-500 hover:bg-dusty-rose-50',
    hoverDark: 'dark:hover:bg-dusty-rose-900/30',
    text: 'text-dusty-rose-700',
    textDark: 'dark:text-dusty-rose-300',
    progress: 'bg-dusty-rose-500',
    progressLight: 'bg-dusty-rose-500/20'
  }
];

export const getPollColor = (index: number) => {
  return pollColors[index % pollColors.length];
};