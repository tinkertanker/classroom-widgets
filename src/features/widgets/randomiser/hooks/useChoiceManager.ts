import { useState, useRef, useCallback, useEffect } from 'react';
import { normaliseChoiceList, stringifyChoiceList } from '../utils/choiceList';

interface UseChoiceManagerOptions {
  initialInput?: string;
  initialChoices?: string[];
  initialRemovedChoices?: string[];
  onStateChange?: (state: { input: string; choices: string[]; removedChoices: string[] }) => void;
}

/**
 * Hook to manage randomiser choices including processing, removal, and restoration
 */
export function useChoiceManager({
  initialInput = '',
  initialChoices = [],
  initialRemovedChoices = [],
  onStateChange
}: UseChoiceManagerOptions) {
  const initialInputValue = initialInput || stringifyChoiceList(initialChoices);
  const [input, setInput] = useState(initialInputValue);
  const [removedChoices, setRemovedChoices] = useState<string[]>(initialRemovedChoices);
  const choices = normaliseChoiceList(input);

  // Track first render to skip initial state update
  const isFirstRender = useRef(true);

  // Process raw input into clean choices array
  const processChoices = useCallback((rawInput: string): string[] => {
    return normaliseChoiceList(rawInput);
  }, []);

  // Get active choices (excluding removed ones)
  const getActiveChoices = useCallback(() => {
    return choices.filter(choice => !removedChoices.includes(choice));
  }, [choices, removedChoices]);

  // Remove a choice
  const removeChoice = useCallback((choice: string) => {
    if (!removedChoices.includes(choice)) {
      const newRemovedChoices = [...removedChoices, choice];
      const newChoices = choices.filter(c => c !== choice);
      setRemovedChoices(newRemovedChoices);
      setInput(stringifyChoiceList(newChoices));

      return {
        choices: newChoices,
        removedChoices: newRemovedChoices,
        activeChoices: newChoices.filter(c => !newRemovedChoices.includes(c))
      };
    }
    return null;
  }, [choices, removedChoices]);

  // Update choices and input together
  const updateChoices = useCallback((newChoices: string[]) => {
    setInput(stringifyChoiceList(newChoices));
  }, []);

  // Update removed choices
  const updateRemovedChoices = useCallback((newRemovedChoices: string[]) => {
    setRemovedChoices(newRemovedChoices);
  }, []);

  // Notify parent of state changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    onStateChange?.({
      input,
      choices,
      removedChoices
    });
  }, [input, choices, removedChoices, onStateChange]);

  return {
    input,
    setInput,
    choices,
    removedChoices,
    processChoices,
    getActiveChoices,
    removeChoice,
    updateChoices,
    updateRemovedChoices
  };
}
