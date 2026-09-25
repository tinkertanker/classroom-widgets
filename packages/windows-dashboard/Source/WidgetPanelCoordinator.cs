using System.Text.Json;
using System.Windows;

namespace ClassroomWidgets;

/// <summary>
/// Coordinates the one-widget-per-window compact presentation. It owns native
/// placement only; widget content and state arrive through versioned host
/// snapshots and flow back through each panel's web bridge.
/// </summary>
public sealed class WidgetPanelCoordinator
{
    private readonly DashboardSettings _settings;
    private readonly Dictionary<string, WidgetPanelWindow> _panels = new();
    private readonly Dictionary<string, Rect> _freeformFrames = new();
    private WidgetPanelInventory? _lastInventory;
    private WidgetPanelLayout _layout = WidgetPanelLayout.Freeform;
    private bool _active = true;
    private IReadOnlyList<CompactWidgetOption> _options = Array.Empty<CompactWidgetOption>();
    private double _backgroundOpacity = 1.0;
    private bool _alwaysOnTop = true;
    private bool _framesDirty;
    private string? _lastActivatedId;

    public event Action<WidgetPanelStateChange>? PanelStateChanged;
    public event Action<JsonElement>? RandomiserListChanged;
    public event Action<int>? WidgetCreationRequested;
    public event Action? DisplayPreviewRequested;
    public event Action<string>? WidgetRemovalRequested;
    public event Action? OpenSettingsRequested;

    public WidgetPanelCoordinator(DashboardSettings settings)
    {
        _settings = settings;
    }

    public bool HasVisiblePanels => _panels.Values.Any(IsPresented);
    public WidgetPanelLayout Layout => _layout;

    public void SetWidgetCreationOptions(IReadOnlyList<CompactWidgetOption> options)
    {
        _options = options;
        foreach (var panel in _panels.Values) panel.SetWidgetCreationOptions(options);
    }

    public void ApplyPresentationSettings(double backgroundOpacity, bool alwaysOnTop)
    {
        _backgroundOpacity = Math.Clamp(backgroundOpacity, 0, 1);
        _alwaysOnTop = alwaysOnTop;
        foreach (var panel in _panels.Values) panel.ApplyPresentationSettings(_backgroundOpacity, _alwaysOnTop);
    }

    /// <summary>
    /// Reconciles the complete host inventory. Lower revisions from the same
    /// host instance are ignored so stale deliveries cannot resurrect or remove
    /// panels; a fresh web process has a new instance ID and restarts at zero.
    /// </summary>
    public bool Reconcile(WidgetPanelInventory inventory)
    {
        if (_lastInventory is not null && inventory.HostInstanceId != _lastInventory.HostInstanceId)
        {
            foreach (var panel in _panels.Values) panel.ClosePermanently();
            _panels.Clear();
            _lastActivatedId = null;
        }
        else if (_lastInventory is not null && inventory.Revision < _lastInventory.Revision)
        {
            return false;
        }
        _lastInventory = inventory;

        var incomingIds = inventory.Widgets.Select(widget => widget.Id).ToHashSet();
        foreach (var (id, panel) in _panels.ToList())
        {
            if (incomingIds.Contains(id)) continue;
            panel.ClosePermanently();
            _panels.Remove(id);
            _freeformFrames.Remove(id);
            if (_lastActivatedId == id) _lastActivatedId = null;
        }

        var created = false;
        var visibilityChanged = false;
        foreach (var descriptor in inventory.Widgets)
        {
            if (_panels.TryGetValue(descriptor.Id, out var existing))
            {
                var wasHidden = existing.IsHidden;
                existing.Apply(descriptor);
                if (descriptor.Hidden)
                {
                    existing.HidePanel();
                    if (_lastActivatedId == descriptor.Id) _lastActivatedId = null;
                }
                else if (_active && wasHidden) existing.ShowPanel();
                visibilityChanged |= wasHidden != descriptor.Hidden;
                continue;
            }
            var panel = MakePanel(descriptor);
            _panels[descriptor.Id] = panel;
            created = true;
            if (_active) panel.ShowPanel();
        }

        if ((created || visibilityChanged) && _layout != WidgetPanelLayout.Freeform) Arrange(_layout);
        return true;
    }

