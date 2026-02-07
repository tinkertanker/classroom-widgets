import { useState, useRef, useMemo } from 'react';
import { useAnimationFrame } from '@shared/hooks/useAnimationFrame';

interface UseTimerAnimationProps {
  isRunning: boolean;
  progress: number;
}

/**
 * Hook to manage timer animations including the hamster wheel rotation
 * and arc path calculations
 */
export function useTimerAnimation({ isRunning, progress }: UseTimerAnimationProps) {
  const [pulseAngle, setPulseAngle] = useState(0); // Start at top (no rotation needed since hamster is already at top)
  const startTimeRef = useRef<number | null>(null);

  // Animate the hamster wheel rotation using the reusable hook
  useAnimationFrame(
    (deltaTime, timestamp) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }
      
      const elapsed = timestamp - startTimeRef.current;
      // Complete one rotation every 3 seconds counter-clockwise (-120 degrees/second)
      const angle = 0 - (elapsed / 1000) * 120;
      setPulseAngle(angle);
    },
    { isActive: isRunning }
  );

  // Reset angle when not running
  if (!isRunning) {
    if (pulseAngle !== 0) {
      setPulseAngle(0);
    }
    startTimeRef.current = null;
  }

  // Determine if hamster is over the colored arc or grey arc
  const isHamsterOnColoredArc = useMemo(() => {
    // The hamster is at translate(50, 8) which is at the top of the circle
    // With pulseAngle=0, it's at the top (north)
    // As pulseAngle decreases (negative), it rotates counter-clockwise
    
    // Normalize hamster angle to 0-360 range
    // Since hamster starts at top with angle 0, and rotates counter-clockwise (negative angles)
    // We need to add 90 to align with the arc's coordinate system where -90° = top
    let hamsterAngleInArcCoords = (pulseAngle - 90) % 360;
    if (hamsterAngleInArcCoords < 0) {
      hamsterAngleInArcCoords += 360;
    }
    
    // The colored arc starts at -90 degrees (top) and extends clockwise
    // In 0-360 range: -90° = 270°
    const arcStartAngle = 270;
    // The arc extends by progress * 360 degrees clockwise from the start
    const arcExtent = progress * 360;
    
    // Check if hamster is within the colored arc range
    if (progress === 0) {
      return false; // No colored arc when progress is 0
    } else if (progress >= 0.9999) {
      return true; // Full circle, hamster is always on colored arc
    }
    
    // For a clockwise arc from startAngle extending arcExtent degrees
    // We need to check if the hamster angle is within this range
    let angleFromStart = hamsterAngleInArcCoords - arcStartAngle;
    if (angleFromStart < 0) {
      angleFromStart += 360;
    }
    
    // The hamster is on the colored arc if it's within the arc extent
    return angleFromStart <= arcExtent;
  }, [pulseAngle, progress]);

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
    getArcPath,
    isHamsterOnColoredArc,
    isHamsterOnGreyArc: !isHamsterOnColoredArc
  };
}