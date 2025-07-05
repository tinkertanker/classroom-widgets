import React, { useEffect, useState, useRef } from 'react';

interface SlotMachineProps {
  items: string[];
  selectedIndex: number;
  isSpinning: boolean;
  duration: number;
  onSpinComplete?: () => void;
}

const SlotMachine: React.FC<SlotMachineProps> = ({ 
  items, 
  selectedIndex, 
  isSpinning, 
  duration,
  onSpinComplete 
}) => {
  const [displayIndex, setDisplayIndex] = useState(0);
  const [displayOffset, setDisplayOffset] = useState(0);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const startIndexRef = useRef<number>(0);
  const targetStepsRef = useRef<number>(0);
  
  useEffect(() => {
    if (isSpinning && items.length > 0) {
      // Cancel any ongoing animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      
      // Store current position as starting point
      startIndexRef.current = displayIndex;
      
      // Calculate how many steps to take to reach selectedIndex
      const rotations = 8 + Math.random() * 4; // 8-12 rotations
      const fullRotationSteps = Math.floor(rotations) * items.length;
      
      // Calculate shortest path to selected index
      let stepsToTarget = selectedIndex - startIndexRef.current;
      if (stepsToTarget < 0) {
        stepsToTarget += items.length;
      }
      
      targetStepsRef.current = fullRotationSteps + stepsToTarget;
      
      // Start animation
      startTimeRef.current = performance.now();
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);
        
        // Use easing function for smooth deceleration
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        
        // Calculate current position
        const totalProgress = easedProgress * targetStepsRef.current;
        const currentStep = Math.floor(totalProgress);
        const offsetProgress = totalProgress - currentStep;
        
        // Update display
        const newIndex = (startIndexRef.current + currentStep) % items.length;
        setDisplayIndex(newIndex);
        setDisplayOffset(offsetProgress);
        
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          // Ensure we end exactly at selected index
          setDisplayIndex(selectedIndex);
          setDisplayOffset(0);
          if (onSpinComplete) {
            onSpinComplete();
          }
        }
      };
      
      animationRef.current = requestAnimationFrame(animate);
      
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [isSpinning, selectedIndex, items.length, duration, onSpinComplete]);
  
  const getItemAtPosition = (position: number) => {
    if (items.length === 0) return '';
    const index = (displayIndex + position + items.length) % items.length;
    return items[index];
  };
  
  const getOpacity = (yPosition: number) => {
    // yPosition is -1 to 1, where 0 is center
    const distance = Math.abs(yPosition);
    return Math.max(0, 1 - distance);
  };
  
  const getScale = (yPosition: number) => {
    // Scale from 0.7 at edges to 1 at center
    const distance = Math.abs(yPosition);
    return 1 - (distance * 0.3);
  };
  
  if (items.length === 0) {
    return <div className="text-gray-500">No items to display</div>;
  }
  
  // Calculate positions for visible items
  const itemHeight = 50; // Height of each item slot - reduced for tighter spacing
  
  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Gradient masks for fade effect */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-gray-100 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-gray-100 to-transparent" />
      </div>
      
      
      {/* Items container */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative" style={{ height: `${itemHeight * 2.5}px` }}>
          {[-2, -1, 0, 1, 2].map((position) => {
            const yOffset = (position - displayOffset) * itemHeight;
            const yPosition = (position - displayOffset) / 1.5; // Normalize to -1 to 1 range for center item
            const opacity = getOpacity(yPosition);
            const scale = getScale(yPosition);
            
            return (
              <div
                key={position}
                className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center"
                style={{
                  transform: `translate(-50%, ${yOffset}px) scale(${scale})`,
                  opacity: opacity,
                  top: '50%',
                  marginTop: '-25px', // Half of itemHeight (50px)
                  height: `${itemHeight}px`,
                  width: '100%',
                }}
              >
                <div className="text-2xl px-4 py-2 text-gray-600">
                  {getItemAtPosition(position)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SlotMachine;