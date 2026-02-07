import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type {
  ActivityDefinition,
  ActivityAction,
  ActivityResults,
  StudentAnswers,
  ItemPlacement
} from '@shared/types/activity.types';

interface ActivityContextValue {
  // Activity data
  activity: ActivityDefinition | null;
  isActive: boolean;
  actions: ActivityAction[];
  results: ActivityResults | null;
  correctAnswers: Record<string, string> | null;

  // Student answers
  placements: ItemPlacement[];
  textInputs: Record<string, string>;

  // Actions
  placeItem: (itemId: string, targetId: string) => void;
  removeItem: (itemId: string) => void;
  setTextInput: (targetId: string, value: string) => void;
  clearAnswers: () => void;
  getAnswers: () => StudentAnswers;

  // Helpers
  getItemInTarget: (targetId: string) => string | null;
  getTargetForItem: (itemId: string) => string | null;
  isItemPlaced: (itemId: string) => boolean;
  isTargetFilled: (targetId: string) => boolean;
  getTargetFeedback: (targetId: string) => 'correct' | 'incorrect' | null;
}

const ActivityContext = createContext<ActivityContextValue | null>(null);

interface ActivityProviderProps {
  children: React.ReactNode;
  activity: ActivityDefinition | null;
  isActive: boolean;
  actions: ActivityAction[];
  results: ActivityResults | null;
  correctAnswers: Record<string, string> | null;
}

export function ActivityProvider({
  children,
  activity,
  isActive,
  actions,
  results,
  correctAnswers
}: ActivityProviderProps) {
  const [placements, setPlacements] = useState<ItemPlacement[]>([]);
  const [textInputs, setTextInputs] = useState<Record<string, string>>({});

  const placeItem = useCallback((itemId: string, targetId: string) => {
    setPlacements(prev => {
      // Check if target accepts single or multiple items
      const target = activity?.targets.find(t => t.id === targetId);
      const isSingleAccept = true; // For now, default to single

      let newPlacements = prev.filter(p => p.itemId !== itemId);

      if (isSingleAccept) {
        // Remove any existing item in this target
        newPlacements = newPlacements.filter(p => p.targetId !== targetId);
      }

      return [...newPlacements, { itemId, targetId }];
    });
  }, [activity]);

  const removeItem = useCallback((itemId: string) => {
    setPlacements(prev => prev.filter(p => p.itemId !== itemId));
  }, []);

  const setTextInput = useCallback((targetId: string, value: string) => {
    setTextInputs(prev => ({ ...prev, [targetId]: value }));
  }, []);

  const clearAnswers = useCallback(() => {
    setPlacements([]);
    setTextInputs({});
  }, []);

  const getAnswers = useCallback((): StudentAnswers => {
    return { placements, textInputs };
  }, [placements, textInputs]);

  const getItemInTarget = useCallback((targetId: string): string | null => {
    const placement = placements.find(p => p.targetId === targetId);
    return placement?.itemId ?? null;
  }, [placements]);

  const getTargetForItem = useCallback((itemId: string): string | null => {
    const placement = placements.find(p => p.itemId === itemId);
    return placement?.targetId ?? null;
  }, [placements]);

  const isItemPlaced = useCallback((itemId: string): boolean => {
    return placements.some(p => p.itemId === itemId);
  }, [placements]);

  const isTargetFilled = useCallback((targetId: string): boolean => {
    return placements.some(p => p.targetId === targetId) || !!textInputs[targetId];
  }, [placements, textInputs]);

  const getTargetFeedback = useCallback((targetId: string): 'correct' | 'incorrect' | null => {
    if (!results) return null;
    if (results.correct.includes(targetId)) return 'correct';
    if (results.incorrect.includes(targetId)) return 'incorrect';
    return null;
  }, [results]);

  const value = useMemo<ActivityContextValue>(() => ({
    activity,
    isActive,
    actions,
    results,
    correctAnswers,
    placements,
    textInputs,
    placeItem,
    removeItem,
    setTextInput,
    clearAnswers,
    getAnswers,
    getItemInTarget,
    getTargetForItem,
    isItemPlaced,
    isTargetFilled,
    getTargetFeedback
  }), [
    activity,
    isActive,
    actions,
    results,
    correctAnswers,
    placements,
    textInputs,
    placeItem,
    removeItem,
    setTextInput,
    clearAnswers,
    getAnswers,
    getItemInTarget,
    getTargetForItem,
    isItemPlaced,
    isTargetFilled,
    getTargetFeedback
  ]);

  return (
    <ActivityContext.Provider value={value}>
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity() {
  const context = useContext(ActivityContext);
  if (!context) {
    throw new Error('useActivity must be used within an ActivityProvider');
  }
  return context;
}

export function useActivityItem(itemId: string) {
  const { isItemPlaced, getTargetForItem, activity } = useActivity();

  const item = activity?.items.find(i => i.id === itemId);
  const placed = isItemPlaced(itemId);
  const targetId = getTargetForItem(itemId);

  return { item, placed, targetId };
}

export function useActivityTarget(targetId: string) {
  const {
    isTargetFilled,
    getItemInTarget,
    getTargetFeedback,
    activity,
    textInputs,
    correctAnswers
  } = useActivity();

  const target = activity?.targets.find(t => t.id === targetId);
  const filled = isTargetFilled(targetId);
  const itemId = getItemInTarget(targetId);
  const item = itemId ? activity?.items.find(i => i.id === itemId) : null;
  const feedback = getTargetFeedback(targetId);
  const textValue = textInputs[targetId] || '';
  const correctAnswer = correctAnswers?.[targetId];

  return { target, filled, itemId, item, feedback, textValue, correctAnswer };
}
