import { useState, useEffect, useCallback } from 'react';

interface UseSlotMachineAnimationOptions {
  onAnimationComplete?: (selectedItem: string, selectedIndex: number) => void;
  duration?: number;
}

/**
 * Hook to manage slot machine animation state and timing
 */
export function useSlotMachineAnimation({
  onAnimationComplete,
  duration = 3600 // 3.6 seconds default
}: UseSlotMachineAnimationOptions = {}) {
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [displayChoices, setDisplayChoices] = useState<string[]>([]);

  // Start the slot machine animation
  const startAnimation = useCallback((choices: string[]) => {
    if (choices.length === 0) return null;

    setIsLoading(true);
    setDisplayChoices(choices);

    // Randomize the order using Fisher-Yates shuffle
    const shuffledChoices = [...choices];
    for (let i = shuffledChoices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledChoices[i], shuffledChoices[j]] = [shuffledChoices[j], shuffledChoices[i]];
    }

    // Select a random index
    const randomIndex = Math.floor(Math.random() * shuffledChoices.length);
    const selectedItem = shuffledChoices[randomIndex];

    return { selectedItem, selectedIndex: randomIndex, shuffledChoices };
  }, []);

  // Handle animation lifecycle
  useEffect(() => {
    if (isLoading && displayChoices.length > 0) {
      // Select random index for animation
      const randomIndex = Math.floor(Math.random() * displayChoices.length);
      setSelectedItemIndex(randomIndex);
      setIsSpinning(true);

      // Complete animation after duration
      const timer = setTimeout(() => {
        const selectedItem = displayChoices[randomIndex];
        setIsLoading(false);
        setIsSpinning(false);
        onAnimationComplete?.(selectedItem, randomIndex);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isLoading, displayChoices, duration, onAnimationComplete]);

  // Reset animation state
  const resetAnimation = useCallback(() => {
    setIsSpinning(false);
    setSelectedItemIndex(0);
  }, []);

  // Clear display choices
  const clearDisplay = useCallback(() => {
    setDisplayChoices([]);
    resetAnimation();
  }, [resetAnimation]);

  return {
    selectedItemIndex,
    isSpinning,
    isLoading,
    displayChoices,
    startAnimation,
    resetAnimation,
    clearDisplay,
    setDisplayChoices,
    setIsLoading
  };
}