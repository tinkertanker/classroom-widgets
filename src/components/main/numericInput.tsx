import React, { useRef } from 'react';

const NumericInput = ({ value, onChange, onKeyUp, refToNext, refToPrev }) => {
  const handleChange = (e) => {
    const val = e.target.value;
    if (/^\d{0,2}$/.test(val)) {
      onChange(val);
    }
  };

  const handleKeyUp = (e) => {
    if (e.key === 'Backspace' && value === '' && refToPrev) {
      refToPrev.current.focus();
    } else if (value.length === 2 && refToNext) {
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
      className="w-full px-4 py-3 text-lg text-center border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  );
};

export default NumericInput;
