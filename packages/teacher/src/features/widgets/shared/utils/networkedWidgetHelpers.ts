/**
 * Utility functions for networked widgets
 */

export interface GetEmptyStateButtonTextOptions {
  isStarting: boolean;
  isRecovering: boolean;
  isConnected: boolean;
  isReady?: boolean;
  defaultText: string;
}

/**
 * Returns the appropriate button text for the empty state based on connection status
 */
export function getEmptyStateButtonText({
  isStarting,
  isRecovering,
  isConnected,
  isReady = true,
  defaultText
}: GetEmptyStateButtonTextOptions): string {
  if (isStarting) return "Starting...";
  if (isRecovering) return "Reconnecting...";
  if (!isConnected) return "Connecting...";
  if (!isReady) return "Recover session first";
  return defaultText;
}

export interface GetEmptyStateDisabledOptions {
  isStarting: boolean;
  isRecovering: boolean;
  isConnected: boolean;
  isReady?: boolean;
}

/**
 * Returns whether the empty state button should be disabled
 */
export function getEmptyStateDisabled({
  isStarting,
  isRecovering,
  isConnected,
  isReady = true
}: GetEmptyStateDisabledOptions): boolean {
  return isStarting || !isConnected || isRecovering || !isReady;
}
