import React from 'react';
import { CustomSmile, CustomRainbow } from '../../widgets/sticker/CustomStickerIcons';

interface StackedStickersIconProps {
  className?: string;
  isActive?: boolean;
}

export const StackedStickersIcon: React.FC<StackedStickersIconProps> = ({ 
  className = '',
  isActive = false 
}) => {
  return (
    <div className={`relative ${className}`}>
      {/* Rainbow sticker in back, moves further on hover */}
      <div 
        className={`absolute w-5 h-5 rainbow-sticker transition-transform duration-200 ease-out
          ${isActive ? 'text-white/90' : 'text-purple-500'}`}
        style={{ 
          top: '2px', 
          left: '7px',
          transform: 'rotate(-15deg)'
        }}
      >
        <CustomRainbow className="w-full h-full" />
      </div>
      
      {/* Smile sticker in front, rotates more on hover */}
      <div 
        className={`relative w-5 h-5 smile-sticker transition-transform duration-200 ease-out
          ${isActive ? 'text-white' : 'text-yellow-500'}`}
        style={{ 
          top: '5px',
          transform: 'rotate(10deg)',
          zIndex: 1
        }}
      >
        <CustomSmile className="w-full h-full" />
      </div>
    </div>
  );
};