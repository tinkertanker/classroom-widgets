import { useState, useRef } from 'react';
import { useAnimationFrame } from '../../../../shared/hooks/useAnimationFrame';

interface UseTimerAnimationProps {
  isRunning: boolean;
  progress: number;
}

/**
 * Hook to manage timer animations including the hamster wheel rotation
 * and arc path calculations
 */
export function useTimerAnimation({ isRunning, progress }: UseTimerAnimationProps) {
  const [pulseAngle, setPulseAngle] = useState(-90); // Start at top
  const startTimeRef = useRef<number | null>(null);

  // Animate the hamster wheel rotation using the reusable hook
  useAnimationFrame(
    (deltaTime, timestamp) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }
      
      const elapsed = timestamp - startTimeRef.current;
      // Complete one rotation every 3 seconds counter-clockwise (-120 degrees/second)
      const angle = -90 - (elapsed / 1000) * 120;
      setPulseAngle(angle);
    },
    { isActive: isRunning }
  );

  // Reset angle when not running
  if (!isRunning) {
    if (pulseAngle !== -90) {
      setPulseAngle(-90);
    }
    startTimeRef.current = null;
  }

  // Calculate SVG path for the arc
  const getArcPath = (percentage: number) => {
    const centerRadius = 45;
    const strokeWidth = 3;
    const outerRadius = centerRadius + strokeWidth / 2;
    const innerRadius = centerRadius - strokeWidth / 2;
    const startAngle = -90; // Start at top
    const endAngle = startAngle + (percentage * 360);
    
    const startAngleRad = (startAngle * Math.PI) / 180;
    const endAngleRad = (endAngle * Math.PI) / 180;
    
    // Outer arc points
    const x1 = 50 + outerRadius * Math.cos(startAngleRad);
    const y1 = 50 + outerRadius * Math.sin(startAngleRad);
    const x2 = 50 + outerRadius * Math.cos(endAngleRad);
    const y2 = 50 + outerRadius * Math.sin(endAngleRad);
    
    // Inner arc points
    const x3 = 50 + innerRadius * Math.cos(endAngleRad);
    const y3 = 50 + innerRadius * Math.sin(endAngleRad);
    const x4 = 50 + innerRadius * Math.cos(startAngleRad);
    const y4 = 50 + innerRadius * Math.sin(startAngleRad);
    
    const largeArcFlag = percentage > 0.5 ? 1 : 0;
    
    if (percentage >= 0.9999) {
      // Full circle requires special handling
      return `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 1 1 ${x1 - 0.01} ${y1} L ${x4 - 0.01} ${y4} A ${innerRadius} ${innerRadius} 0 1 0 ${x4} ${y4} Z`;
    } else if (percentage <= 0.0001) {
      return '';
    }
    
    return `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4} Z`;
  };

  const arcPath = getArcPath(progress);

  return {
    pulseAngle,
    arcPath,
    getArcPath
  };
}