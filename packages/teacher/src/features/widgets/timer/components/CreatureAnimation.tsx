import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAnimationFrame } from '@shared/hooks/useAnimationFrame';
import { CREATURES, CreatureId } from './creatures';

interface CreatureAnimationProps {
  isRunning: boolean;
  progress: number;
  creature: CreatureId;
  onCreatureClick?: () => void;
}

function computeIsOnColoredArc(pulseAngle: number, progress: number): boolean {
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
}

export const CreatureAnimation: React.FC<CreatureAnimationProps> = React.memo(
  ({ isRunning, progress, creature, onCreatureClick }) => {
    // The rotation is written straight to the SVG node each frame; routing it
    // through React state would re-render this subtree at 60fps. Only the
    // calm/shocked art swap (a boolean that flips at most twice per lap) goes
    // through state.
    const angleRef = useRef(0);
    const orbitRef = useRef<SVGGElement>(null);
    const progressRef = useRef(progress);
    progressRef.current = progress;
    const [isOnColoredArc, setIsOnColoredArc] = useState(() =>
      computeIsOnColoredArc(0, progress)
    );

    const definition = CREATURES[creature];

    const applyAngle = useCallback((angle: number) => {
      angleRef.current = angle;
      orbitRef.current?.setAttribute('transform', `rotate(${angle} 50 50)`);
      setIsOnColoredArc(computeIsOnColoredArc(angle, progressRef.current));
    }, []);

    useAnimationFrame(
      (deltaTime) => {
        // Accumulate per frame so switching to a creature with a different
        // speedFactor mid-run doesn't make the runner jump.
        applyAngle(angleRef.current - (deltaTime / 1000) * 120 * definition.speedFactor);
      },
      { isActive: isRunning }
    );

    useEffect(() => {
      if (!isRunning) {
        applyAngle(0);
      }
    }, [isRunning, applyAngle]);

    // Progress moves once per second between frames of a paused animation, so
    // re-check the arc when it changes too.
    useEffect(() => {
      setIsOnColoredArc(computeIsOnColoredArc(angleRef.current, progress));
    }, [progress]);

    const StateArt = isOnColoredArc ? definition.Calm : definition.Shocked;

    return (
      <g ref={orbitRef} transform={`rotate(${angleRef.current} 50 50)`}>
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