    public bool Activate()
    {
        _active = true;
        if (_panels.Count == 0 && _lastInventory is not null) Reconcile(_lastInventory);
        if (_panels.Count == 0) return false;
        foreach (var panel in _panels.Values) panel.ShowPanel();
        return true;
    }

    public void Deactivate()
    {
        _active = false;
        _lastActivatedId = null;
        foreach (var panel in _panels.Values) panel.ClosePermanently();
        _panels.Clear();
    }

    /// <summary>
    /// Moves the selected panel (active, else most recently activated, else
    /// the only visible one) to the previous/next display in screen order,
    /// keeping its size and work-area offset. Treated like a manual drag:
    /// layout becomes freeform and the new frame is persisted.
    /// </summary>
    public void MoveSelectedPanel(MoveDirection direction)
    {
        var panel = SelectedPanel();
        if (panel is null) return;
        var moved = MoveToNextDisplayGeometry.NextDisplayFrame(panel.CurrentFrame, ScreenGeometry.AllWorkAreas(), direction);
        if (moved is not { } frame) return;
        if (_layout != WidgetPanelLayout.Freeform)
        {
            _layout = WidgetPanelLayout.Freeform;
            _freeformFrames.Clear();
        }
        panel.SetFrame(frame);
        Persist(panel.CurrentFrame, panel.WidgetId);
    }

    private WidgetPanelWindow? SelectedPanel()
    {
        var active = _panels.Values.FirstOrDefault(panel => panel.IsActive && !panel.IsHidden);
        if (active is not null) return active;
        if (_lastActivatedId is { } lastId)
        {
            return _panels.TryGetValue(lastId, out var remembered) && remembered.IsVisible && !remembered.IsHidden
                ? remembered
                : null;
        }
        var visible = _panels.Values.Where(panel => panel.IsVisible && !panel.IsHidden).ToList();
        return visible.Count == 1 ? visible[0] : null;
    }

    public void FlushPersistedFrames()
    {
        if (!_framesDirty) return;
        _framesDirty = false;
        _settings.Save();
    }

    /// <summary>
    /// Collects unsent state from every panel before the host reloads. Panels
    /// that fail to answer make the whole preparation fail so no writes are lost.
    /// </summary>
    public async Task<(IReadOnlyList<WidgetPanelStateChange> Changes, bool Prepared)> PrepareForDeactivationAsync()
    {
        _active = false;
        var results = await Task.WhenAll(_panels.Values.Select(panel => panel.TakePendingStateAsync()));
        var changes = results.Where(result => result.Change is not null).Select(result => result.Change!).ToList();
        var prepared = results.All(result => result.Prepared);
        return (changes, prepared);
    }

    /// <summary>
    /// Lays out the panels that are on screen. The target display is
    /// <paramref name="workArea"/> when given (the requesting panel's), else the
    /// selected panel's, else the first on-screen panel's in inventory order.
    /// </summary>
    public void Arrange(WidgetPanelLayout layout, Rect? workArea = null)
    {
        var previous = _layout;
        _layout = layout;
        if (layout == WidgetPanelLayout.Freeform)
        {
            RestoreFreeformFrames();
            return;
        }

        var ordered = OrderedPanels;
        if (previous == WidgetPanelLayout.Freeform)
        {
            // Includes panels closed but not yet removed by the host, so they
            // keep their frame if the removal never arrives.
            _freeformFrames.Clear();
            foreach (var panel in ordered) _freeformFrames[panel.WidgetId] = panel.CurrentFrame;
        }
        var panels = ordered.Where(IsPresented).ToList();
        if (panels.Count == 0) return;

        var anchor = SelectedPanel() ?? panels[0];
        var target = workArea ?? ScreenGeometry.WorkAreaContaining(anchor.CurrentFrame);
        var usable = new Rect(target.X + 12, target.Y + 12, Math.Max(target.Width - 24, 1), Math.Max(target.Height - 24, 1));
        var frames = WidgetPanelLayoutEngine.Frames(
            panels.Select(panel => (panel.WidgetId, panel.PreferredFrameSize)).ToList(),
            layout,
            usable);
        foreach (var panel in panels)
        {
            if (frames.TryGetValue(panel.WidgetId, out var frame)) panel.SetFrame(ScreenGeometry.Clamp(frame, target));
        }
    }

