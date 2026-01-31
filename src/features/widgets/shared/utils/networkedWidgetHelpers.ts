/**
 * Utility functions for networked widgets
 */

export interface GetEmptyStateButtonTextOptions {
  isStarting: boolean;
  isRecovering: boolean;
  isConnected: boolean;
  defaultText: string;
}

/**
 * Returns the appropriate button text for the empty state based on connection status
 */
export function getEmptyStateButtonText({
  isStarting,
  isRecovering,
  isConnected,
  defaultText
}: GetEmptyStateButtonTextOptions): string {
  if (isStarting) return "Starting...";
  if (isRecovering) return "Reconnecting...";
  if (!isConnected) return "Connecting...";
  return defaultText;
}

export interface GetEmptyStateDisabledOptions {
  isStarting: boolean;
  isRecovering: boolean;
  isConnected: boolean;
}

/**
 * Returns whether the empty state button should be disabled
 */
export function getEmptyStateDisabled({
  isStarting,
  isRecovering,
  isConnected
}: GetEmptyStateDisabledOptions): boolean {
  return isStarting || !isConnected || isRecovering;
}
