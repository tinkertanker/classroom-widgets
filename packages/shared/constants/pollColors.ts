// Poll colors using shades of sage (our primary brand color)
// Each option gets progressively lighter shade for visual distinction
export const pollColors = [
  {
    // Option A - Darkest
    progress: 'bg-sage-700',
    progressDark: 'dark:bg-sage-600'
  },
  {
    // Option B
    progress: 'bg-sage-600',
    progressDark: 'dark:bg-sage-500'
  },
  {
    // Option C
    progress: 'bg-sage-500',
    progressDark: 'dark:bg-sage-400'
  },
  {
    // Option D
    progress: 'bg-sage-400',
    progressDark: 'dark:bg-sage-300'
  },
  {
    // Option E - Still visible
    progress: 'bg-sage-300',
    progressDark: 'dark:bg-sage-200'
  }
];

export const getPollColor = (index: number) => {
  return pollColors[index % pollColors.length];
};