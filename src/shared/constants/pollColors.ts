// Poll colors using shades of sage (our primary brand color)
// Each option gets progressively lighter shade for visual distinction
export const pollColors = [
  {
    // Option A - Darkest
    progress: 'bg-sage-500',
    progressDark: 'dark:bg-sage-400',
    label: 'text-sage-700 dark:text-sage-300'
  },
  {
    // Option B
    progress: 'bg-sage-400',
    progressDark: 'dark:bg-sage-300',
    label: 'text-sage-700 dark:text-sage-300'
  },
  {
    // Option C
    progress: 'bg-sage-300',
    progressDark: 'dark:bg-sage-200',
    label: 'text-sage-700 dark:text-sage-300'
  },
  {
    // Option D
    progress: 'bg-sage-200',
    progressDark: 'dark:bg-sage-100',
    label: 'text-sage-700 dark:text-sage-300'
  },
  {
    // Option E - Lightest
    progress: 'bg-sage-100',
    progressDark: 'dark:bg-sage-50',
    label: 'text-sage-700 dark:text-sage-300'
  }
];

export const getPollColor = (index: number) => {
  return pollColors[index % pollColors.length];
};