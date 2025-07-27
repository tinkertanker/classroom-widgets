// Brand colors for poll choices (matches teacher app)
export const pollColors = [
  {
    // Sage green
    selected: 'border-sage-500 bg-sage-500 text-white',
    hover: 'hover:border-sage-500 hover:bg-sage-50 dark:hover:bg-sage-900/30',
    disabled: 'border-sage-400 bg-sage-400 text-white',
    results: 'bg-sage-500/20',
    resultsBar: 'bg-sage-500',
    borderLight: 'border-sage-300 dark:border-sage-700'
  },
  {
    // Terracotta
    selected: 'border-terracotta-500 bg-terracotta-500 text-white',
    hover: 'hover:border-terracotta-500 hover:bg-terracotta-50 dark:hover:bg-terracotta-900/30',
    disabled: 'border-terracotta-400 bg-terracotta-400 text-white',
    results: 'bg-terracotta-500/20',
    resultsBar: 'bg-terracotta-500',
    borderLight: 'border-terracotta-300 dark:border-terracotta-700'
  },
  {
    // Sky blue
    selected: 'border-sky-500 bg-sky-500 text-white',
    hover: 'hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/30',
    disabled: 'border-sky-400 bg-sky-400 text-white',
    results: 'bg-sky-500/20',
    resultsBar: 'bg-sky-500',
    borderLight: 'border-sky-300 dark:border-sky-700'
  },
  {
    // Amber
    selected: 'border-amber-500 bg-amber-500 text-white',
    hover: 'hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30',
    disabled: 'border-amber-400 bg-amber-400 text-white',
    results: 'bg-amber-500/20',
    resultsBar: 'bg-amber-500',
    borderLight: 'border-amber-300 dark:border-amber-700'
  },
  {
    // Dusty rose
    selected: 'border-dusty-rose-500 bg-dusty-rose-500 text-white',
    hover: 'hover:border-dusty-rose-500 hover:bg-dusty-rose-50 dark:hover:bg-dusty-rose-900/30',
    disabled: 'border-dusty-rose-400 bg-dusty-rose-400 text-white',
    results: 'bg-dusty-rose-500/20',
    resultsBar: 'bg-dusty-rose-500',
    borderLight: 'border-dusty-rose-300 dark:border-dusty-rose-700'
  }
];

export const getPollColor = (index: number) => {
  return pollColors[index % pollColors.length];
};