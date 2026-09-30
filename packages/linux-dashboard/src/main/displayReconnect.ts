export type DisplayReconnectAction = 'none' | 'hide' | 'show';

/** Screen notices arrive in bursts during one plug or unplug. */
export const DISPLAY_RECONNECT_DEBOUNCE_MS = 750;

/**
 * Hides Display when the external display goes away and brings it back when
 * one returns, but only if the hide was ours, not the user's.
 * Mirrors DisplayReconnectPolicy.cs and DisplayPreviewReconnectPolicy.swift.
 */
export class DisplayReconnectPolicy {
  private phase: 'idle' | 'hiding' | 'hiddenByDisconnect' = 'idle';

  constructor(private externalDisplayAvailable: boolean) {}

  get hiddenByDisconnect(): boolean {
    return this.phase === 'hiddenByDisconnect';
  }

  displaysChanged(externalDisplayAvailable: boolean, isOpen: boolean, showOnReconnect: boolean): DisplayReconnectAction {
    const wasAvailable = this.externalDisplayAvailable;
    this.externalDisplayAvailable = externalDisplayAvailable;
    if (isOpen) {
      if (!wasAvailable || externalDisplayAvailable) return 'none';
      this.phase = 'hiding';
      return 'hide';
    }
    if (this.phase !== 'hiddenByDisconnect' || !externalDisplayAvailable) return 'none';
    this.phase = 'idle';
    return showOnReconnect ? 'show' : 'none';
  }

  windowOpened(): void {
    this.phase = 'idle';
  }

  windowClosed(): void {
    this.phase = this.phase === 'hiding' ? 'hiddenByDisconnect' : 'idle';
  }
}
