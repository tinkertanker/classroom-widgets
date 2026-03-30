// Define student-specific poll colors using sage (primary brand color)
// Using different shades for visual distinction between options
export const studentPollColors = [
  {
    // Option A - Darkest
    border: 'border-sage-300',
    borderHover: 'hover:border-sage-400',
    selected: 'border-sage-500 bg-sage-100 border-2',
    disabled: 'border-sage-200 bg-sage-50',
    results: 'bg-white',
    resultsBar: 'bg-sage-600 dark:bg-sage-700',
    borderLight: 'border-sage-200'
  },
  {
    // Option B
    border: 'border-sage-300',
    borderHover: 'hover:border-sage-400', 
    selected: 'border-sage-500 bg-sage-100 border-2',
    disabled: 'border-sage-200 bg-sage-50',
    results: 'bg-white',
    resultsBar: 'bg-sage-500 dark:bg-sage-600',
    borderLight: 'border-sage-200'
  },
  {
    // Option C
    border: 'border-sage-300',
    borderHover: 'hover:border-sage-400',
    selected: 'border-sage-500 bg-sage-100 border-2',
    disabled: 'border-sage-200 bg-sage-50',
    results: 'bg-white',
    resultsBar: 'bg-sage-400 dark:bg-sage-500',
    borderLight: 'border-sage-200'
  },
  {
    // Option D  
    border: 'border-sage-300',
    borderHover: 'hover:border-sage-400',
    selected: 'border-sage-500 bg-sage-100 border-2',
    disabled: 'border-sage-200 bg-sage-50',
    results: 'bg-white',
    resultsBar: 'bg-sage-300 dark:bg-sage-400',
    borderLight: 'border-sage-200'
  },
  {
    // Option E
    border: 'border-sage-300',
    borderHover: 'hover:border-sage-400',
    selected: 'border-sage-500 bg-sage-100 border-2',
    disabled: 'border-sage-200 bg-sage-50',
    results: 'bg-white',
    resultsBar: 'bg-sage-200 dark:bg-sage-300',
    borderLight: 'border-sage-200'
  }
];

export const getStudentPollColor = (index: number) => {
  return studentPollColors[index % studentPollColors.length];
};