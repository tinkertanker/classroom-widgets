import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { ActivityType } from '../types/socket.types';
import { 
  PollData, 
  LinkShareData, 
  RTFeedbackData, 
  QuestionsData 
} from '../types/session.types';

type ActivityData = PollData | LinkShareData | RTFeedbackData | QuestionsData;

interface ActivityStoreState {
  // Activity data by type and widgetId
  activities: Map<string, ActivityData>;
  
  // Actions
  setActivityData: (type: ActivityType, widgetId: string | undefined, data: ActivityData) => void;
  getActivityData: <T extends ActivityData>(type: ActivityType, widgetId?: string) => T | undefined;
  updateActivityData: (type: ActivityType, widgetId: string | undefined, updates: Partial<ActivityData>) => void;
  clearActivityData: (type: ActivityType, widgetId?: string) => void;
  clearAllActivities: () => void;
}

// Helper to create activity key
const getActivityKey = (type: ActivityType, widgetId?: string): string => {
  return widgetId ? `${type}-${widgetId}` : type;
};

export const useActivityStore = create<ActivityStoreState>()(
  devtools(
    (set, get) => ({
      // Initial state
      activities: new Map(),
      
      // Actions
      setActivityData: (type, widgetId, data) => {
        const key = getActivityKey(type, widgetId);
        set((state) => {
          const newActivities = new Map(state.activities);
          newActivities.set(key, data);
          return { activities: newActivities };
        });
      },
      
      getActivityData: <T extends ActivityData>(type: ActivityType, widgetId?: string): T | undefined => {
        const key = getActivityKey(type, widgetId);
        return get().activities.get(key) as T | undefined;
      },
      
      updateActivityData: (type, widgetId, updates) => {
        const key = getActivityKey(type, widgetId);
        set((state) => {
          const currentData = state.activities.get(key);
          if (!currentData) return state;
          
          const newActivities = new Map(state.activities);
          newActivities.set(key, { ...currentData, ...updates });
          return { activities: newActivities };
        });
      },
      
      clearActivityData: (type, widgetId) => {
        const key = getActivityKey(type, widgetId);
        set((state) => {
          const newActivities = new Map(state.activities);
          newActivities.delete(key);
          return { activities: newActivities };
        });
      },
      
      clearAllActivities: () => {
        set({ activities: new Map() });
      }
    }),
    {
      name: 'activity-store'
    }
  )
);