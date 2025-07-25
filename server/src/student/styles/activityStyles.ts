/**
 * Shared styles for activity components
 * Ensures consistent theming across all activities
 */

export const activityStyles = {
  // Container styles
  container: 'bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700',
  
  // Text styles
  title: 'text-2xl font-semibold text-warm-gray-800 dark:text-warm-gray-100',
  subtitle: 'text-warm-gray-600 dark:text-warm-gray-400',
  label: 'text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300',
  
  // Button styles
  button: {
    primary: 'px-3 py-1.5 bg-sage-500 hover:bg-sage-600 active:bg-sage-700 text-white rounded-lg font-medium text-sm transition-colors duration-200',
    secondary: 'px-3 py-1.5 bg-warm-gray-200 hover:bg-warm-gray-300 dark:bg-warm-gray-700 dark:hover:bg-warm-gray-600 text-warm-gray-800 dark:text-warm-gray-200 rounded-lg font-medium text-sm transition-colors duration-200',
    danger: 'px-3 py-1.5 bg-dusty-rose-500 hover:bg-dusty-rose-600 active:bg-dusty-rose-700 text-white rounded-lg font-medium text-sm transition-colors duration-200',
    disabled: 'px-3 py-1.5 bg-warm-gray-200 dark:bg-warm-gray-700 text-warm-gray-400 dark:text-warm-gray-500 rounded-lg font-medium text-sm cursor-not-allowed opacity-50'
  },
  
  // Input styles
  input: {
    text: 'w-full px-2 py-1.5 rounded-lg border border-warm-gray-300 dark:border-warm-gray-600 bg-white dark:bg-warm-gray-700 text-warm-gray-800 dark:text-warm-gray-200 focus:outline-none focus:ring-2 focus:ring-sage-500 dark:focus:ring-sage-400 placeholder-warm-gray-400 dark:placeholder-warm-gray-500 text-sm',
    textarea: 'w-full px-2 py-1.5 rounded-lg border border-warm-gray-300 dark:border-warm-gray-600 bg-white dark:bg-warm-gray-700 text-warm-gray-800 dark:text-warm-gray-200 focus:outline-none focus:ring-2 focus:ring-sage-500 dark:focus:ring-sage-400 placeholder-warm-gray-400 dark:placeholder-warm-gray-500 resize-none text-sm'
  },
  
  // Status messages
  status: {
    success: 'p-2 bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-300 rounded-lg text-sm',
    error: 'p-2 bg-dusty-rose-100 dark:bg-dusty-rose-900/30 text-dusty-rose-700 dark:text-dusty-rose-300 rounded-lg text-sm',
    warning: 'p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg text-sm',
    info: 'p-2 bg-warm-gray-200 dark:bg-warm-gray-800 text-warm-gray-600 dark:text-warm-gray-400 rounded-lg text-sm'
  },
  
  // Activity-specific colors
  activityColors: {
    poll: {
      primary: 'sage',
      gradient: 'from-sage-500 to-sage-600 dark:from-sage-700 dark:to-sage-800',
      button: 'bg-sage-700 hover:bg-sage-800 dark:bg-sage-900 dark:hover:bg-sage-950'
    },
    linkShare: {
      primary: 'terracotta',
      gradient: 'from-terracotta-500 to-terracotta-600 dark:from-terracotta-700 dark:to-terracotta-800',
      button: 'bg-terracotta-700 hover:bg-terracotta-800 dark:bg-terracotta-900 dark:hover:bg-terracotta-950'
    },
    rtfeedback: {
      primary: 'amber',
      gradient: 'from-amber-500 to-amber-600 dark:from-amber-700 dark:to-amber-800',
      button: 'bg-amber-700 hover:bg-amber-800 dark:bg-amber-900 dark:hover:bg-amber-950'
    },
    questions: {
      primary: 'sky',
      gradient: 'from-sky-500 to-sky-600 dark:from-sky-700 dark:to-sky-800',
      button: 'bg-sky-700 hover:bg-sky-800 dark:bg-sky-900 dark:hover:bg-sky-950'
    }
  }
};

// Helper function to get button style
export const getButtonStyle = (variant: 'primary' | 'secondary' | 'danger', disabled?: boolean) => {
  if (disabled) return activityStyles.button.disabled;
  return activityStyles.button[variant];
};

// Helper function to get status style
export const getStatusStyle = (type: 'success' | 'error' | 'warning' | 'info') => {
  return activityStyles.status[type];
};