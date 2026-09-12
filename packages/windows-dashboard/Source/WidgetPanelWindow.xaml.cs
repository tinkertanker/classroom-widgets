using System.ComponentModel;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Threading;
using Microsoft.Web.WebView2.Core;

namespace ClassroomWidgets;

/// <summary>
/// A borderless always-on-top window presenting exactly one compact widget.
/// The chrome strip (title, add, arrange, close) is revealed while the pointer
/// is over the window and fades out shortly after it leaves.
/// </summary>
public partial class WidgetPanelWindow : Window
{
    public const double ChromeHeight = 30;

    private static readonly Color LightBackground = Color.FromRgb(0xF5, 0xF5, 0xF7);
    private static readonly Color DarkBackground = Color.FromRgb(0x1E, 0x1F, 0x24);
    private static readonly Color LightForeground = Color.FromRgb(0x1F, 0x29, 0x33);
    private static readonly Color DarkForeground = Color.FromRgb(0xE6, 0xE8, 0xEC);

    private WidgetPanelDescriptor _descriptor;
    private double _backgroundOpacity;
    private IReadOnlyList<CompactWidgetOption> _options = Array.Empty<CompactWidgetOption>();
    private readonly DispatcherTimer _hoverTimer;
    private readonly DispatcherTimer _frameTimer;
    private DateTime _pointerLeftAt = DateTime.MinValue;
    private bool _chromeVisible;
    private bool _webReady;
    private bool _panelReady;
    private bool _closingPermanently;
    private bool _programmaticFrameChange;
    private int? _lastPushedRevision;
    private int? _lastPushedStateRevision;
    private TaskCompletionSource? _writesCheckpoint;

    public event Action<WidgetPanelStateChange>? PanelStateChanged;
    public event Action<JsonElement>? RandomiserListChanged;
    public event Action<string>? RemovalRequested;
    public event Action<int>? WidgetCreationRequested;
    public event Action<WidgetPanelLayout>? LayoutRequested;
    public event Action<string, Rect>? FrameChanged;

    public string WidgetId => _descriptor.Id;
    public bool IsResizable => _descriptor.IsResizable;
    public Rect CurrentFrame => new(Left, Top, ActualWidth > 0 ? ActualWidth : Width, ActualHeight > 0 ? ActualHeight : Height);
    public Size PreferredFrameSize
    {
        get
        {
            var content = _descriptor.PreferredContentSize.Clamped();
            return new Size(content.Width, content.Height + ChromeHeight);
        }
    }

    public WidgetPanelWindow(WidgetPanelDescriptor descriptor, double backgroundOpacity, bool alwaysOnTop)
    {
        _descriptor = descriptor;
        _backgroundOpacity = Math.Clamp(backgroundOpacity, 0, 1);
        InitializeComponent();
        Topmost = alwaysOnTop;
        ApplyDescriptorPresentation();

        _hoverTimer = new DispatcherTimer(DispatcherPriority.Background) { Interval = TimeSpan.FromMilliseconds(120) };
        _hoverTimer.Tick += (_, _) => UpdateChromeForPointer();
        _frameTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(400) };
        _frameTimer.Tick += (_, _) =>
        {
            _frameTimer.Stop();
            FrameChanged?.Invoke(WidgetId, CurrentFrame);
        };

