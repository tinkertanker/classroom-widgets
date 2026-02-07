import React, { useRef } from 'react';

interface RenderCounterProps {
  name: string;
  showInProduction?: boolean;
}

/**
 * Component to display render count in development
 * Helps identify components that re-render too frequently
 * 
 * Usage:
 * <RenderCounter name="MyComponent" />
 */
export const RenderCounter: React.FC<RenderCounterProps> = ({ 
  name, 
  showInProduction = false 
}) => {
  const renderCount = useRef(0);
  renderCount.current += 1;

  if (!showInProduction && process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div 
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        background: renderCount.current > 10 ? 'red' : 'orange',
        color: 'white',
        padding: '2px 6px',
        fontSize: '10px',
        borderRadius: '0 0 0 4px',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    >
      {name}: {renderCount.current}
    </div>
  );
};