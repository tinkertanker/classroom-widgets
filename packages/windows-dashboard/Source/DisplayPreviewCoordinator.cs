using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Threading;
using Forms = System.Windows.Forms;
using Microsoft.Win32;

namespace ClassroomWidgets;

public sealed class DisplayPreviewCoordinator : IDisposable
{
    private const string NoDisplays = "Connect another display or use an extended desktop.";
    private const string ChooseSource = "Choose a source display, then turn the preview on.";
    private const string Ready = "Click to see display";
    private const string Paused = "Paused.";
    private const string Overlap = "Preview suspended while it overlaps the source display. Move it fully clear to resume.";
    private const string SourceLost = "The selected display is no longer available.";

    private readonly DashboardSettings _settings;
    private readonly DisplayCatalog _catalog;
    private readonly DispatcherTimer _frameTimer;
    private DisplayPreviewWindow? _window;
    private DisplayCaptureSession? _capture;
    private IReadOnlyList<DisplayDescriptor> _candidates = Array.Empty<DisplayDescriptor>();
    private DisplayDescriptor? _selected;
    private bool _wantsCapture;
    private bool _suspendedForOverlap;
    private bool _closing;
    private bool _systemEventsSubscribed;

    public bool IsOpen => _window is { IsVisible: true };

    public DisplayPreviewCoordinator(DashboardSettings settings, DisplayCatalog catalog)
    {
        _settings = settings;
        _catalog = catalog;
        _frameTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(150) };
        _frameTimer.Tick += (_, _) =>
        {
            _frameTimer.Stop();
            NoteFrameChange();
        };
    }

    public void Open()
    {
        if (_window is not null)
        {
            _window.Show();
            _window.Activate();
            return;
        }

        var remembered = _settings.DisplayPreviewFrame;
        var initial = remembered is { Width: >= 320, Height: >= 240 }
            ? new Rect(remembered.Left, remembered.Top, remembered.Width, remembered.Height)
            : new Rect(0, 0, 480, 402);
        _window = new DisplayPreviewWindow(initial);
        _window.PowerToggleRequested += TogglePower;
        _window.MenuRequested += OpenMenu;
        _window.PreviewClicked += PreviewClicked;
        _window.FrameChanged += WindowFrameChanged;
        _window.Closed += WindowClosed;
        if (!_systemEventsSubscribed)
        {
            SystemEvents.DisplaySettingsChanged += DisplaySettingsChanged;
            _systemEventsSubscribed = true;
        }
        _window.Show();
        if (remembered is not { Width: >= 320, Height: >= 240 } || !OverlapsAnyDisplay())
        {
            SetDefaultFrame();
        }
        else
        {
            ClampToHostWorkArea();
        }
        RefreshSources();
        _window.Activate();
    }

    public void Close()
    {
        if (_window is null) return;
        _window.Close();
    }

    public void Stop()
    {
        _wantsCapture = false;
        _suspendedForOverlap = false;
        StopCapture();
        Publish(Paused);
    }

    public void Shutdown()
    {
        _closing = true;
        _frameTimer.Stop();
        StopCapture();
        if (_window is not null) _window.Close();
        UnsubscribeDisplayEvents();
    }

    public void Dispose() => Shutdown();

    private void TogglePower()
    {
        if (_wantsCapture) Stop();
        else _ = StartAsync();
    }

    private async Task StartAsync()
    {
        if (_window is null || _selected is null) return;
        if (DisplayGeometry.Intersects(_window.GetPhysicalBounds(), _selected.Bounds))
        {
            _wantsCapture = true;
            _suspendedForOverlap = true;
            Publish(Overlap);
            return;
        }

        _wantsCapture = true;
        _suspendedForOverlap = false;
        StopCapture();
        var capture = new DisplayCaptureSession(_selected.Bounds,
            () => _window is { IsVisible: true, WindowState: not WindowState.Minimized });
        _capture = capture;
        capture.FrameReady += CaptureFrameReady;
        capture.Failed += CaptureFailed;
        Publish($"Live: {_selected.Name}");
        capture.Start();
        await Task.CompletedTask;
    }

    private void StopCapture()
    {
        if (_capture is null) return;
        _capture.FrameReady -= CaptureFrameReady;
        _capture.Failed -= CaptureFailed;
        _capture.Dispose();
        _capture = null;
        _window?.SetImage(null);
    }

    private void CaptureFrameReady()
    {
        if (_capture?.Image is { } image) _window?.SetImage(image);
    }

    private void CaptureFailed(Exception error)
    {
        if (_selected is null) return;
        _wantsCapture = false;
        _suspendedForOverlap = false;
        StopCapture();
        Publish($"Could not capture {_selected.Name}: {error.Message}");
    }

    private void RefreshSources()
    {
        if (_window is null) return;
        var host = HostDisplay();
        _candidates = _catalog.EligibleSources(host?.Id);
        var previous = _selected;
        var current = _selected is null ? null : _catalog.CurrentMatching(_selected);
        _selected = current ?? _catalog.ResolveSource(_settings.DisplayPreviewSourceId, _candidates);
        if (_selected is null && _wantsCapture)
        {
            _wantsCapture = false;
            _suspendedForOverlap = false;
            StopCapture();
            Publish(_candidates.Count == 0 ? NoDisplays : SourceLost);
            return;
        }
        if (_selected is null)
        {
            Publish(_candidates.Count == 0 ? NoDisplays : ChooseSource);
            return;
        }

        var boundsChanged = previous is not null && current is not null
            && (previous.Bounds != current.Bounds || previous.WorkingArea != current.WorkingArea);
        if (boundsChanged && _capture is not null)
        {
            _ = StartAsync();
            return;
        }
        if (_wantsCapture && !_suspendedForOverlap
            && DisplayGeometry.Intersects(_window.GetPhysicalBounds(), _selected.Bounds))
        {
            StopForOverlap();
        }
        else if (_wantsCapture && _suspendedForOverlap)
        {
            _suspendedForOverlap = false;
            _ = StartAsync();
        }
        else if (!_wantsCapture)
        {
            Publish(Ready);
        }
    }

    private void StopForOverlap()
    {
        _suspendedForOverlap = true;
        StopCapture();
        Publish(Overlap);
    }

    private void OpenMenu()
    {
        if (_window is null) return;
        var menu = new ContextMenu();
        menu.Items.Add(new MenuItem { Header = CurrentStatus(), IsEnabled = false });
        menu.Items.Add(new Separator());
        foreach (var candidate in _candidates)
        {
            var item = new MenuItem
            {
                Header = _catalog.SourceLabel(candidate),
                IsCheckable = true,
                IsChecked = candidate.Id == _selected?.Id
            };
            item.Click += (_, _) => SelectSource(candidate);
            menu.Items.Add(item);
        }
        menu.Items.Add(new Separator());
        var match = new MenuItem { Header = "Match Display Aspect Ratio", IsEnabled = _selected is not null };
        match.Click += (_, _) => MatchAspectRatio();
        menu.Items.Add(match);
        var center = new MenuItem { Header = "Move Pointer to Source Center", IsEnabled = _selected is not null };
        center.Click += (_, _) => MovePointerToCenter();
        menu.Items.Add(center);
        menu.Items.Add(new Separator());
        menu.Items.Add(new MenuItem { Header = "Click the preview to move the pointer there.", IsEnabled = false });
        _window.ShowMenu(menu);
    }

    private string CurrentStatus()
        => _window is null || _selected is null ? (_candidates.Count == 0 ? NoDisplays : ChooseSource)
            : _wantsCapture ? (_suspendedForOverlap ? Overlap : $"Live: {_selected.Name}") : Ready;

    private void SelectSource(DisplayDescriptor source)
    {
        _selected = source;
        _settings.DisplayPreviewSourceId = source.Id;
        _settings.Save();
        if (_wantsCapture) _ = StartAsync();
        else Publish(Ready);
    }

    private void MatchAspectRatio()
    {
        if (_window is null || _selected is null) return;
        var host = HostDisplay();
        if (host is null) return;
        var content = new Size(_window.ActualWidth, Math.Max(1, _window.ActualHeight - _window.ChromeHeightDip));
        var maximum = ToDip(host.WorkingArea, _window);
        var size = DisplayGeometry.AspectNormalizedWindowSize(
            _selected.Bounds.Width / _selected.Bounds.Height,
            content,
            _window.ChromeHeightDip,
            new Size(320, 180),
            maximum.Size);
        _window.SetClientSize(size);
    }

    private void PreviewClicked(Point point, Rect imageRect)
    {
        if (_selected is null) return;
        if (!_wantsCapture)
        {
            _ = StartAsync();
            return;
        }
        if (imageRect.IsEmpty) return;
        var target = DisplayGeometry.MapPreviewPointToSource(point, imageRect, _selected.Bounds);
        if (target is null || !NativeMethods.SetCursorPos((int)target.Value.X, (int)target.Value.Y))
        {
            Publish("Could not move the pointer. Preview remains live.");
        }
    }

    private void MovePointerToCenter()
    {
        if (_selected is null) return;
        var target = new Point(_selected.Bounds.X + _selected.Bounds.Width / 2, _selected.Bounds.Y + _selected.Bounds.Height / 2);
        if (!NativeMethods.SetCursorPos((int)target.X, (int)target.Y)) Publish("Could not move the pointer. Preview remains live.");
    }

    private void WindowFrameChanged()
    {
        if (_closing || _window is null) return;
        _frameTimer.Stop();
        _frameTimer.Start();
        RefreshSources();
    }

    private void NoteFrameChange()
    {
        if (_window is null) return;
        _settings.DisplayPreviewFrame = new PanelFrame
        {
            Left = _window.Left,
            Top = _window.Top,
            Width = _window.ActualWidth > 0 ? _window.ActualWidth : _window.Width,
            Height = _window.ActualHeight > 0 ? _window.ActualHeight : _window.Height
        };
        _settings.Save();
    }

    private void WindowClosed(object? sender, EventArgs args)
    {
        _frameTimer.Stop();
        NoteFrameChange();
        StopCapture();
        _window = null;
        _wantsCapture = false;
        _suspendedForOverlap = false;
        UnsubscribeDisplayEvents();
    }

    private DisplayDescriptor? HostDisplay()
    {
        if (_window is null) return null;
        var handle = new WindowInteropHelper(_window).Handle;
        if (handle == IntPtr.Zero) return _catalog.Displays().FirstOrDefault(display => display.IsPrimary);
        var screen = Forms.Screen.FromHandle(handle);
        return _catalog.Displays().FirstOrDefault(display => string.Equals(display.Id, screen.DeviceName, StringComparison.OrdinalIgnoreCase));
    }

    private bool OverlapsAnyDisplay()
        => _window is not null && _catalog.Displays().Any(display => DisplayGeometry.Intersects(_window.GetPhysicalBounds(), display.Bounds));

    private void SetDefaultFrame()
    {
        if (_window is null) return;
        var host = HostDisplay() ?? _catalog.Displays().FirstOrDefault();
        if (host is null) return;
        var working = ToDip(host.WorkingArea, _window);
        var width = 480d;
        var height = 402d;
        _window.Left = working.Left + Math.Max(0, (working.Width - width) / 2);
        _window.Top = working.Top + Math.Max(0, (working.Height - height) / 2);
        _window.Width = width;
        _window.Height = height;
    }

    private void ClampToHostWorkArea()
    {
        if (_window is null) return;
        var host = HostDisplay();
        if (host is null) return;
        var workArea = ToDip(host.WorkingArea, _window);
        var frame = DisplayGeometry.Clamp(
            new Rect(_window.Left, _window.Top, _window.Width, _window.Height),
            workArea);
        _window.Left = frame.Left;
        _window.Top = frame.Top;
        _window.Width = frame.Width;
        _window.Height = frame.Height;
    }

    private static Rect ToDip(Rect physical, Visual visual)
    {
        var source = PresentationSource.FromVisual(visual);
        return source?.CompositionTarget is { } target
            ? Rect.Transform(physical, target.TransformFromDevice)
            : physical;
    }

    private void DisplaySettingsChanged(object? sender, EventArgs args)
        => _window?.Dispatcher.BeginInvoke(new Action(RefreshSources));

    private void UnsubscribeDisplayEvents()
    {
        if (!_systemEventsSubscribed) return;
        SystemEvents.DisplaySettingsChanged -= DisplaySettingsChanged;
        _systemEventsSubscribed = false;
    }

    private void Publish(string status)
    {
        if (_window is null) return;
        _window.SetState(status, _wantsCapture, _selected is not null);
    }

    private static class NativeMethods
    {
        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool SetCursorPos(int x, int y);
    }
}
