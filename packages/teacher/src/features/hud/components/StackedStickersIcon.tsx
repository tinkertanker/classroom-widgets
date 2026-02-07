import React from 'react';
import { CustomHeart, CustomThumbsUp, CustomStar } from '../../widgets/sticker/CustomStickerIcons';

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
      {/* Star sticker on the right, moves right on hover */}
      <div
        className={`absolute w-5 h-5 star-sticker transition-transform duration-200 ease-out
          ${isActive ? 'text-white/80' : 'text-warm-gray-700 dark:text-warm-gray-300'}`}
        style={{ 
          top: '3px', 
          left: '10px',
          transform: 'rotate(20deg)'
        }}
      >
        <CustomStar className="w-full h-full" />
      </div>
      
      {/* Heart sticker in back, moves up on hover */}
      <div
        className={`absolute w-5 h-5 rainbow-sticker transition-transform duration-200 ease-out
          ${isActive ? 'text-white/90' : 'text-warm-gray-700 dark:text-warm-gray-300'}`}
        style={{
          top: '2px',
          left: '7px',
          transform: 'rotate(-15deg)'
        }}
      >
        <CustomHeart className="w-full h-full" />
      </div>

      {/* ThumbsUp sticker on the left, moves left on hover */}
      <div
        className={`relative w-5 h-5 smile-sticker transition-transform duration-200 ease-out
          ${isActive ? 'text-white' : 'text-warm-gray-700 dark:text-warm-gray-300'}`}
        style={{
          top: '5px',
          transform: 'rotate(10deg)',
          zIndex: 1
        }}
      >
        <CustomThumbsUp className="w-full h-full" />
      </div>
    </div>
  );
};