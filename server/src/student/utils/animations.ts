export const activityAnimations = {
  enter: {
    initial: 'opacity-0 scale-95',
    animate: 'opacity-100 scale-100',
    duration: 'duration-300'
  },
  leave: {
    initial: 'opacity-100 scale-100 translate-x-0',
    animate: 'opacity-0 scale-95 -translate-x-full',
    duration: 'duration-300'
  }
};

export const getActivityAnimation = (isEntering: boolean, isLeaving: boolean): string => {
  if (isLeaving) {
    return `${activityAnimations.leave.animate} ${activityAnimations.leave.duration}`;
  }
  if (isEntering) {
    return `${activityAnimations.enter.initial}`;
  }
  return `${activityAnimations.enter.animate} ${activityAnimations.enter.duration}`;
};

export const staggerDelay = (index: number, baseDelay: number = 50): number => {
  return index * baseDelay;
};