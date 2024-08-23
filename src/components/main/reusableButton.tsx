import React from 'react';
import { Button } from '@chakra-ui/react';

const ReusableButton = ({ colorScheme, size, width, height, children, ...props }) => {
  return (
    <Button colorScheme={colorScheme || 'teal'} size={size || 'md'} width={width || '100%'} {...props}>
      {children}
    </Button>
  );
};

export default ReusableButton;
