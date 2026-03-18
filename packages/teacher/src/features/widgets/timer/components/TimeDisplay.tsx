import React from 'react';
import { cn, text } from '@shared/utils/styles';

interface TimeDisplayProps {
  time: number;
  isEditing: boolean;
  onPause?: () => void;
}

const getDisplayValues = (time: number) => {
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = time % 60;

  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0')
  ];
};

export const TimeDisplay: React.FC<TimeDisplayProps> = ({ time, isEditing, onPause }) => {
  if (isEditing) return null;

  const baseClasses = cn("leading-none font-bold", text.primary);
  const values = getDisplayValues(time);

  return (
    <div className="flex items-center justify-center w-full h-full cursor-pointer" onClick={onPause}>
      {time >= 3600 ? (
        <div className="flex items-center" style={{ fontSize: 'clamp(1rem, 12cqmin, 3rem)' }}>
          <span className={baseClasses}>{values[0]}</span>
          <span className={baseClasses}>:</span>
          <span className={baseClasses}>{values[1]}</span>
          <span className={baseClasses}>:</span>
          <span className={baseClasses}>{values[2]}</span>
        </div>
      ) : time >= 60 ? (
        <div className="flex items-center" style={{ fontSize: 'clamp(1.5rem, 20cqmin, 5rem)' }}>
          <span className={baseClasses}>{values[1]}</span>
          <span className={baseClasses}>:</span>
          <span className={baseClasses}>{values[2]}</span>
        </div>
      ) : (
        <div className="flex items-center" style={{ fontSize: 'clamp(2rem, 28cqmin, 7rem)' }}>
          <span className={baseClasses}>{time}</span>
        </div>
      )}
    </div>
  );
};
