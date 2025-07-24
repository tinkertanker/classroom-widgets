import React, { lazy, Suspense } from 'react';
import { ActivityRoomType, BaseActivityProps } from '../types/activity.types';

// Lazy load activity components
const activityComponents = {
  poll: lazy(() => import('./PollActivity')),
  dataShare: lazy(() => import('./DataShareActivity')),
  rtfeedback: lazy(() => import('./RTFeedbackActivity')),
  questions: lazy(() => import('./QuestionsActivity'))
};

// Loading component
const ActivityLoader: React.FC = () => (
  <div className="flex items-center justify-center h-[200px]">
    <div className="flex flex-col items-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600"></div>
      <p className="mt-2 text-sm text-warm-gray-600 dark:text-warm-gray-400">
        Loading activity...
      </p>
    </div>
  </div>
);

// Error boundary for activities
class ActivityErrorBoundary extends React.Component<
  { children: React.ReactNode; activityType: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <p className="text-dusty-rose-600 dark:text-dusty-rose-400 mb-2">
            Failed to load {this.props.activityType} activity
          </p>
          <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
            {this.state.error?.message || 'Unknown error'}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

interface ActivityRendererProps extends BaseActivityProps {
  type: ActivityRoomType;
  studentName: string;
}

/**
 * Dynamic activity renderer that loads the appropriate component
 * based on the room type
 */
export const ActivityRenderer: React.FC<ActivityRendererProps> = ({
  type,
  socket,
  sessionCode,
  widgetId,
  studentName,
  initialData
}) => {
  const ActivityComponent = activityComponents[type];
  
  if (!ActivityComponent) {
    return (
      <div className="p-6 text-center text-warm-gray-600 dark:text-warm-gray-400">
        Unknown activity type: {type}
      </div>
    );
  }

  // Props mapping based on activity type
  const getActivityProps = () => {
    const baseProps = {
      socket,
      roomCode: sessionCode,
      sessionCode,
      widgetId,
      isSession: true
    };

    switch (type) {
      case 'poll':
        return {
          ...baseProps,
          initialPollData: initialData
        };
      
      case 'dataShare':
        return {
          ...baseProps,
          studentName
        };
      
      case 'rtfeedback':
        return {
          ...baseProps,
          studentName,
          initialIsActive: initialData?.isActive
        };
      
      case 'questions':
        return {
          ...baseProps,
          studentId: socket.id || '',
          initialIsActive: initialData?.isActive
        };
      
      default:
        return baseProps;
    }
  };

  return (
    <ActivityErrorBoundary activityType={type}>
      <Suspense fallback={<ActivityLoader />}>
        <ActivityComponent {...getActivityProps()} />
      </Suspense>
    </ActivityErrorBoundary>
  );
};