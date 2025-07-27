import { useState, useRef, useCallback } from 'react';

interface UseTimeSegmentEditorProps {
  initialValues?: string[];
  isRunning: boolean;
  onValuesChange?: (values: string[], timeValues: number[]) => void;
}

/**
 * Hook to manage time segment editing (hours, minutes, seconds)
 * Handles keyboard navigation, validation, and input management
 */
export function useTimeSegmentEditor({ 
  initialValues = ['00', '00', '10'],
  isRunning,
  onValuesChange 
}: UseTimeSegmentEditorProps) {
  const [values, setValues] = useState(initialValues);
  const [timeValues, setTimeValues] = useState(initialValues.map(v => Number(v)));
  const [editingSegment, setEditingSegment] = useState<number | null>(null);
  const [tempValue, setTempValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleSegmentClick = useCallback((index: number) => {
    if (!isRunning) {
      setEditingSegment(index);
      setTempValue(values[index]);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [isRunning, values]);

  const handleSegmentChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^[0-9]*$/.test(value) && value.length <= 2) {
      setTempValue(value);
    }
  }, []);

  const handleSegmentBlur = useCallback(() => {
    if (editingSegment !== null) {
      const newValues = [...values];
      const numValue = parseInt(tempValue) || 0;
      
      // Validate ranges
      let validValue = numValue;
      if (editingSegment === 0) { // hours
        validValue = Math.min(99, numValue);
      } else { // minutes or seconds
        validValue = Math.min(59, numValue);
      }
      
      newValues[editingSegment] = validValue.toString().padStart(2, '0');
      const newTimeValues = newValues.map(x => Number(x));
      
      setValues(newValues);
      setTimeValues(newTimeValues);
      setEditingSegment(null);
      
      onValuesChange?.(newValues, newTimeValues);
    }
  }, [editingSegment, tempValue, values, onValuesChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSegmentBlur();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleSegmentBlur();
      const nextSegment = editingSegment !== null ? (editingSegment + 1) % 3 : 0;
      handleSegmentClick(nextSegment);
    } else if (e.key === 'Escape') {
      setEditingSegment(null);
      setTempValue('');
    }
  }, [editingSegment, handleSegmentBlur, handleSegmentClick]);

  // Update values when time changes externally (e.g., during countdown)
  const updateFromTime = useCallback((totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    const newValues = [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0')
    ];
    
    setValues(newValues);
    setTimeValues([hours, minutes, seconds]);
  }, []);

  return {
    values,
    timeValues,
    editingSegment,
    tempValue,
    inputRef,
    handleSegmentClick,
    handleSegmentChange,
    handleSegmentBlur,
    handleKeyDown,
    updateFromTime,
    setValues,
    setTimeValues
  };
}