    private void RestoreFreeformFrames()
    {
        foreach (var panel in OrderedPanels)
        {
            var saved = _freeformFrames.TryGetValue(panel.WidgetId, out var remembered)
                ? remembered
                : StoredFrame(panel.WidgetId);
            var frame = saved is { } savedFrame
                ? (panel.IsResizable ? savedFrame : new Rect(savedFrame.TopLeft, panel.PreferredFrameSize))
                : panel.DefaultFrame();
            panel.SetFrame(ScreenGeometry.Clamp(frame, ScreenGeometry.WorkAreaContaining(frame)));
        }
    }

    // A panel the user closed is hidden at once but stays registered until the
    // host's next inventory removes it; only panels actually on screen count.
    private static bool IsPresented(WidgetPanelWindow panel) => panel.IsVisible && !panel.IsHidden;

    private List<WidgetPanelWindow> OrderedPanels => _lastInventory is null
        ? _panels.Values.Where(panel => !panel.IsHidden).OrderBy(panel => panel.WidgetId, StringComparer.Ordinal).ToList()
        : _lastInventory.Widgets.Select(widget => _panels.GetValueOrDefault(widget.Id)).Where(panel => panel is not null && !panel.IsHidden).Cast<WidgetPanelWindow>().ToList();

    private WidgetPanelWindow MakePanel(WidgetPanelDescriptor descriptor)
    {
        var panel = new WidgetPanelWindow(descriptor, _backgroundOpacity, _alwaysOnTop, _settings);
        panel.SetWidgetCreationOptions(_options);
        panel.PanelStateChanged += change => PanelStateChanged?.Invoke(change);
        panel.RandomiserListChanged += change => RandomiserListChanged?.Invoke(change);
        panel.RemovalRequested += widgetId => WidgetRemovalRequested?.Invoke(widgetId);
        panel.WidgetCreationRequested += widgetType => WidgetCreationRequested?.Invoke(widgetType);
        panel.DisplayPreviewRequested += () => DisplayPreviewRequested?.Invoke();
        panel.OpenSettingsRequested += () => OpenSettingsRequested?.Invoke();
        panel.LayoutRequested += layout => Arrange(layout, ScreenGeometry.WorkAreaContaining(panel.CurrentFrame));
        panel.Activated += (_, _) => _lastActivatedId = panel.WidgetId;
        panel.FrameChanged += (widgetId, frame) =>
        {
            if (_layout != WidgetPanelLayout.Freeform)
            {
                _layout = WidgetPanelLayout.Freeform;
                _freeformFrames.Clear();
            }
            Persist(frame, widgetId);
        };

        var stored = _layout == WidgetPanelLayout.Freeform ? StoredFrame(descriptor.Id) : null;
        var initial = stored is { } storedFrame
            ? (descriptor.IsResizable ? storedFrame : new Rect(storedFrame.TopLeft, panel.PreferredFrameSize))
            : InitialFrame(panel);
        panel.SetFrame(ScreenGeometry.Clamp(initial, ScreenGeometry.WorkAreaContaining(initial)), initializing: true);
        return panel;
    }

