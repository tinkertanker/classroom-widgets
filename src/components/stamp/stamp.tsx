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
    rotation?: number;
  };
  onStateChange?: (state: any) => void;
}

const Stamp: React.FC<StampProps> = ({ stampType, savedState, onStateChange }) => {
  const [colorIndex, setColorIndex] = useState(savedState?.colorIndex || 0);
  const [rotation, setRotation] = useState(savedState?.rotation || 0);

  // Generate random rotation between -40 and 40 in steps of 5
  const getRandomRotation = () => {
    const steps = [];
    for (let i = -40; i <= 40; i += 5) {
      steps.push(i);
    }
    return steps[Math.floor(Math.random() * steps.length)];
  };

  // Ensure stampType is saved in state on mount
  React.useEffect(() => {
    if (onStateChange && (!savedState || savedState.stampType !== stampType)) {
      onStateChange({
        colorIndex: colorIndex,
        stampType: stampType,
        rotation: rotation
      });
    }
  }, [stampType]);

  // Define more vibrant color schemes for cycling
  const colorSchemes = [
    'text-pink-500',      // Bright pink
    'text-orange-500',    // Vibrant orange
    'text-emerald-500',   // Bright green
    'text-blue-500',      // Bright blue
    'text-purple-500',    // Vibrant purple
    'text-yellow-500'     // Bright yellow
  ];

  // Handle click to cycle colors and rotation
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent widget selection
    const newColorIndex = (colorIndex + 1) % colorSchemes.length;
    const newRotation = getRandomRotation();
    
    setColorIndex(newColorIndex);
    setRotation(newRotation);
    
    if (onStateChange) {
      onStateChange({ 
        colorIndex: newColorIndex,
        stampType: stampType,  // Preserve the stamp type
        rotation: newRotation
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
      title="Click to change color and rotation"
      style={{
        transform: `rotate(${rotation}deg)`,
        transition: 'transform 0.3s ease'
      }}
    >
      {getStampIcon()}
    </div>
  );
};

export default Stamp;