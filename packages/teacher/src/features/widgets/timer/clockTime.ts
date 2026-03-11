export type ClockPeriod = 'AM' | 'PM';

export interface ClockTimeSelection {
  hour: number;
  minute: number;
  period: ClockPeriod;
}

export const getClockSelectionFromDate = (date: Date): ClockTimeSelection => {
  const hours = date.getHours();

  return {
    hour: hours % 12 || 12,
    minute: date.getMinutes(),
    period: hours >= 12 ? 'PM' : 'AM'
  };
};

export const getDefaultTargetSelection = (now: Date = new Date()): ClockTimeSelection => {
  const nextHalfHour = new Date(now);
  const minutes = now.getMinutes();

  if (minutes === 0 || minutes === 30) {
    nextHalfHour.setMinutes(minutes + 30);
  } else if (minutes < 30) {
    nextHalfHour.setMinutes(30);
  } else {
    nextHalfHour.setHours(nextHalfHour.getHours() + 1);
    nextHalfHour.setMinutes(0);
  }

  nextHalfHour.setSeconds(0, 0);

  return getClockSelectionFromDate(nextHalfHour);
};

export const getSecondsUntilClockTime = (
  selection: ClockTimeSelection,
  now: Date = new Date()
): number => {
  const targetTime = new Date(now);
  let hours24 = selection.hour;

  if (selection.period === 'PM' && selection.hour !== 12) {
    hours24 = selection.hour + 12;
  } else if (selection.period === 'AM' && selection.hour === 12) {
    hours24 = 0;
  }

  targetTime.setHours(hours24, selection.minute, 0, 0);

  if (targetTime.getTime() <= now.getTime()) {
    targetTime.setDate(targetTime.getDate() + 1);
  }

  return Math.max(1, Math.ceil((targetTime.getTime() - now.getTime()) / 1000));
};

export const formatClockSelection = (selection: ClockTimeSelection): string => {
  return `${selection.hour}:${selection.minute.toString().padStart(2, '0')} ${selection.period}`;
};
