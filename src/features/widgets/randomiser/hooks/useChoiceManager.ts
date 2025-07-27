import { useState, useRef, useCallback, useEffect } from 'react';

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
  const [input, setInput] = useState(initialInput);
  const [choices, setChoices] = useState<string[]>(initialChoices);
  const [removedChoices, setRemovedChoices] = useState<string[]>(initialRemovedChoices);
  
  // Refs for accessing current values in callbacks
  const choicesRef = useRef(choices);
  const removedChoicesRef = useRef(removedChoices);
  
  // Track first render to skip initial state update
  const isFirstRender = useRef(true);

  // Update refs when state changes
  useEffect(() => {
    choicesRef.current = choices;
  }, [choices]);

  useEffect(() => {
    removedChoicesRef.current = removedChoices;
  }, [removedChoices]);

  // Process raw input into clean choices array
  const processChoices = useCallback((rawInput: string): string[] => {
    let temporaryChoices = rawInput.split('\n');
    temporaryChoices = temporaryChoices.map((value) => value.trim());
    temporaryChoices = temporaryChoices.filter((value, index, array) => {
      if (value === '') {
        return false;
      } else {
        // Remove duplicates
        return array.indexOf(value) === index;
      }
    });
    return temporaryChoices;
  }, []);

  // Get active choices (excluding removed ones)
  const getActiveChoices = useCallback(() => {
    return choices.filter(choice => !removedChoices.includes(choice));
  }, [choices, removedChoices]);

  // Remove a choice
  const removeChoice = useCallback((choice: string) => {
    if (!removedChoices.includes(choice)) {
      const newRemovedChoices = [...removedChoices, choice];
      setRemovedChoices(newRemovedChoices);
      
      // Also remove from choices array
      const newChoices = choices.filter(c => c !== choice);
      setChoices(newChoices);
      setInput(newChoices.join('\n'));
      
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
    setChoices(newChoices);
    setInput(newChoices.join('\n'));
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

  // Keep choices in sync with input
  useEffect(() => {
    const processedChoices = processChoices(input);
    if (JSON.stringify(processedChoices) !== JSON.stringify(choices)) {
      setChoices(processedChoices);
    }
  }, [input, processChoices]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    input,
    setInput,
    choices,
    removedChoices,
    choicesRef,
    removedChoicesRef,
    processChoices,
    getActiveChoices,
    removeChoice,
    updateChoices,
    updateRemovedChoices
  };
}