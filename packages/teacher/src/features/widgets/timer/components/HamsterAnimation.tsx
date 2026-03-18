import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAnimationFrame } from '@shared/hooks/useAnimationFrame';

interface HamsterAnimationProps {
  isRunning: boolean;
  progress: number;
}

export const HamsterAnimation: React.FC<HamsterAnimationProps> = React.memo(({ isRunning, progress }) => {
  const [pulseAngle, setPulseAngle] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  useAnimationFrame(
    (_, timestamp) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      setPulseAngle(0 - (elapsed / 1000) * 120);
    },
    { isActive: isRunning }
  );

  useEffect(() => {
    if (!isRunning) {
      setPulseAngle(0);
      startTimeRef.current = null;
    }
  }, [isRunning]);

  const isOnColoredArc = useMemo(() => {
    let hamsterAngleInArcCoords = (pulseAngle - 90) % 360;
    if (hamsterAngleInArcCoords < 0) {
      hamsterAngleInArcCoords += 360;
    }

    const arcStartAngle = 270;
    const arcExtent = progress * 360;

    if (progress === 0) {
      return false;
    }

    if (progress >= 0.9999) {
      return true;
    }

    let angleFromStart = hamsterAngleInArcCoords - arcStartAngle;
    if (angleFromStart < 0) {
      angleFromStart += 360;
    }

    return angleFromStart <= arcExtent;
  }, [progress, pulseAngle]);

  return (
    <g transform={`rotate(${pulseAngle} 50 50)`}>
      <g transform="translate(50, 8) scale(0.9, -0.9)">
        {!isOnColoredArc ? (
          <>
            <g stroke="#8B4513" strokeWidth="0.5" fill="none">
              <line x1="0" y1="-5" x2="0" y2="-8" />
              <line x1="3.5" y1="-3.5" x2="5.7" y2="-5.7" />
              <line x1="5" y1="0" x2="8" y2="0" />
              <line x1="3.5" y1="3.5" x2="5.7" y2="5.7" />
              <line x1="0" y1="5" x2="0" y2="8" />
              <line x1="-3.5" y1="3.5" x2="-5.7" y2="5.7" />
              <line x1="-5" y1="0" x2="-8" y2="0" />
              <line x1="-3.5" y1="-3.5" x2="-5.7" y2="-5.7" />
              <line x1="2.5" y1="-4.3" x2="3.5" y2="-6.5" />
              <line x1="4.3" y1="-2.5" x2="6.5" y2="-3.5" />
              <line x1="-2.5" y1="-4.3" x2="-3.5" y2="-6.5" />
              <line x1="-4.3" y1="-2.5" x2="-6.5" y2="-3.5" />
            </g>
            <ellipse cx="0" cy="0" rx="6" ry="4.5" fill="#D2691E" stroke="#8B4513" strokeWidth="0.8" />
            <circle cx="-4" cy="-1.5" r="5" fill="#DEB887" stroke="#8B4513" strokeWidth="0.8" />
            <circle cx="-6.5" cy="-4.5" r="1.8" fill="#D2691E" />
            <circle cx="-1.5" cy="-4.5" r="1.8" fill="#D2691E" />
            <circle cx="-5.5" cy="-1.5" r="1.2" fill="#fff" />
            <circle cx="-2.5" cy="-1.5" r="1.2" fill="#fff" />
            <circle cx="-5.5" cy="-1.5" r="0.8" fill="#000" />
            <circle cx="-2.5" cy="-1.5" r="0.8" fill="#000" />
            <ellipse cx="-4" cy="1" rx="0.8" ry="1.2" fill="#000" />
          </>
        ) : (
          <>
            <ellipse cx="0" cy="0" rx="6" ry="4.5" fill="#D2691E" stroke="#8B4513" strokeWidth="0.8" />
            <circle cx="-4" cy="-1.5" r="3.5" fill="#DEB887" stroke="#8B4513" strokeWidth="0.8" />
            <circle cx="-5.5" cy="-3.5" r="1.3" fill="#D2691E" />
            <circle cx="-2.5" cy="-3.5" r="1.3" fill="#D2691E" />
            <circle cx="-5" cy="-1.5" r="0.7" fill="#000" />
            <circle cx="-3" cy="-1.5" r="0.7" fill="#000" />
            <circle cx="-4.8" cy="-1.8" r="0.3" fill="#fff" />
            <circle cx="-2.8" cy="-1.8" r="0.3" fill="#fff" />
            <circle cx="-6.5" cy="-0.5" r="0.4" fill="#8B4513" />
          </>
        )}
        <g>
          <ellipse cx="-2.5" cy="3.5" rx="1" ry="1.5" fill="#654321" stroke="#3D2611" strokeWidth="0.3" />
          <ellipse cx="-4" cy="3.5" rx="1" ry="1.5" fill="#654321" stroke="#3D2611" strokeWidth="0.3" />
          <ellipse cx="1.5" cy="3.5" rx="1" ry="1.5" fill="#654321" stroke="#3D2611" strokeWidth="0.3" />
          <ellipse cx="3" cy="3.5" rx="1" ry="1.5" fill="#654321" stroke="#3D2611" strokeWidth="0.3" />
        </g>
        <path d="M 4.5 0 Q 7 -1.5 8.5 1" stroke="#8B4513" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </g>
    </g>
  );
});
