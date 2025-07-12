import React, { useRef } from 'react';

interface NumericInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyUp?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  refToNext?: React.RefObject<HTMLInputElement>;
  refToPrev?: React.RefObject<HTMLInputElement>;
}

const NumericInput: React.FC<NumericInputProps> = ({ value, onChange, onKeyUp, refToNext, refToPrev }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^\d{0,2}$/.test(val)) {
      onChange(val);
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && value === '' && refToPrev?.current) {
      refToPrev.current.focus();
    } else if (value.length === 2 && refToNext?.current) {
      refToNext.current.focus();
    }

    if (onKeyUp) {
      onKeyUp(e);
    }
  };

  return (
    <input
      maxLength={2}
      value={value}
      onChange={handleChange}
      onKeyUp={handleKeyUp}
      className="w-full px-4 py-3 text-lg text-center border border-warm-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  );
};

export default NumericInput;
