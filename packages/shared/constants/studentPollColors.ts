// Define student-specific poll colors using sage (primary brand color)
// Using different shades for visual distinction between options
export const studentPollColors = [
  {
    // Option A - Darkest
    selected: 'border-sage-500 bg-sage-100 border-2',
    disabled: 'border-sage-200 bg-sage-50',
    resultsBar: 'bg-sage-600 dark:bg-sage-700'
  },
  {
    // Option B
    selected: 'border-sage-500 bg-sage-100 border-2',
    disabled: 'border-sage-200 bg-sage-50',
    resultsBar: 'bg-sage-500 dark:bg-sage-600'
  },
  {
    // Option C
    selected: 'border-sage-500 bg-sage-100 border-2',
    disabled: 'border-sage-200 bg-sage-50',
    resultsBar: 'bg-sage-400 dark:bg-sage-500'
  },
  {
    // Option D  
    selected: 'border-sage-500 bg-sage-100 border-2',
    disabled: 'border-sage-200 bg-sage-50',
    resultsBar: 'bg-sage-300 dark:bg-sage-400'
  },
  {
    // Option E
    selected: 'border-sage-500 bg-sage-100 border-2',
    disabled: 'border-sage-200 bg-sage-50',
    resultsBar: 'bg-sage-200 dark:bg-sage-300'
  }
];

export const getStudentPollColor = (index: number) => {
  return studentPollColors[index % studentPollColors.length];
};