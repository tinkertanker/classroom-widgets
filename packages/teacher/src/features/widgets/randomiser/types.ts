// Type definitions for Randomiser widget

interface RandomiserState {
  input: string;
  choices: string[];
  removedChoices: string[];
}

interface RandomiserSavedState {
  input: string;
  choices: string[];
  removedChoices?: string[];
}

export interface RandomiserProps {
  savedState?: RandomiserSavedState;
  onStateChange?: (state: RandomiserState) => void;
}

