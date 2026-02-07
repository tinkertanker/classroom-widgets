import { useState, useCallback, useRef, useEffect } from 'react';

interface UseEditModeOptions {
  initialValue: string;
  onSave?: (value: string) => void;
  selectAllOnFocus?: boolean;
  saveOnEnter?: boolean;
  cancelOnEscape?: boolean;
}

interface UseEditModeReturn {
  isEditing: boolean;
  value: string;
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>;
  startEdit: () => void;
  cancelEdit: () => void;
  saveEdit: () => void;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleBlur: () => void;
}

/**
 * Hook for managing inline edit mode
 * @param options Configuration options
 * @returns Edit mode state and handlers
 */
export const useEditMode = (options: UseEditModeOptions): UseEditModeReturn => {
  const {
    initialValue,
    onSave,
    selectAllOnFocus = true,
    saveOnEnter = true,
    cancelOnEscape = true
  } = options;

  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const savedValueRef = useRef(initialValue);

  // Update value when initialValue changes
  useEffect(() => {
    setValue(initialValue);
    savedValueRef.current = initialValue;
  }, [initialValue]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (selectAllOnFocus) {
        inputRef.current.select();
      }
    }
  }, [isEditing, selectAllOnFocus]);

  const startEdit = useCallback(() => {
    savedValueRef.current = value;
    setIsEditing(true);
  }, [value]);

  const cancelEdit = useCallback(() => {
    setValue(savedValueRef.current);
    setIsEditing(false);
  }, []);

  const saveEdit = useCallback(() => {
    const trimmedValue = value.trim();
    if (trimmedValue !== savedValueRef.current) {
      onSave?.(trimmedValue);
      savedValueRef.current = trimmedValue;
    }
    setIsEditing(false);
  }, [value, onSave]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValue(e.target.value);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (saveOnEnter && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    } else if (cancelOnEscape && e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  }, [saveOnEnter, cancelOnEscape, saveEdit, cancelEdit]);

  const handleBlur = useCallback(() => {
    saveEdit();
  }, [saveEdit]);

  return {
    isEditing,
    value,
    inputRef,
    startEdit,
    cancelEdit,
    saveEdit,
    handleChange,
    handleKeyDown,
    handleBlur
  };
};