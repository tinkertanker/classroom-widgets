import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAnimationFrame } from '@shared/hooks/useAnimationFrame';
import { CREATURES, CreatureId } from './creatures';

interface CreatureAnimationProps {
  isRunning: boolean;
  progress: number;
  creature: CreatureId;
  onCreatureClick?: () => void;
}

export const isCreatureOnColoredArc = (angle: number, progress: number): boolean => {
  if (progress === 0) {
    return false;
  }

  if (progress >= 0.9999) {
    return true;
  }

  let creatureAngleInArcCoords = (angle - 90) % 360;
  if (creatureAngleInArcCoords < 0) {
    creatureAngleInArcCoords += 360;
  }

  const arcStartAngle = 270;
  let angleFromStart = creatureAngleInArcCoords - arcStartAngle;
  if (angleFromStart < 0) {
    angleFromStart += 360;
  }

  return angleFromStart <= progress * 360;
};

export const CreatureAnimation: React.FC<CreatureAnimationProps> = React.memo(
  ({ isRunning, progress, creature, onCreatureClick }) => {
    const angleRef = useRef(0);
    const runnerRef = useRef<SVGGElement>(null);
    const progressRef = useRef(progress);
    const artOnColoredArcRef = useRef(isCreatureOnColoredArc(0, progress));
    const [isOnColoredArc, setIsOnColoredArc] = useState(artOnColoredArcRef.current);

    const definition = CREATURES[creature];
    progressRef.current = progress;

    const updateArtIfNeeded = useCallback((angle: number, nextProgress: number) => {
      const nextArtOnColoredArc = isCreatureOnColoredArc(angle, nextProgress);
      if (nextArtOnColoredArc !== artOnColoredArcRef.current) {
        artOnColoredArcRef.current = nextArtOnColoredArc;
        setIsOnColoredArc(nextArtOnColoredArc);
      }
    }, []);

    useAnimationFrame(
      (deltaTime) => {
        // Accumulate per frame so switching to a creature with a different
        // speedFactor mid-run doesn't make the runner jump.
        angleRef.current -= (deltaTime / 1000) * 120 * definition.speedFactor;
        runnerRef.current?.setAttribute('transform', `rotate(${angleRef.current} 50 50)`);
        updateArtIfNeeded(angleRef.current, progressRef.current);
      },
      { isActive: isRunning }
    );

    useEffect(() => {
      if (!isRunning) {
        angleRef.current = 0;
        runnerRef.current?.setAttribute('transform', 'rotate(0 50 50)');
        updateArtIfNeeded(0, progressRef.current);
      }
    }, [isRunning, updateArtIfNeeded]);

    useEffect(() => {
      updateArtIfNeeded(angleRef.current, progress);
    }, [progress, updateArtIfNeeded]);

    const StateArt = isOnColoredArc ? definition.Calm : definition.Shocked;

    return (
      <g ref={runnerRef} transform="rotate(0 50 50)">
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
