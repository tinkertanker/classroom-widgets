import React, { useState } from 'react';
import { 
  FaThumbsUp, 
  FaHeart, 
  FaStar, 
  FaFaceSmile, 
  FaFaceSurprise,
  FaExclamation,
  FaFire,
  FaCheck
} from 'react-icons/fa6';

interface StampProps {
  stampType: string;
  savedState?: {
    colorIndex: number;
    stampType?: string;
  };
  onStateChange?: (state: any) => void;
}

const Stamp: React.FC<StampProps> = ({ stampType, savedState, onStateChange }) => {
  const [colorIndex, setColorIndex] = useState(savedState?.colorIndex || 0);

  // Ensure stampType is saved in state on mount
  React.useEffect(() => {
    if (onStateChange && (!savedState || savedState.stampType !== stampType)) {
      onStateChange({
        colorIndex: colorIndex,
        stampType: stampType
      });
    }
  }, [stampType]);

  // Define color schemes for cycling
  const colorSchemes = [
    'text-dusty-rose-500',
    'text-terracotta-500', 
    'text-sage-600'
  ];

  // Handle click to cycle colors
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent widget selection
    const newColorIndex = (colorIndex + 1) % colorSchemes.length;
    setColorIndex(newColorIndex);
    
    if (onStateChange) {
      onStateChange({ 
        colorIndex: newColorIndex,
        stampType: stampType  // Preserve the stamp type
      });
    }
  };

  // Get the appropriate icon based on stamp type
  const getStampIcon = () => {
    const iconClass = `w-full h-full ${colorSchemes[colorIndex]} transition-colors duration-200`;
    
    // Check if dark mode
    const isDarkMode = document.documentElement.classList.contains('dark');
    const borderColor = isDarkMode ? '#3d3835' : 'white';
    
    
    // Standardized drop-shadow approach for all icon stamps
    const dropShadowStyle = {
      filter: `
        drop-shadow(2px 0 0 ${borderColor})
        drop-shadow(-2px 0 0 ${borderColor})
        drop-shadow(0 2px 0 ${borderColor})
        drop-shadow(0 -2px 0 ${borderColor})
        drop-shadow(1.5px 1.5px 0 ${borderColor})
        drop-shadow(-1.5px -1.5px 0 ${borderColor})
        drop-shadow(1.5px -1.5px 0 ${borderColor})
        drop-shadow(-1.5px 1.5px 0 ${borderColor})
      `
    };
    
    const renderIconWithBorder = () => {
      switch (stampType) {
        case 'thumbsup':
          return <FaThumbsUp className={iconClass} style={dropShadowStyle} />;
        case 'heart':
          return <FaHeart className={iconClass} style={dropShadowStyle} />;
        case 'star':
          return <FaStar className={iconClass} style={dropShadowStyle} />;
        case 'smile':
          return <FaFaceSmile className={iconClass} style={dropShadowStyle} />;
        case 'shocked':
          return <FaFaceSurprise className={iconClass} style={dropShadowStyle} />;
        case 'exclamation':
          return <FaExclamation className={iconClass} style={dropShadowStyle} />;
        case 'fire':
          return <FaFire className={iconClass} style={dropShadowStyle} />;
        case 'check':
          return <FaCheck className={iconClass} style={dropShadowStyle} />;
        default:
          return <FaStar className={iconClass} style={dropShadowStyle} />;
      }
    };

    return (
      <div className="relative w-full h-full">
        {renderIconWithBorder()}
      </div>
    );
  };

  return (
    <div 
      className="w-full h-full cursor-pointer p-3"
      onClick={handleClick}
      title="Click to change color"
    >
      {getStampIcon()}
    </div>
  );
};

export default Stamp;