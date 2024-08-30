import React, { useRef } from 'react';
import { Input } from '@chakra-ui/react';

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
    <Input
      maxLength={2}
      value={value}
      onChange={handleChange}
      onKeyUp={handleKeyUp}
      textAlign="center"
      size="lg"
    />
  );
};

export default NumericInput;
