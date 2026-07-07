import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAnimationFrame } from '@shared/hooks/useAnimationFrame';
import { CREATURES, CreatureId } from './creatures';

interface CreatureAnimationProps {
  isRunning: boolean;
  progress: number;
  creature: CreatureId;
  onCreatureClick?: () => void;
}

export const CreatureAnimation: React.FC<CreatureAnimationProps> = React.memo(
  ({ isRunning, progress, creature, onCreatureClick }) => {
    const [pulseAngle, setPulseAngle] = useState(0);
    const angleRef = useRef(0);

    const definition = CREATURES[creature];

    useAnimationFrame(
      (deltaTime) => {
        // Accumulate per frame so switching to a creature with a different
        // speedFactor mid-run doesn't make the runner jump.
        angleRef.current -= (deltaTime / 1000) * 120 * definition.speedFactor;
        setPulseAngle(angleRef.current);
      },
      { isActive: isRunning }
    );

    useEffect(() => {
      if (!isRunning) {
        angleRef.current = 0;
        setPulseAngle(0);
      }
    }, [isRunning]);

    const isOnColoredArc = useMemo(() => {
      let creatureAngleInArcCoords = (pulseAngle - 90) % 360;
      if (creatureAngleInArcCoords < 0) {
        creatureAngleInArcCoords += 360;
      }

      const arcStartAngle = 270;
      const arcExtent = progress * 360;

      if (progress === 0) {
        return false;
      }

      if (progress >= 0.9999) {
        return true;
      }

      let angleFromStart = creatureAngleInArcCoords - arcStartAngle;
      if (angleFromStart < 0) {
        angleFromStart += 360;
      }

      return angleFromStart <= arcExtent;
    }, [progress, pulseAngle]);

    const StateArt = isOnColoredArc ? definition.Calm : definition.Shocked;

    return (
      <g transform={`rotate(${pulseAngle} 50 50)`}>
        {/* Anchor sits 5 units inside the ring stroke so the runner rides the track. */}
        <g
          transform="translate(50, 13) scale(0.9, -0.9)"
          className={onCreatureClick ? 'no-drag' : undefined}
          style={onCreatureClick ? { pointerEvents: 'auto', cursor: 'pointer' } : undefined}
          onClick={onCreatureClick}
          onKeyDown={
            onCreatureClick
              ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onCreatureClick();
                  }
                }
              : undefined
          }
          role={onCreatureClick ? 'button' : undefined}
          tabIndex={onCreatureClick ? 0 : undefined}
          aria-label={onCreatureClick ? `Timer runner: ${definition.name}. Click to change creature.` : undefined}
        >
          {/* Invisible hit area — the drawn shapes are too thin to be a fair click target. */}
          {onCreatureClick && <circle cx="0" cy="-1" r="9.5" fill="transparent" />}
          <StateArt />
        </g>
      </g>
    );
  }
);