    // Places a brand-new panel to the right of the existing ones along the top
    // of the primary work area, wrapping below them when the row is full.
    private Rect InitialFrame(WidgetPanelWindow panel)
    {
        const double gap = 12;
        var usable = ScreenGeometry.PrimaryWorkArea();
        usable.Inflate(-gap, -gap);
        var size = panel.PreferredFrameSize;
        var existing = _panels.Values.Where(existingPanel => !existingPanel.IsHidden).Select(existingPanel => existingPanel.CurrentFrame).ToList();
        var nextX = (existing.Count > 0 ? existing.Max(frame => frame.Right) : usable.Left - gap) + gap;
        if (nextX + size.Width <= usable.Right)
        {
            return new Rect(nextX, usable.Top, size.Width, size.Height);
        }
        var nextY = (existing.Count > 0 ? existing.Max(frame => frame.Bottom) : usable.Top - gap) + gap;
        return new Rect(usable.Left, nextY, size.Width, size.Height);
    }

    private void Persist(Rect frame, string widgetId)
    {
        _settings.PanelFrames[widgetId] = new PanelFrame { Left = frame.X, Top = frame.Y, Width = frame.Width, Height = frame.Height };
        _framesDirty = true;
    }

    private Rect? StoredFrame(string widgetId)
    {
        if (!_settings.PanelFrames.TryGetValue(widgetId, out var stored)) return null;
        if (stored.Width <= 0 || stored.Height <= 0) return null;
        return new Rect(stored.Left, stored.Top, stored.Width, stored.Height);
    }
}

public static class WidgetPanelLayoutEngine
{
    private const double Gap = 12;

    public static Dictionary<string, Rect> Frames(IReadOnlyList<(string Id, Size Size)> panels, WidgetPanelLayout layout, Rect usable)
    {
        var frames = new Dictionary<string, Rect>();
        if (panels.Count == 0) return frames;

        var sizes = panels.Select(panel => (panel.Id, Size: Constrain(panel.Size, usable.Size))).ToList();
        var placed = new List<(string Id, Size Size)>();
        var overflow = new List<(string Id, Size Size)>();
        double used = 0;
        foreach (var panel in sizes)
        {
            var extent = layout == WidgetPanelLayout.Row ? panel.Size.Width : panel.Size.Height;
            var limit = layout == WidgetPanelLayout.Row ? usable.Width : usable.Height;
            var next = used + extent + (placed.Count > 0 ? Gap : 0);
            if (next <= limit || placed.Count == 0)
            {
                placed.Add(panel);
                used = next;
            }
            else
            {
                overflow.Add(panel);
            }
        }

        if (layout == WidgetPanelLayout.Row)
        {
            var x = usable.X + Math.Max(0, (usable.Width - used) / 2);
            var rowHeight = placed.Max(panel => panel.Size.Height);
            var y = usable.Y + Math.Max(0, (usable.Height - rowHeight) / 2);
            foreach (var panel in placed)
            {
                frames[panel.Id] = new Rect(x, y + (rowHeight - panel.Size.Height) / 2, panel.Size.Width, panel.Size.Height);
                x += panel.Size.Width + Gap;
            }
        }
        else
        {
            var columnWidth = placed.Max(panel => panel.Size.Width);
            var x = usable.Right - columnWidth;
            var y = usable.Y + Math.Max(0, (usable.Height - used) / 2);
            foreach (var panel in placed)
            {
                frames[panel.Id] = new Rect(x + (columnWidth - panel.Size.Width) / 2, y, panel.Size.Width, panel.Size.Height);
                y += panel.Size.Height + Gap;
            }
        }

        var cascade = 0;
        foreach (var panel in overflow)
        {
            var offset = 28 * cascade++;
            frames[panel.Id] = new Rect(
                usable.X + Math.Min(offset, Math.Max(0, usable.Width - panel.Size.Width)),
                usable.Y + Math.Min(offset, Math.Max(0, usable.Height - panel.Size.Height)),
                panel.Size.Width,
                panel.Size.Height);
        }
        return frames;
    }

