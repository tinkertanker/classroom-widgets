// BackgroundPattern - Renders different background patterns for the board

import React from 'react';
import { BackgroundType } from '../../../shared/types';

interface BackgroundPatternProps {
  type: BackgroundType;
}

const BackgroundPattern: React.FC<BackgroundPatternProps> = ({ type }) => {
  switch (type) {
    case BackgroundType.GEOMETRIC:
      return (
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="geometric" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="3" fill="#e7e5e4" />
              <path d="M0 30 L30 0 L60 30 L30 60 Z" fill="none" stroke="#e7e5e4" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#geometric)" />
        </svg>
      );
      
    case BackgroundType.GRADIENT:
      return (
        <div className="absolute inset-0 bg-gradient-to-br from-warm-gray-50 via-soft-white to-sage-50 opacity-50" />
      );
      
    case BackgroundType.LINES:
      return (
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="lines" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="50" stroke="#e7e5e4" strokeWidth="1" />
              <line x1="0" y1="0" x2="50" y2="0" stroke="#e7e5e4" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#lines)" />
        </svg>
      );
      
    case BackgroundType.DOTS:
      return (
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="2" fill="#e7e5e4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
      );
      
    default:
      return null;
  }
};

export default BackgroundPattern;