using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Windows.Input;
using System.Windows.Interop;

namespace ClassroomWidgets;

public enum WidgetShortcutStatus
{
    Inactive,
    Active,
    Conflict
}

public sealed record WidgetShortcutRegistration(WidgetShortcutStatus Status, string? Detail = null);

public enum WidgetShortcutAction
{
    Show,
    Dismiss,
    Toggle
}

public readonly record struct WidgetShortcutGesture(uint Modifiers, uint VirtualKey, string Display)
{
    private const uint Alt = 0x0001;
    private const uint Control = 0x0002;
    private const uint Shift = 0x0004;
    private const uint Windows = 0x0008;

    public static bool TryFromKey(Key key, ModifierKeys modifiers, out WidgetShortcutGesture gesture)
    {
        gesture = default;
        if (key is Key.LeftCtrl or Key.RightCtrl or Key.LeftAlt or Key.RightAlt or Key.LeftShift or Key.RightShift or Key.LWin or Key.RWin or Key.None) return false;
        if (modifiers == ModifierKeys.None) return false;

        var nativeModifiers = 0u;
        var parts = new List<string>();
        if (modifiers.HasFlag(ModifierKeys.Control)) { nativeModifiers |= Control; parts.Add("Ctrl"); }
        if (modifiers.HasFlag(ModifierKeys.Alt)) { nativeModifiers |= Alt; parts.Add("Alt"); }
        if (modifiers.HasFlag(ModifierKeys.Shift)) { nativeModifiers |= Shift; parts.Add("Shift"); }
        if (modifiers.HasFlag(ModifierKeys.Windows)) { nativeModifiers |= Windows; parts.Add("Win"); }
        var virtualKey = (uint)KeyInterop.VirtualKeyFromKey(key);
        if (virtualKey == 0) return false;
        parts.Add(KeyName(key));
        gesture = new WidgetShortcutGesture(nativeModifiers, virtualKey, string.Join('+', parts));
        return true;
    }

    public static bool TryParse(string? value, out WidgetShortcutGesture gesture)
    {
        gesture = default;
        if (string.IsNullOrWhiteSpace(value)) return false;
        var tokens = value.Split('+', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        if (tokens.Length < 2) return false;
        var modifiers = ModifierKeys.None;
        foreach (var token in tokens[..^1])
        {
            if (token.Equals("Ctrl", StringComparison.OrdinalIgnoreCase)) modifiers |= ModifierKeys.Control;
            else if (token.Equals("Alt", StringComparison.OrdinalIgnoreCase)) modifiers |= ModifierKeys.Alt;
            else if (token.Equals("Shift", StringComparison.OrdinalIgnoreCase)) modifiers |= ModifierKeys.Shift;
            else if (token.Equals("Win", StringComparison.OrdinalIgnoreCase)) modifiers |= ModifierKeys.Windows;
            else return false;
        }
        var keyToken = tokens[^1];
        Key key;
        if (keyToken.Length == 1 && char.IsDigit(keyToken[0])) key = (Key)((int)Key.D0 + keyToken[0] - '0');
        else if (keyToken.StartsWith("Num", StringComparison.OrdinalIgnoreCase) && keyToken.Length == 4 && char.IsDigit(keyToken[3])) key = (Key)((int)Key.NumPad0 + keyToken[3] - '0');
        else if (!Enum.TryParse(keyToken, ignoreCase: true, out key)) return false;
        return TryFromKey(key, modifiers, out gesture);
    }

    private static string KeyName(Key key) => key switch
    {
        >= Key.D0 and <= Key.D9 => ((int)(key - Key.D0)).ToString(),
        >= Key.NumPad0 and <= Key.NumPad9 => $"Num{(int)(key - Key.NumPad0)}",
        _ => key.ToString()
    };
}

public sealed class WidgetShortcutManager : IDisposable
{
    private const int WmHotKey = 0x0312;
    private const uint NoRepeat = 0x4000;
    private static readonly nint MessageOnlyWindow = new(-3);

    private readonly DashboardSettings _settings;
    private readonly WidgetHostController _host;
    private readonly HwndSource _source;
    private readonly Dictionary<int, (int WidgetType, WidgetShortcutAction Action)> _registeredIds = new();
    private readonly Dictionary<(int WidgetType, WidgetShortcutAction Action), WidgetShortcutRegistration> _statuses = new();
    private bool _suspended;

    public event Action? StatusChanged;

    public WidgetShortcutManager(DashboardSettings settings, WidgetHostController host)
    {
        _settings = settings;
        _host = host;
        _source = new HwndSource(new HwndSourceParameters("ClassroomWidgets.Shortcuts")
        {
            ParentWindow = MessageOnlyWindow,
            WindowStyle = 0
        });
        _source.AddHook(WndProc);
        _settings.Changed += Refresh;
        _host.WidgetOptionsChanged += OnWidgetOptionsChanged;
        Refresh();
    }

    public WidgetShortcutRegistration StatusFor(int widgetType, WidgetShortcutAction action) => _statuses.GetValueOrDefault(
        (widgetType, action), new WidgetShortcutRegistration(WidgetShortcutStatus.Inactive));

    public void Suspend()
    {
        if (_suspended) return;
        _suspended = true;
        UnregisterAll(clearStatuses: false);
    }

    public void Resume()
    {
        if (!_suspended) return;
        _suspended = false;
        Refresh();
    }

    public bool IsDuplicate(int widgetType, string shortcut) =>
        WidgetShortcutGesture.TryParse(shortcut, out var candidate) &&
        new[] { _settings.WidgetShortcuts, _settings.WidgetDismissShortcuts }.Any(bindings =>
            bindings.Any(entry => entry.Key != widgetType &&
                WidgetShortcutGesture.TryParse(entry.Value, out var existing) && existing == candidate));

    public void Refresh()
    {
        if (_suspended) return;
        UnregisterAll(clearStatuses: true);
        var optionTypes = _host.WidgetOptions.Select(option => option.WidgetType).ToHashSet();
        var id = 1;
        var seen = new HashSet<WidgetShortcutGesture>();
        foreach (var widgetType in optionTypes)
        {
            var hasShow = WidgetShortcutGesture.TryParse(_settings.WidgetShortcuts.GetValueOrDefault(widgetType), out var show);
            var hasDismiss = WidgetShortcutGesture.TryParse(_settings.WidgetDismissShortcuts.GetValueOrDefault(widgetType), out var dismiss);
            if (hasShow && hasDismiss && show == dismiss)
            {
                Register(id++, widgetType, WidgetShortcutAction.Toggle, show, seen);
                var status = _statuses[(widgetType, WidgetShortcutAction.Toggle)];
                _statuses[(widgetType, WidgetShortcutAction.Show)] = status;
                _statuses[(widgetType, WidgetShortcutAction.Dismiss)] = status;
            }
            else
            {
                if (hasShow) Register(id++, widgetType, WidgetShortcutAction.Show, show, seen);
                if (hasDismiss) Register(id++, widgetType, WidgetShortcutAction.Dismiss, dismiss, seen);
            }
        }
        StatusChanged?.Invoke();
    }

    private void Register(int id, int widgetType, WidgetShortcutAction action, WidgetShortcutGesture gesture, HashSet<WidgetShortcutGesture> seen)
    {
        var key = (widgetType, action);
        if (!seen.Add(gesture))
        {
            _statuses[key] = new WidgetShortcutRegistration(WidgetShortcutStatus.Conflict, "Duplicate assignment");
            return;
        }
        if (RegisterHotKey(_source.Handle, id, gesture.Modifiers | NoRepeat, gesture.VirtualKey))
        {
            _registeredIds[id] = key;
            _statuses[key] = new WidgetShortcutRegistration(WidgetShortcutStatus.Active);
            return;
        }
        var error = new Win32Exception(Marshal.GetLastWin32Error());
        _statuses[key] = new WidgetShortcutRegistration(WidgetShortcutStatus.Conflict, error.Message);
        DashboardLog.Warn($"Unable to register {action.ToString().ToLowerInvariant()} shortcut {gesture.Display} for type {widgetType}: {error.Message}");
    }

    private void OnWidgetOptionsChanged()
    {
        if (!_settings.InitializeWidgetShortcuts(_host.WidgetOptions)) Refresh();
    }

    private nint WndProc(nint hwnd, int message, nint wParam, nint lParam, ref bool handled)
    {
        if (message != WmHotKey || !_registeredIds.TryGetValue(wParam.ToInt32(), out var registration)) return 0;
        handled = true;
        if (!_host.IsAvailable) return 0;
        _ = registration.Action switch
        {
            WidgetShortcutAction.Show => _host.AddWidgetAsync(registration.WidgetType),
            WidgetShortcutAction.Dismiss => _host.DismissWidgetAsync(registration.WidgetType),
            _ => _host.ToggleWidgetAsync(registration.WidgetType)
        };
        return 0;
    }

    private void UnregisterAll(bool clearStatuses)
    {
        foreach (var id in _registeredIds.Keys) UnregisterHotKey(_source.Handle, id);
        _registeredIds.Clear();
        if (clearStatuses) _statuses.Clear();
    }

    public void Dispose()
    {
        _settings.Changed -= Refresh;
        _host.WidgetOptionsChanged -= OnWidgetOptionsChanged;
        UnregisterAll(clearStatuses: true);
        _source.RemoveHook(WndProc);
        _source.Dispose();
    }

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool RegisterHotKey(nint hwnd, int id, uint modifiers, uint virtualKey);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnregisterHotKey(nint hwnd, int id);
}
