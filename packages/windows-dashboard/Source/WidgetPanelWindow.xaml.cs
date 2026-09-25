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
using System.Windows.Media.Animation;
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
    private readonly DashboardSettings _shortenerSettings;
    private bool _isDark;
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
    public event Action? DisplayPreviewRequested;
    public event Action<WidgetPanelLayout>? LayoutRequested;
    public event Action<string, Rect>? FrameChanged;
    public event Action? OpenSettingsRequested;

    public string WidgetId => _descriptor.Id;
    public bool IsResizable => _descriptor.IsResizable;
    public bool IsHidden => _descriptor.Hidden;
    public Rect CurrentFrame => new(Left, Top, ActualWidth > 0 ? ActualWidth : Width, ActualHeight > 0 ? ActualHeight : Height);
    public Size PreferredFrameSize
    {
        get
        {
            var content = _descriptor.PreferredContentSize.Clamped();
            return new Size(content.Width, content.Height + ChromeHeight);
        }
    }

    public WidgetPanelWindow(WidgetPanelDescriptor descriptor, double backgroundOpacity, bool alwaysOnTop, DashboardSettings settings)
    {
        _descriptor = descriptor;
        _backgroundOpacity = Math.Clamp(backgroundOpacity, 0, 1);
        _shortenerSettings = settings;
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
            var handle = new WindowInteropHelper(this).Handle;
            var source = HwndSource.FromHwnd(handle);
            source?.AddHook(WindowProc);
            if (source?.CompositionTarget is { } target) target.BackgroundColor = Colors.Transparent;
            EnableCompositedTransparency(handle);
        };
        Loaded += async (_, _) => await InitializeWebViewAsync();
    }

    public void ShowPanel()
    {
        if (_closingPermanently || _descriptor.Hidden) return;
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
        var next = Math.Clamp(backgroundOpacity, 0, 1);
        var opacityChanged = _backgroundOpacity != next;
        _backgroundOpacity = next;
        Topmost = alwaysOnTop;
        // Native shortener preferences outrank anything a panel cached, so
        // republish them on every settings change, like macOS does.
        ApplyShortenerSettings();
        if (!opacityChanged) return;
        ApplyPanelBackground();
        ApplyWebPresentation();
    }

    /// <summary>
    /// Publishes the native link-shortener settings into this panel's web
    /// view. Values are JSON-serialized by <see cref="DashboardShortenerSettings"/>
    /// so credentials can never break out of the assignment.
    /// </summary>
    private void ApplyShortenerSettings()
    {
        if (!_webReady) return;
        _ = WebView.CoreWebView2.ExecuteScriptAsync(DashboardShortenerSettings.Script(_shortenerSettings));
    }

    public void SetWidgetCreationOptions(IReadOnlyList<CompactWidgetOption> options)
    {
        _options = options;
        AddMenu.Items.Clear();
        var display = new MenuItem { Header = CompactWidgetMenu.DisplayLabel };
        display.Click += (_, _) => DisplayPreviewRequested?.Invoke();
        AddMenu.Items.Add(display);
        foreach (var (option, separatorBefore) in CompactWidgetMenu.Entries(options))
        {
            if (separatorBefore) AddMenu.Items.Add(new Separator());
            var item = new MenuItem { Header = CompactWidgetMenu.Label(option), Tag = option.WidgetType };
            item.Click += (_, _) => WidgetCreationRequested?.Invoke(option.WidgetType);
            AddMenu.Items.Add(item);
        }
        AddButton.IsEnabled = true;
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
        WebView.CoreWebView2.NavigationCompleted += (_, args) =>
        {
            // Mirror the macOS didFinish navigation behaviour: republish the
            // native shortener settings before the reloaded panel state.
            if (args.IsSuccess) ApplyShortenerSettings();
            ApplyWebPresentation();
        };
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
            ["backgroundOpacity"] = OpacityText
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
                case "open-settings":
                    OpenSettingsRequested?.Invoke();
                    break;
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
        // Publish the native shortener settings ahead of the snapshot in the
        // same script so widgets read current preferences on their first
        // render, the way the macOS panel does.
        _ = DashboardWebView.EvaluateBoolAsync(WebView,
            DashboardShortenerSettings.Script(_shortenerSettings)
            + $"(() => {{ const panel = window.classroomWidgetPanel; if (!panel?.receiveSnapshot) return false; panel.receiveSnapshot({snapshot}); return true; }})()");
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
        _isDark = isDark;
        ApplyPanelBackground();
        Resources["ChromeForeground"] = new SolidColorBrush(isDark ? DarkForeground : LightForeground);
        Resources["ChromeHover"] = new SolidColorBrush(isDark ? Color.FromArgb(0x33, 0xFF, 0xFF, 0xFF) : Color.FromArgb(0x22, 0x00, 0x00, 0x00));
    }

    private void ApplyPanelBackground()
        => Resources["PanelBackground"] = new SolidColorBrush(_isDark ? DarkBackground : LightBackground) { Opacity = _backgroundOpacity };

    private void ApplyWebPresentation()
    {
        if (!_webReady) return;
        _ = WebView.CoreWebView2.ExecuteScriptAsync(
            $"document.documentElement.dataset.widgetChromeVisible = '{(_chromeVisible ? "true" : "false")}';"
            + $"document.documentElement.style.setProperty('--compact-widget-background-opacity', '{OpacityText}');");
    }

    private string OpacityText => _backgroundOpacity.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture);

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
        ChromeBar.BeginAnimation(OpacityProperty, new DoubleAnimation(visible ? 1 : 0, TimeSpan.FromMilliseconds(160)));
        ApplyWebPresentation();
    }

    /// <summary>
    /// WPF's AllowsTransparency breaks WebView2, so unpainted pixels are made
    /// see-through by DWM instead via a fully transparent accent policy.
    /// </summary>
    private static void EnableCompositedTransparency(IntPtr handle)
    {
        if (handle == IntPtr.Zero) return;
        var policy = new NativeMethods.ACCENT_POLICY
        {
            AccentState = NativeMethods.ACCENT_ENABLE_TRANSPARENTGRADIENT,
            AccentFlags = NativeMethods.ACCENT_FLAG_USE_GRADIENT_COLOR,
            GradientColor = 0
        };
        var size = Marshal.SizeOf<NativeMethods.ACCENT_POLICY>();
        var buffer = Marshal.AllocHGlobal(size);
        try
        {
            Marshal.StructureToPtr(policy, buffer, false);
            var data = new NativeMethods.WINDOWCOMPOSITIONATTRIBDATA
            {
                Attribute = NativeMethods.WCA_ACCENT_POLICY,
                Data = buffer,
                SizeOfData = size
            };
            NativeMethods.SetWindowCompositionAttribute(handle, ref data);
        }
        finally
        {
            Marshal.FreeHGlobal(buffer);
        }
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
        public const int WM_SIZING = 0x0214;
        public const int WCA_ACCENT_POLICY = 19;
        public const int ACCENT_ENABLE_TRANSPARENTGRADIENT = 2;
        public const int ACCENT_FLAG_USE_GRADIENT_COLOR = 2;

        [StructLayout(LayoutKind.Sequential)]
        public struct ACCENT_POLICY
        {
            public int AccentState;
            public int AccentFlags;
            public uint GradientColor;
            public int AnimationId;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct WINDOWCOMPOSITIONATTRIBDATA
        {
            public int Attribute;
            public IntPtr Data;
            public int SizeOfData;
        }

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool SetWindowCompositionAttribute(IntPtr hWnd, ref WINDOWCOMPOSITIONATTRIBDATA data);
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

    }
}
