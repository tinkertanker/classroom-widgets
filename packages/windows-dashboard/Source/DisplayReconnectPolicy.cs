namespace ClassroomWidgets;

public enum DisplayReconnectAction
{
    None,
    Hide,
    Show
}

/// <summary>
/// Hides Display when the external display goes away and brings it back when
/// one returns, but only if the hide was ours, not the user's.
/// Mirrors displayReconnect.ts and DisplayPreviewReconnectPolicy.swift.
/// </summary>
public sealed class DisplayReconnectPolicy
{
    /// <summary>Screen notices arrive in bursts during one plug or unplug.</summary>
    public static readonly TimeSpan Debounce = TimeSpan.FromMilliseconds(750);

    /// <summary>How long after an automatic reopen a live stand-in may still move to the saved display.</summary>
    public static readonly TimeSpan StandInSwitchWindow = TimeSpan.FromSeconds(10);

    private enum Phase { Idle, Hiding, HiddenByDisconnect }

    private Phase _phase = Phase.Idle;
    private bool _externalDisplayAvailable;

    public DisplayReconnectPolicy(bool externalDisplayAvailable)
    {
        _externalDisplayAvailable = externalDisplayAvailable;
    }

    public bool HiddenByDisconnect => _phase == Phase.HiddenByDisconnect;

    public DisplayReconnectAction DisplaysChanged(bool externalDisplayAvailable, bool isOpen, bool showOnReconnect)
    {
        var wasAvailable = _externalDisplayAvailable;
        _externalDisplayAvailable = externalDisplayAvailable;
        if (isOpen)
        {
            if (!wasAvailable || externalDisplayAvailable) return DisplayReconnectAction.None;
            _phase = Phase.Hiding;
            return DisplayReconnectAction.Hide;
        }
        if (_phase != Phase.HiddenByDisconnect || !externalDisplayAvailable) return DisplayReconnectAction.None;
        _phase = Phase.Idle;
        return showOnReconnect ? DisplayReconnectAction.Show : DisplayReconnectAction.None;
    }

    public void WindowOpened() => _phase = Phase.Idle;

    public void WindowClosed() => _phase = _phase == Phase.Hiding ? Phase.HiddenByDisconnect : Phase.Idle;
}
