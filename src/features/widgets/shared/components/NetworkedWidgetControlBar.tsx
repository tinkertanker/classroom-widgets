import React from 'react';
import { PlayPauseButton } from './PlayPauseButton';
import { SettingsButton } from './SettingsButton';
import { ClearButton } from './ClearButton';
import { WidgetControlBar } from './WidgetControlBar';

interface NetworkedWidgetControlBarProps {
  isActive: boolean;
  isConnected: boolean;
  onToggleActive: () => void;
  onSettings?: () => void;
  onClear?: () => void;
  clearCount?: number;
  clearLabel?: string;
  showClear?: boolean;
  showSettings?: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
  disabled?: boolean;
  className?: string;
  clearVariant?: 'reset' | 'delete' | 'clear';
  requireClearConfirmation?: boolean;
  clearConfirmationMessage?: string;
}

/**
 * Pre-configured control bar for networked widgets (Poll, Questions, RT Feedback).
 * Combines the most common control patterns: play/pause, settings, and clear.
 */
export const NetworkedWidgetControlBar: React.FC<NetworkedWidgetControlBarProps> = ({
  isActive,
  isConnected,
  onToggleActive,
  onSettings,
  onClear,
  clearCount = 0,
  clearLabel,
  showClear = true,
  showSettings = true,
  activeLabel,
  inactiveLabel,
  disabled = false,
  className,
  clearVariant = 'clear',
  requireClearConfirmation = false,
  clearConfirmationMessage
}) => {
  return (
    <WidgetControlBar className={className}>
      <div className="flex items-center gap-2">
        <PlayPauseButton
          isActive={isActive}
          onToggle={onToggleActive}
          disabled={disabled || !isConnected}
          activeLabel={activeLabel}
          inactiveLabel={inactiveLabel}
        />

        {showClear && onClear && (
          <ClearButton
            onClear={onClear}
            count={clearCount}
            label={clearLabel}
            disabled={disabled || !isConnected}
            variant={clearVariant}
            requireConfirmation={requireClearConfirmation}
            confirmationMessage={clearConfirmationMessage}
          />
        )}
      </div>

      {showSettings && onSettings && (
        <SettingsButton
          onClick={onSettings}
          disabled={disabled || !isConnected}
        />
      )}
    </WidgetControlBar>
  );
};

export default NetworkedWidgetControlBar;