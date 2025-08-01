// Poll colors using shades of sage (our primary brand color)
// Each option gets progressively lighter shade for visual distinction
export const pollColors = [
  {
    // Option A - Darkest (100% opacity)
    progress: 'bg-sage-500',
    progressDark: 'dark:bg-sage-400',
    label: 'text-sage-700 dark:text-sage-300'
  },
  {
    // Option B - 80% opacity
    progress: 'bg-sage-500/80',
    progressDark: 'dark:bg-sage-400/80',
    label: 'text-sage-700 dark:text-sage-300'
  },
  {
    // Option C - 60% opacity
    progress: 'bg-sage-500/60',
    progressDark: 'dark:bg-sage-400/60',
    label: 'text-sage-700 dark:text-sage-300'
  },
  {
    // Option D - 45% opacity
    progress: 'bg-sage-500/45',
    progressDark: 'dark:bg-sage-400/45',
    label: 'text-sage-700 dark:text-sage-300'
  },
  {
    // Option E - 35% opacity
    progress: 'bg-sage-500/35',
    progressDark: 'dark:bg-sage-400/35',
    label: 'text-sage-700 dark:text-sage-300'
  }
];

export const getPollColor = (index: number) => {
  return pollColors[index % pollColors.length];
};