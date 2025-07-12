// Type definitions for Randomiser widget

export interface RandomiserState {
  input: string;
  choices: string[];
  removedChoices: string[];
}

export interface RandomiserSavedState {
  input: string;
  choices: string[];
}

export interface RandomiserProps {
  toggleConfetti: (value: boolean) => void;
  savedState?: RandomiserSavedState;
  onStateChange?: (state: RandomiserState) => void;
}

export interface RandomiserSettingsProps {
  choices: string[];
  removedChoices: string[];
  onUpdateChoices: (choices: string[]) => void;
  onUpdateRemovedChoices: (choices: string[]) => void;
}