        LocationChanged += (_, _) => NoteFrameChange();
        SizeChanged += (_, _) => NoteFrameChange();
        SourceInitialized += (_, _) =>
        {
            ApplyWindowAlpha();
            HwndSource.FromHwnd(new WindowInteropHelper(this).Handle)?.AddHook(WindowProc);
        };
        Loaded += async (_, _) => await InitializeWebViewAsync();
    }

    public void ShowPanel()
    {
        if (_closingPermanently) return;
        if (!IsVisible) Show();
        _hoverTimer.Start();
    }

    public void HidePanel()
    {
        _hoverTimer.Stop();
        if (IsVisible) Hide();
    }

    public void ClosePermanently()
    {
        _closingPermanently = true;
        _hoverTimer.Stop();
        _frameTimer.Stop();
        Close();
    }

    public void Apply(WidgetPanelDescriptor descriptor)
    {
        _descriptor = descriptor;
        ApplyDescriptorPresentation();
        PushSnapshot();
    }

    public void ApplyPresentationSettings(double backgroundOpacity, bool alwaysOnTop)
    {
        _backgroundOpacity = Math.Clamp(backgroundOpacity, 0, 1);
        Topmost = alwaysOnTop;
        ApplyWindowAlpha();
    }

    public void SetWidgetCreationOptions(IReadOnlyList<CompactWidgetOption> options)
    {
        _options = options;
        AddMenu.Items.Clear();
        foreach (var option in options)
        {
            var item = new MenuItem { Header = option.Title, Tag = option.WidgetType };
            item.Click += (_, _) => WidgetCreationRequested?.Invoke(option.WidgetType);
            AddMenu.Items.Add(item);
        }
        AddButton.IsEnabled = options.Count > 0;
    }

    public void SetFrame(Rect frame, bool initializing = false)
    {
        _programmaticFrameChange = true;
        try
        {
            Left = frame.X;
            Top = frame.Y;
            Width = Math.Max(frame.Width, MinWidth);
            Height = Math.Max(frame.Height, MinHeight);
        }
        finally
        {
            _programmaticFrameChange = false;
        }
        if (initializing) _frameTimer.Stop();
    }

    public Rect DefaultFrame()
    {
        var workArea = ScreenGeometry.PrimaryWorkArea();
        var size = PreferredFrameSize;
        var width = Math.Min(size.Width, workArea.Width);
        var height = Math.Min(size.Height, workArea.Height);
        return new Rect(workArea.X + (workArea.Width - width) / 2, workArea.Y + (workArea.Height - height) / 2, width, height);
    }

    /// <summary>
    /// Asks the panel for any unsent state and waits for its writes checkpoint
    /// so nothing typed moments before a reload is lost.
    /// </summary>
    public async Task<(WidgetPanelStateChange? Change, bool Prepared)> TakePendingStateAsync()
    {
        if (!_webReady) return (null, true);
        _writesCheckpoint = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var scriptTask = DashboardWebView.EvaluateAsync(WebView, "window.classroomWidgetPanel?.takePendingState?.() ?? null");
        var completed = await Task.WhenAny(Task.WhenAll(scriptTask, _writesCheckpoint.Task), Task.Delay(900));
        var checkpoint = _writesCheckpoint;
        _writesCheckpoint = null;
        if (!scriptTask.IsCompletedSuccessfully || !checkpoint.Task.IsCompleted || completed is null) return (null, false);

        var result = scriptTask.Result;
        if (result is null) return (null, false);
        if (result.Value.ValueKind == JsonValueKind.Null) return (null, true);
        var payload = result.Value;
        if (payload.ValueKind != JsonValueKind.Object
            || !payload.TryGetProperty("schemaVersion", out var schema) || !schema.TryGetInt32(out var schemaVersion) || schemaVersion != 1
            || !payload.TryGetProperty("widgetId", out var widgetId) || widgetId.GetString() != WidgetId
            || !payload.TryGetProperty("baseRevision", out var baseRevision) || baseRevision.ValueKind != JsonValueKind.Number
            || !payload.TryGetProperty("state", out _))
        {
            return (null, false);
        }

        using var flushed = JsonDocument.Parse(payload.GetRawText());
        var withFlush = new Dictionary<string, JsonElement>();
        foreach (var property in flushed.RootElement.EnumerateObject()) withFlush[property.Name] = property.Value.Clone();
        withFlush["flush"] = JsonSerializer.SerializeToElement(true);
        return (new WidgetPanelStateChange(WidgetId, JsonSerializer.SerializeToElement(withFlush)), true);
    }

    protected override void OnClosing(CancelEventArgs args)
    {
        if (_closingPermanently)
        {
            base.OnClosing(args);
            return;
        }
        args.Cancel = true;
        HidePanel();
        RemovalRequested?.Invoke(WidgetId);
    }

    protected override void OnClosed(EventArgs args)
    {
        _hoverTimer.Stop();
        _frameTimer.Stop();
        WebView.Dispose();
        base.OnClosed(args);
    }

    private async Task InitializeWebViewAsync()
    {
        if (_webReady || _closingPermanently) return;
        try
        {
            await DashboardWebView.InitializeAsync(WebView, "window.__CLASSROOM_WIDGET_PANEL__ = true;");
        }
        catch (Exception error) when (error is WebView2RuntimeNotFoundException or COMException)
        {
            DashboardLog.Error($"Unable to start widget panel: {error.Message}");
            return;
        }
        if (_closingPermanently) return;
        _webReady = true;
        WebView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
        WebView.CoreWebView2.NavigationCompleted += (_, _) => ApplyWebPresentation();
        WebView.CoreWebView2.ProcessFailed += (_, args) =>
        {
            if (args.ProcessFailedKind is CoreWebView2ProcessFailedKind.RenderProcessExited or CoreWebView2ProcessFailedKind.RenderProcessUnresponsive)
            {
                DashboardLog.Error($"Widget panel {WidgetId} render process failed; reloading");
                LoadWidget();
            }
        };
        LoadWidget();
    }

    private void LoadWidget()
    {
        _panelReady = false;
        _lastPushedRevision = null;
        _lastPushedStateRevision = null;
        WebView.CoreWebView2.Navigate(DashboardWebView.BuildUrl(new Dictionary<string, string>
        {
            ["surface"] = "widget-panel",
            ["widgetId"] = WidgetId,
            ["backgroundOpacity"] = "1"
        }));
    }

    private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs args)
    {
        if (!DashboardWebView.IsAllowed(args.Source)) return;
        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(args.WebMessageAsJson);
        }
        catch (JsonException)
        {
            return;
        }

        using (document)
        {
            var body = document.RootElement;
            if (body.ValueKind != JsonValueKind.Object) return;
            if (!body.TryGetProperty("handler", out var handler) || handler.GetString() != "classroomWidgetPanel") return;
            if (!body.TryGetProperty("type", out var typeValue) || typeValue.ValueKind != JsonValueKind.String) return;
            if (body.TryGetProperty("widgetId", out var requested) && requested.ValueKind == JsonValueKind.String && requested.GetString() != WidgetId) return;

            switch (typeValue.GetString())
            {
                case "panel-ready":
                    _panelReady = true;
                    PushSnapshot(force: true);
                    break;
                case "panel-state-change":
                    if (!body.TryGetProperty("baseRevision", out var revision) || revision.ValueKind != JsonValueKind.Number) return;
                    if (!body.TryGetProperty("state", out _)) return;
                    PanelStateChanged?.Invoke(new WidgetPanelStateChange(WidgetId, StripFlush(body)));
                    break;
                case "randomiser-list-save":
                    if (!body.TryGetProperty("name", out var name) || string.IsNullOrWhiteSpace(name.GetString())) return;
                    if (!body.TryGetProperty("choices", out var choices) || choices.ValueKind != JsonValueKind.Array || choices.GetArrayLength() > 10_000) return;
                    RandomiserListChanged?.Invoke(body.Clone());
                    break;
                case "randomiser-list-delete":
                    if (!body.TryGetProperty("id", out var id) || string.IsNullOrEmpty(id.GetString())) return;
                    RandomiserListChanged?.Invoke(body.Clone());
                    break;
                case "panel-writes-checkpoint":
                    _writesCheckpoint?.TrySetResult();
                    break;
            }
        }
    }

    private static JsonElement StripFlush(JsonElement body)
    {
        var payload = new Dictionary<string, JsonElement>();
        foreach (var property in body.EnumerateObject())
        {
            if (property.Name is "flush" or "handler") continue;
            payload[property.Name] = property.Value.Clone();
        }
        return JsonSerializer.SerializeToElement(payload);
    }

    private void PushSnapshot(bool force = false)
    {
        if (!_webReady || !_panelReady) return;
        if (!force && _descriptor.Revision == _lastPushedRevision && _descriptor.StateRevision == _lastPushedStateRevision) return;
        _lastPushedRevision = _descriptor.Revision;
        _lastPushedStateRevision = _descriptor.StateRevision;
        var snapshot = _descriptor.SnapshotPayload.GetRawText();
        _ = DashboardWebView.EvaluateBoolAsync(WebView,
            $"(() => {{ const panel = window.classroomWidgetPanel; if (!panel?.receiveSnapshot) return false; panel.receiveSnapshot({snapshot}); return true; }})()");
    }

    private void ApplyDescriptorPresentation()
    {
        Title = _descriptor.Title;
        TitleText.Text = _descriptor.Title;

        var minimum = _descriptor.MinimumContentSize.Clamped();
        MinWidth = minimum.Width;
        MinHeight = minimum.Height + ChromeHeight;
        if (_descriptor.MaximumContentSize is { } maximum)
        {
            MaxWidth = Math.Max(maximum.Width, MinWidth);
            MaxHeight = Math.Max(maximum.Height + ChromeHeight, MinHeight);
        }
        else
        {
            MaxWidth = double.PositiveInfinity;
            MaxHeight = double.PositiveInfinity;
        }
        ResizeMode = _descriptor.IsResizable ? ResizeMode.CanResize : ResizeMode.NoResize;

        var isDark = _descriptor.SnapshotPayload.TryGetProperty("theme", out var theme) && theme.GetString() == "dark";
        Resources["PanelBackground"] = new SolidColorBrush(isDark ? DarkBackground : LightBackground);
        Resources["ChromeForeground"] = new SolidColorBrush(isDark ? DarkForeground : LightForeground);
        Resources["ChromeHover"] = new SolidColorBrush(isDark ? Color.FromArgb(0x33, 0xFF, 0xFF, 0xFF) : Color.FromArgb(0x22, 0x00, 0x00, 0x00));
    }

    private void ApplyWebPresentation()
    {
        if (!_webReady) return;
        _ = WebView.CoreWebView2.ExecuteScriptAsync(
            $"document.documentElement.dataset.widgetChromeVisible = '{(_chromeVisible ? "true" : "false")}';");
    }

    private void NoteFrameChange()
    {
        if (_programmaticFrameChange || _closingPermanently || !IsLoaded) return;
        _frameTimer.Stop();
        _frameTimer.Start();
    }

    private void UpdateChromeForPointer()
    {
        if (!IsVisible) return;
        var inside = false;
        if (NativeMethods.GetCursorPos(out var point))
        {
            var source = PresentationSource.FromVisual(this);
            if (source?.CompositionTarget is { } target)
            {
                var dip = target.TransformFromDevice.Transform(new Point(point.X, point.Y));
                inside = CurrentFrame.Contains(dip);
            }
        }
        if (inside || AddMenu.IsOpen || ArrangeMenu.IsOpen)
        {
            _pointerLeftAt = DateTime.MinValue;
            SetChromeVisible(true);
            return;
        }
        if (_pointerLeftAt == DateTime.MinValue) _pointerLeftAt = DateTime.UtcNow;
        if (_chromeVisible && DateTime.UtcNow - _pointerLeftAt > TimeSpan.FromMilliseconds(1200)) SetChromeVisible(false);
    }

    private void SetChromeVisible(bool visible)
    {
        if (_chromeVisible == visible) return;
        _chromeVisible = visible;
        ChromeContent.Opacity = visible ? 1 : 0;
        ApplyWebPresentation();
    }

    private void ApplyWindowAlpha()
    {
        var handle = new WindowInteropHelper(this).Handle;
        if (handle == IntPtr.Zero) return;
        var style = NativeMethods.GetWindowLong(handle, NativeMethods.GWL_EXSTYLE);
        var alpha = (byte)Math.Round(Math.Max(_backgroundOpacity, 0.2) * 255);
        if (alpha >= 255)
        {
            NativeMethods.SetWindowLong(handle, NativeMethods.GWL_EXSTYLE, style & ~NativeMethods.WS_EX_LAYERED);
            return;
        }
        NativeMethods.SetWindowLong(handle, NativeMethods.GWL_EXSTYLE, style | NativeMethods.WS_EX_LAYERED);
        NativeMethods.SetLayeredWindowAttributes(handle, 0, alpha, NativeMethods.LWA_ALPHA);
    }

    /// <summary>
    /// Keeps interactive resizes on the descriptor's content aspect ratio
    /// (chrome height excluded), matching the NSWindow contentAspectRatio
    /// behaviour of the macOS shell.
    /// </summary>
    private IntPtr WindowProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (msg != NativeMethods.WM_SIZING || _descriptor.AspectRatio is not { } ratio || ratio <= 0) return IntPtr.Zero;
        if (PresentationSource.FromVisual(this)?.CompositionTarget is not { } target) return IntPtr.Zero;

        var scale = target.TransformToDevice.M22;
        var chrome = ChromeHeight * scale;
        var rect = Marshal.PtrToStructure<NativeMethods.RECT>(lParam);
        var width = (double)(rect.Right - rect.Left);
        var height = rect.Bottom - rect.Top - chrome;
        var edge = wParam.ToInt32();

        var drivesWidth = edge is NativeMethods.WMSZ_LEFT or NativeMethods.WMSZ_RIGHT;
        var drivesHeight = edge is NativeMethods.WMSZ_TOP or NativeMethods.WMSZ_BOTTOM;
        if (drivesWidth || (!drivesHeight && width / Math.Max(height, 1) > ratio))
        {
            height = width / ratio;
        }
        else
        {
            width = height * ratio;
        }

        var totalHeight = (int)Math.Round(height + chrome);
        var totalWidth = (int)Math.Round(width);
        if (edge is NativeMethods.WMSZ_LEFT or NativeMethods.WMSZ_TOPLEFT or NativeMethods.WMSZ_BOTTOMLEFT) rect.Left = rect.Right - totalWidth;
        else rect.Right = rect.Left + totalWidth;
        if (edge is NativeMethods.WMSZ_TOP or NativeMethods.WMSZ_TOPLEFT or NativeMethods.WMSZ_TOPRIGHT) rect.Top = rect.Bottom - totalHeight;
        else rect.Bottom = rect.Top + totalHeight;

        Marshal.StructureToPtr(rect, lParam, false);
        handled = true;
        return (IntPtr)1;
    }

    private void ChromeBar_MouseLeftButtonDown(object sender, MouseButtonEventArgs args)
    {
        if (args.ButtonState != MouseButtonState.Pressed) return;
        Activate();
        DragMove();
    }

    private void CloseButton_Click(object sender, RoutedEventArgs args)
    {
        HidePanel();
        RemovalRequested?.Invoke(WidgetId);
    }

    private void AddButton_Click(object sender, RoutedEventArgs args) => OpenMenu(AddButton, AddMenu);

    private void ArrangeButton_Click(object sender, RoutedEventArgs args) => OpenMenu(ArrangeButton, ArrangeMenu);

    private void ArrangeMenuItem_Click(object sender, RoutedEventArgs args)
    {
        if (sender is MenuItem { Tag: string tag } && Enum.TryParse<WidgetPanelLayout>(tag, out var layout))
        {
            LayoutRequested?.Invoke(layout);
        }
    }

    private static void OpenMenu(Button anchor, ContextMenu menu)
    {
        menu.PlacementTarget = anchor;
        menu.Placement = PlacementMode.Bottom;
        menu.IsOpen = true;
    }

    private static class NativeMethods
    {
        public const int GWL_EXSTYLE = -20;
        public const int WS_EX_LAYERED = 0x80000;
        public const uint LWA_ALPHA = 0x2;
        public const int WM_SIZING = 0x0214;
        public const int WMSZ_LEFT = 1;
        public const int WMSZ_RIGHT = 2;
        public const int WMSZ_TOP = 3;
        public const int WMSZ_TOPLEFT = 4;
        public const int WMSZ_TOPRIGHT = 5;
        public const int WMSZ_BOTTOM = 6;
        public const int WMSZ_BOTTOMLEFT = 7;
        public const int WMSZ_BOTTOMRIGHT = 8;

        [StructLayout(LayoutKind.Sequential)]
        public struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct POINT
        {
            public int X;
            public int Y;
        }

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool GetCursorPos(out POINT point);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern int GetWindowLong(IntPtr hWnd, int index);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern int SetWindowLong(IntPtr hWnd, int index, int value);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool SetLayeredWindowAttributes(IntPtr hWnd, uint colorKey, byte alpha, uint flags);
    }
}
