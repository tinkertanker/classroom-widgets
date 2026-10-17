using System.ComponentModel;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Threading;

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
    private readonly DashboardSettings _settings;
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
        _settings = settings;
        InitializeComponent();
        Topmost = alwaysOnTop;
        ApplyDescriptorPresentation();
        UpdateVolumeButton();

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
        if (PerfLog.Enabled) ContentRendered += (_, _) => PerfMark("panel.rendered");
    }

    private void PerfMark(string name) => PerfLog.Mark(name, WidgetId, _descriptor.PerfWidgetType);

    public void ShowPanel()
    {
        if (_closingPermanently || _descriptor.Hidden) return;
        if (!IsVisible)
        {
            PerfMark("panel.show");
            Show();
        }
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
        ApplyAudioSettings();
        UpdateVolumeButton();
        if (!opacityChanged) return;
        ApplyPanelBackground();
        ApplyWebPresentation();
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
            var item = new MenuItem { Header = CompactWidgetMenu.Label(option) };
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

    private void NoteFrameChange()
    {
        if (_programmaticFrameChange || _closingPermanently || !IsLoaded) return;
        _frameTimer.Stop();
        _frameTimer.Start();
    }
}
