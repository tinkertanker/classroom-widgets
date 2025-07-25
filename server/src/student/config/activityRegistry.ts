import { ComponentType } from 'react';
import { IconType } from 'react-icons';
import { FaChartBar, FaLink, FaGauge, FaQuestionCircle } from 'react-icons/fa6';
import { ActivityType, ActivityConfig } from '../types/activity.types';

// Lazy load activity components
const PollActivity = () => import('../components/PollActivity');
const LinkShareActivity = () => import('../components/LinkShareActivity');
const RTFeedbackActivity = () => import('../components/RTFeedbackActivity');
const QuestionsActivity = () => import('../components/QuestionsActivity');

// Activity registry configuration
export const ACTIVITY_REGISTRY: Record<ActivityType, ActivityConfig> = {
  poll: {
    type: 'poll',
    title: 'Poll Activity',
    description: 'Participate in real-time polls',
    icon: FaChartBar as unknown as ComponentType,
    component: PollActivity as unknown as ComponentType<any>,
    gradient: 'from-sage-500 to-sage-600',
    darkGradient: 'from-sage-700 to-sage-800'
  },
  linkShare: {
    type: 'linkShare',
    title: 'Share Links',
    description: 'Share presentation links with your teacher',
    icon: FaLink as unknown as ComponentType,
    component: LinkShareActivity as unknown as ComponentType<any>,
    gradient: 'from-terracotta-500 to-terracotta-600',
    darkGradient: 'from-terracotta-700 to-terracotta-800'
  },
  rtfeedback: {
    type: 'rtfeedback',
    title: 'Real-Time Feedback',
    description: "Adjust the slider to let your teacher know how you're doing",
    icon: FaGauge as unknown as ComponentType,
    component: RTFeedbackActivity as unknown as ComponentType<any>,
    gradient: 'from-amber-500 to-amber-600',
    darkGradient: 'from-amber-700 to-amber-800'
  },
  questions: {
    type: 'questions',
    title: 'Ask Questions',
    description: 'Submit questions to your teacher',
    icon: FaQuestionCircle as unknown as ComponentType,
    component: QuestionsActivity as unknown as ComponentType<any>,
    gradient: 'from-sky-500 to-sky-600',
    darkGradient: 'from-sky-700 to-sky-800'
  }
};

// Helper functions
export const getActivityConfig = (type: ActivityType): ActivityConfig | undefined => {
  return ACTIVITY_REGISTRY[type];
};

export const getAllActivities = (): ActivityConfig[] => {
  return Object.values(ACTIVITY_REGISTRY);
};

export const isValidActivityType = (type: string): type is ActivityType => {
  return type in ACTIVITY_REGISTRY;
};