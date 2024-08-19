import React from 'react';
import { Button } from '@chakra-ui/react';

const ReusableButton = ({ colorScheme, size, children, ...props }) => {
  return (
    <Button colorScheme={colorScheme || 'teal'} size={size || 'md'} {...props}>
      {children}
    </Button>
  );
};

export default ReusableButton;
