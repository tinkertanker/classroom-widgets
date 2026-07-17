import { describe, it, expect } from 'vitest';
import { getEmptyStateButtonText, getEmptyStateDisabled } from './networkedWidgetHelpers';

describe('getEmptyStateButtonText', () => {
  const base = { isStarting: false, isRecovering: false, isConnected: true, defaultText: 'Start Poll' };

  it('returns the default text when idle and connected', () => {
    expect(getEmptyStateButtonText(base)).toBe('Start Poll');
  });

  it('prioritises starting over every other state', () => {
    expect(getEmptyStateButtonText({
      ...base, isStarting: true, isRecovering: true, isConnected: false
    })).toBe('Starting...');
  });

  it('prioritises recovering over disconnected', () => {
    expect(getEmptyStateButtonText({
      ...base, isRecovering: true, isConnected: false
    })).toBe('Reconnecting...');
  });

  it('shows connecting when only disconnected', () => {
    expect(getEmptyStateButtonText({ ...base, isConnected: false })).toBe('Connecting...');
  });
});

describe('getEmptyStateDisabled', () => {
  it('is enabled only when connected, not starting, and not recovering', () => {
    expect(getEmptyStateDisabled({ isStarting: false, isRecovering: false, isConnected: true })).toBe(false);
  });

  it('is disabled in every degraded state', () => {
    expect(getEmptyStateDisabled({ isStarting: true, isRecovering: false, isConnected: true })).toBe(true);
    expect(getEmptyStateDisabled({ isStarting: false, isRecovering: true, isConnected: true })).toBe(true);
    expect(getEmptyStateDisabled({ isStarting: false, isRecovering: false, isConnected: false })).toBe(true);
  });
});
