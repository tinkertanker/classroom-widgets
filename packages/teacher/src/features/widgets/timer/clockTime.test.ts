import { describe, expect, it } from 'vitest';
import { secondsToTimeSegments } from './clockTime';

describe('secondsToTimeSegments', () => {
  it('returns 0 for 0 seconds', () => {
    expect(secondsToTimeSegments(0)).toEqual({
      hours: 0,
      minutes: 0,
      seconds: 0,
      hoursText: '00',
      minutesText: '00',
      secondsText: '00'
    });
  });

  it('breaks 59 seconds into 0h 0m 59s', () => {
    expect(secondsToTimeSegments(59)).toEqual({
      hours: 0,
      minutes: 0,
      seconds: 59,
      hoursText: '00',
      minutesText: '00',
      secondsText: '59'
    });
  });

  it('breaks 60 seconds into 0h 1m 0s', () => {
    expect(secondsToTimeSegments(60)).toEqual({
      hours: 0,
      minutes: 1,
      seconds: 0,
      hoursText: '00',
      minutesText: '01',
      secondsText: '00'
    });
  });

  it('breaks 3599 seconds into 0h 59m 59s', () => {
    expect(secondsToTimeSegments(3599)).toEqual({
      hours: 0,
      minutes: 59,
      seconds: 59,
      hoursText: '00',
      minutesText: '59',
      secondsText: '59'
    });
  });

  it('breaks 3600 seconds into 1h 0m 0s', () => {
    expect(secondsToTimeSegments(3600)).toEqual({
      hours: 1,
      minutes: 0,
      seconds: 0,
      hoursText: '01',
      minutesText: '00',
      secondsText: '00'
    });
  });

  it('breaks 3661 seconds into 1h 1m 1s', () => {
    expect(secondsToTimeSegments(3661)).toEqual({
      hours: 1,
      minutes: 1,
      seconds: 1,
      hoursText: '01',
      minutesText: '01',
      secondsText: '01'
    });
  });

  it('breaks a large value (359999 seconds) into 99h 59m 59s', () => {
    expect(secondsToTimeSegments(359999)).toEqual({
      hours: 99,
      minutes: 59,
      seconds: 59,
      hoursText: '99',
      minutesText: '59',
      secondsText: '59'
    });
  });

  it.each([0, 59, 60, 3599, 3600, 3661, 359999])(
    'pads all three segments to exactly 2 characters for %i seconds',
    (totalSeconds) => {
      const { hoursText, minutesText, secondsText } = secondsToTimeSegments(totalSeconds);
      expect(hoursText).toHaveLength(2);
      expect(minutesText).toHaveLength(2);
      expect(secondsText).toHaveLength(2);
    }
  );
});