    private static Size Constrain(Size size, Size maximum)
        => new(Math.Min(size.Width, maximum.Width), Math.Min(size.Height, maximum.Height));
}

public static class ScreenGeometry
{
    /// <summary>Work area (in WPF device-independent units) of the monitor holding most of the frame.</summary>
    public static Rect WorkAreaContaining(Rect frame)
    {
        var best = Rect.Empty;
        double bestArea = -1;
        foreach (var screen in System.Windows.Forms.Screen.AllScreens)
        {
            var workArea = WorkAreaInDips(screen);
            var overlap = Rect.Intersect(workArea, frame);
            var size = overlap.IsEmpty ? 0 : overlap.Width * overlap.Height;
            if (size > bestArea)
            {
                bestArea = size;
                best = workArea;
            }
        }
        return best.IsEmpty ? PrimaryWorkArea() : best;
    }

    /// <summary>
    /// Converts a monitor's pixel work area using that monitor's own effective
    /// DPI, so mixed-DPI setups (e.g. a 150% laptop screen driving a 100%
    /// projector) map to the right WPF coordinates.
    /// </summary>
    /// <summary>Every monitor's work area in DIPs, ordered by origin (x, then y).</summary>
    public static IReadOnlyList<Rect> AllWorkAreas() => System.Windows.Forms.Screen.AllScreens
        .Select(WorkAreaInDips)
        .OrderBy(area => area.X).ThenBy(area => area.Y)
        .ToList();

    internal static Rect WorkAreaInDips(System.Windows.Forms.Screen screen)
    {
        var bounds = screen.Bounds;
        var center = new NativeMonitorMethods.POINT { X = bounds.Left + bounds.Width / 2, Y = bounds.Top + bounds.Height / 2 };
        var monitor = NativeMonitorMethods.MonitorFromPoint(center, NativeMonitorMethods.MONITOR_DEFAULTTONEAREST);
        var scale = monitor != IntPtr.Zero
            && NativeMonitorMethods.GetDpiForMonitor(monitor, NativeMonitorMethods.MDT_EFFECTIVE_DPI, out var dpiX, out _) == 0
            && dpiX > 0
                ? dpiX / 96.0
                : DisplayScale();
        return ToDip(screen.WorkingArea, scale);
    }

    private static class NativeMonitorMethods
    {
        public const uint MONITOR_DEFAULTTONEAREST = 2;
        public const int MDT_EFFECTIVE_DPI = 0;

        [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
        public struct POINT
        {
            public int X;
            public int Y;
        }

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern IntPtr MonitorFromPoint(POINT point, uint flags);

        [System.Runtime.InteropServices.DllImport("shcore.dll")]
        public static extern int GetDpiForMonitor(IntPtr monitor, int dpiType, out uint dpiX, out uint dpiY);
    }

    public static Rect PrimaryWorkArea() => SystemParameters.WorkArea;

    public static Rect Clamp(Rect frame, Rect bounds)
    {
        var width = Math.Min(frame.Width, bounds.Width);
        var height = Math.Min(frame.Height, bounds.Height);
        var x = Math.Min(Math.Max(frame.X, bounds.X), bounds.Right - width);
        var y = Math.Min(Math.Max(frame.Y, bounds.Y), bounds.Bottom - height);
        return new Rect(x, y, width, height);
    }

    private static double DisplayScale()
    {
        var primary = SystemParameters.PrimaryScreenWidth;
        var pixels = System.Windows.Forms.Screen.PrimaryScreen?.Bounds.Width ?? primary;
        return primary > 0 ? pixels / primary : 1;
    }

    private static Rect ToDip(System.Drawing.Rectangle rectangle, double scale)
        => new(rectangle.X / scale, rectangle.Y / scale, rectangle.Width / scale, rectangle.Height / scale);
}
