using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using ClassroomWidgets;
using Xunit;
using Forms = System.Windows.Forms;

namespace ClassroomWidgetsTests;

/// <summary>
/// Drives the real coordinator, preview window and GDI capture on the interactive desktop.
/// The "source display" is a fake descriptor whose bounds are a region of the primary display
/// covered by <see cref="SyntheticSourceWindow"/>, so a live bounds change can be simulated by
/// swapping the descriptor the catalog returns and nudging the preview window (which schedules
/// RefreshSources exactly as a real move does).
/// </summary>
public sealed class DisplayPreviewCoordinatorTests
{
    private const string SourceId = @"\\.\CLASSROOM_WIDGETS_TEST";
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan Settle = TimeSpan.FromMilliseconds(600);
    private static readonly Rect ClearSourceBounds = new(0, 0, 400, 300);
    private static readonly PanelFrame PreviewFrame = new() { Left = 700, Top = 340, Width = 480, Height = 330 };

    // Menus must follow their own buttons, not Power or coordinates cached before a resize.
    [Fact]
    public void MenusFollowTheirButtonsWhenWindowMovesAndResizes()
    {
        var realDataDirectory = DashboardSettings.DataDirectory;
        var testDataDirectory = Path.Combine(Path.GetTempPath(), "ClassroomWidgetsTests", Guid.NewGuid().ToString("N"));
        DashboardSettings.UseDataDirectory(testDataDirectory);
        try
        {
            WpfTestHost.Run(() =>
            {
                using var coordinator = new DisplayPreviewCoordinator(new DashboardSettings(), new DisplayCatalog());
                coordinator.Open();
                var window = coordinator.Window!;
                WpfTestHost.PumpUntil(() => window.IsLoaded, Timeout, "Display to open");
                var sourceButton = Descendants<Button>(window).Single(button => Equals(button.Content, "⋯"));
                var work = HostDescriptor().WorkingArea;
                var scale = window.DeviceScale;
                var width = Math.Min(900 * scale, work.Width - 100 * scale);
                var height = Math.Min(600 * scale, work.Height - 100 * scale);
                var evidence = new List<string>();
                foreach (var frame in new[]
                {
                    new Rect(work.Left + 50 * scale, work.Top + 50 * scale, width, height),
                    new Rect(work.Left + 50 * scale, work.Top + 50 * scale, width * 0.7, height),
                    new Rect(work.Right - width - 8 * scale, work.Top + 50 * scale, width, height)
                })
                {
                    Assert.True(window.SetPhysicalBounds(frame));
                    WpfTestHost.PumpFor(Settle);
                    foreach (var button in new[] { sourceButton, window.LayoutButton })
                    {
                        ContextMenu? menu = null;
                        try
                        {
                            button.RaiseEvent(new RoutedEventArgs(ButtonBase.ClickEvent));
                            WpfTestHost.PumpUntil(() =>
                            {
                                menu = PresentationSource.CurrentSources.Cast<PresentationSource>()
                                    .Where(source => source.Dispatcher.CheckAccess() && source.RootVisual is not null)
                                    .SelectMany(source => Descendants<ContextMenu>(source.RootVisual))
                                    .FirstOrDefault(candidate => candidate.IsOpen && candidate.IsLoaded);
                                return menu is { ActualWidth: > 0 };
                            }, Timeout, "the visible menu");
                            var popup = Assert.IsType<ContextMenu>(menu);
                            var bounds = new Rect(popup.PointToScreen(new Point()),
                                popup.PointToScreen(new Point(popup.ActualWidth, popup.ActualHeight)));
                            var buttonCenter = button.PointToScreen(new Point(button.ActualWidth / 2, button.ActualHeight / 2));
                            evidence.Add($"window={window.GetPhysicalBounds()} button={buttonCenter} menu={bounds}");
                            WpfTestHost.SaveEvidenceText("display-menu-placement.txt", string.Join("\n", evidence));
                            Assert.InRange(buttonCenter.X, bounds.Left - 2 * scale, bounds.Right + 2 * scale);
                        }
                        finally
                        {
                            if (menu is not null) menu.IsOpen = false;
                            WpfTestHost.DoEvents();
                        }
                    }
                }
            });
        }
        finally
        {
            DashboardSettings.UseDataDirectory(realDataDirectory);
            if (Directory.Exists(testDataDirectory)) Directory.Delete(testDataDirectory, recursive: true);
        }
    }

    // The coordinator persists the preview frame through DashboardSettings.Save, so settings
    // are redirected to a throwaway directory for the duration of the test.
    [Fact]
    public void SourceBoundsChangeIntoOverlapStopsOldCaptureAndResumesCleanly()
    {
        var realDataDirectory = DashboardSettings.DataDirectory;
        var testDataDirectory = Path.Combine(Path.GetTempPath(), "ClassroomWidgetsTests", Guid.NewGuid().ToString("N"));
        DashboardSettings.UseDataDirectory(testDataDirectory);
        try
        {
            WpfTestHost.Run(RunScenario);
        }
        finally
        {
            DashboardSettings.UseDataDirectory(realDataDirectory);
            if (Directory.Exists(testDataDirectory)) Directory.Delete(testDataDirectory, recursive: true);
        }
    }

    private static void RunScenario()
    {
        var host = HostDescriptor();
        var overlappingSourceBounds = host.Bounds;
        var sourceBounds = ClearSourceBounds;
        var catalog = new DisplayCatalog(() => new[]
        {
            host,
            new DisplayDescriptor(SourceId, "Test display", sourceBounds, sourceBounds, false)
        });
        var settings = new DashboardSettings { DisplayPreviewSourceId = SourceId, DisplayPreviewFrame = PreviewFrame };
        var content = new SyntheticSourceWindow(ClearSourceBounds);
        content.Show();
        using var coordinator = new DisplayPreviewCoordinator(settings, catalog);
        try
        {
            coordinator.Open();
            var window = coordinator.Window!;
            WpfTestHost.PumpUntil(() => window.IsVisible && window.StatusText.Text == "Click to see display", Timeout, "the preview to open");
            Assert.False(DisplayGeometry.Intersects(window.GetPhysicalBounds(), ClearSourceBounds));

            // Starting, changing source geometry, then stopping without pumping leaves
            // capture requests in flight. Neither retired generation may publish later.
            var retiredFrames = 0;
            for (var cycle = 0; cycle < 10; cycle++)
            {
                window.PowerButton.RaiseEvent(new RoutedEventArgs(ButtonBase.ClickEvent));
                var pending = coordinator.Capture!;
                pending.FrameReady += () => retiredFrames++;
                sourceBounds = new Rect(0, 0, 320, 240);
                coordinator.DisplaysChanged();
                var replacement = coordinator.Capture!;
                Assert.NotSame(pending, replacement);
                replacement.FrameReady += () => retiredFrames++;
                coordinator.Stop();
                sourceBounds = ClearSourceBounds;
                coordinator.DisplaysChanged();
                WpfTestHost.PumpFor(TimeSpan.FromMilliseconds(150));
                Assert.Null(pending.Image);
                Assert.Null(replacement.Image);
                Assert.Null(window.PreviewImage.Source);
                Assert.Null(coordinator.Capture);
            }
            Assert.Equal(0, retiredFrames);

            ClickPower(window);
            WpfTestHost.PumpUntil(() => coordinator.Capture is not null && window.PreviewImage.Source is not null, Timeout, "the first live frame");
            var oldCapture = coordinator.Capture!;
            Assert.Equal("Live: Test display", window.StatusText.Text);
            WpfTestHost.SaveEvidence("156-1-live.png", Snapshot(window));

            // Live source-bounds change: the selected display now covers the preview window.
            sourceBounds = overlappingSourceBounds;
            Nudge(window);
            WpfTestHost.PumpUntil(() => window.StatusText.Text.StartsWith("Preview suspended", StringComparison.Ordinal), Timeout, "overlap suspension");
            var staleFrames = 0;
            oldCapture.FrameReady += () => staleFrames++;
            WpfTestHost.PumpFor(Settle);
            WpfTestHost.SaveEvidence("156-2-suspended.png", Snapshot(window));

            Assert.Null(coordinator.Capture);
            Assert.Null(oldCapture.Image);
            Assert.Equal(0, staleFrames);
            Assert.Null(window.PreviewImage.Source);

            // A click while suspended must not act on the stale mapping.
            var before = CenterPointer(window);
            ClickPreview(window);
            WpfTestHost.PumpFor(TimeSpan.FromMilliseconds(200));
            Assert.Equal(before, CursorPosition());
            Assert.Null(coordinator.Capture);

            // Moving clear again resumes exactly one capture of the still-selected source.
            sourceBounds = ClearSourceBounds;
            Nudge(window);
            WpfTestHost.PumpUntil(() => coordinator.Capture is not null && window.PreviewImage.Source is not null, Timeout, "resume after overlap");
            var resumed = coordinator.Capture!;
            Assert.NotSame(oldCapture, resumed);
            Assert.Equal("Live: Test display", window.StatusText.Text);
            WpfTestHost.PumpFor(Settle);
            Assert.Same(resumed, coordinator.Capture);
            Assert.Equal(0, staleFrames);
            WpfTestHost.SaveEvidence("156-3-resumed.png", Snapshot(window));

            // Explicit stop, then a bounds change and a move, must not resurrect capture.
            ClickPower(window);
            Assert.Null(coordinator.Capture);
            Assert.Null(window.PreviewImage.Source);
            Assert.Equal("Paused.", window.StatusText.Text);
            sourceBounds = overlappingSourceBounds;
            Nudge(window);
            WpfTestHost.PumpFor(Settle);
            sourceBounds = ClearSourceBounds;
            Nudge(window);
            WpfTestHost.PumpFor(Settle);
            Assert.Null(coordinator.Capture);
            Assert.Null(resumed.Image);
            Assert.Null(window.PreviewImage.Source);
            Assert.Equal("Click to see display", window.StatusText.Text);

            // Close while live, then further display changes must not resurrect capture either.
            ClickPower(window);
            WpfTestHost.PumpUntil(() => coordinator.Capture is not null, Timeout, "restart before close");
            var last = coordinator.Capture!;
            Nudge(window); // Leave a debounced source refresh pending when Dismiss arrives.
            coordinator.PerformShortcut(WidgetShortcutAction.Dismiss);
            WpfTestHost.PumpFor(Settle);
            Assert.Null(coordinator.Window);
            Assert.Null(coordinator.Capture);
            Assert.Null(last.Image);
            Assert.False(coordinator.IsOpen);
            Assert.Equal(SourceId, settings.DisplayPreviewSourceId);
            Assert.NotNull(settings.DisplayPreviewFrame);
            var savedFrame = settings.DisplayPreviewFrame;

            coordinator.PerformShortcut(WidgetShortcutAction.Dismiss);
            Assert.Null(coordinator.Window);
            Assert.Same(savedFrame, settings.DisplayPreviewFrame);
            coordinator.PerformShortcut(WidgetShortcutAction.Show);
            WpfTestHost.PumpFor(Settle);
            Assert.True(coordinator.IsOpen);
            Assert.Null(coordinator.Capture);
            Assert.Equal("Click to see display", coordinator.Window!.StatusText.Text);
            ClickPower(coordinator.Window);
            WpfTestHost.PumpUntil(() => coordinator.Capture is not null, Timeout, "capture before toggle-dismiss");
            var toggledCapture = coordinator.Capture!;
            coordinator.PerformShortcut(WidgetShortcutAction.Toggle);
            WpfTestHost.PumpFor(Settle);
            Assert.Null(coordinator.Window);
            Assert.Null(coordinator.Capture);
            Assert.Null(toggledCapture.Image);
        }
        finally
        {
            content.Close();
        }
    }

    // #211: the preview must ask for frames at its own pixel size. Ways this goes wrong: the
    // coordinator does not pass the preview size (full-size frames again), passes DIPs instead
    // of pixels (only visible above 100% scaling), or passes the window size instead of the
    // image area. The expected size is worked out from the window's client rectangle, not
    // from the code under test.
    [Fact]
    public void LivePreviewCapturesAtItsOwnPixelSize()
    {
        var realDataDirectory = DashboardSettings.DataDirectory;
        var testDataDirectory = Path.Combine(Path.GetTempPath(), "ClassroomWidgetsTests", Guid.NewGuid().ToString("N"));
        DashboardSettings.UseDataDirectory(testDataDirectory);
        try
        {
            WpfTestHost.Run(() =>
            {
                var scale = PrimaryScale();
                // 640x480 DIP of source, in physical pixels, so the minimum-size preview is
                // well under half of it at any scaling.
                var sourceBounds = new Rect(0, 0, Math.Round(640 * scale), Math.Round(480 * scale));
                var host = HostDescriptor();
                var catalog = new DisplayCatalog(() => new[]
                {
                    host,
                    new DisplayDescriptor(SourceId, "Test display", sourceBounds, sourceBounds, false)
                });
                // The smallest preview, clear of the source region (fits 1024x768 DIP).
                var frame = new PanelFrame { Left = 680, Top = 400, Width = 320, Height = 282 };
                var settings = new DashboardSettings { DisplayPreviewSourceId = SourceId, DisplayPreviewFrame = frame };
                var content = new SyntheticSourceWindow(sourceBounds);
                using var coordinator = new DisplayPreviewCoordinator(settings, catalog);
                try
                {
                    content.ShowAndWaitUntilOnScreen();
                    coordinator.Open();
                    var window = coordinator.Window!;
                    WpfTestHost.PumpUntil(() => window.IsVisible && window.StatusText.Text == "Click to see display", Timeout, "the preview to open");
                    Assert.False(DisplayGeometry.Intersects(window.GetPhysicalBounds(), sourceBounds));

                    // The image area is the client area less the 42 DIP control bar.
                    Assert.True(NativeMethods.GetClientRect(new System.Windows.Interop.WindowInteropHelper(window).Handle, out var client));
                    var area = new Size(client.Right - client.Left, client.Bottom - client.Top - Math.Round(42 * scale));
                    var fit = Math.Min(area.Width / sourceBounds.Width, area.Height / sourceBounds.Height);
                    var expectedWidth = sourceBounds.Width * fit;
                    var expectedHeight = sourceBounds.Height * fit;
                    Assert.True(expectedWidth <= sourceBounds.Width / 2, $"the preview ({area}) must be at most half the source ({sourceBounds.Size}) for a scaled capture");

                    ClickPower(window);
                    WpfTestHost.PumpUntil(
                        () => window.PreviewImage.Source is System.Windows.Media.Imaging.BitmapSource { PixelWidth: var w, PixelHeight: var h }
                            && FitsPreview(w, h, expectedWidth, expectedHeight, sourceBounds.Size),
                        Timeout, $"a frame of about {expectedWidth:0}x{expectedHeight:0} (preview area {area})");
                    var image = (System.Windows.Media.Imaging.BitmapSource)window.PreviewImage.Source!;
                    var (width, height) = (image.PixelWidth, image.PixelHeight);
                    var rendered = WpfTestHost.RenderOverBlack(image, width, height);
                    WpfTestHost.SaveEvidence("211-coordinator-preview.png", rendered, width, height);
                    WpfTestHost.SaveEvidence("211-coordinator-window.png", Snapshot(window));
                    AssertQuadrant(SyntheticSourceWindow.TopLeft, WpfTestHost.PixelAt(rendered, width, width / 4, height / 4));
                    AssertQuadrant(SyntheticSourceWindow.BottomRight, WpfTestHost.PixelAt(rendered, width, width * 3 / 4, height * 3 / 4));

                    // A non-central click must map to source pixels, not the much smaller
                    // captured bitmap. Compute the letterboxed image rectangle independently.
                    var fitDip = Math.Min(window.PreviewSurface.ActualWidth / sourceBounds.Width,
                        window.PreviewSurface.ActualHeight / sourceBounds.Height);
                    var drawWidth = sourceBounds.Width * fitDip;
                    var drawHeight = sourceBounds.Height * fitDip;
                    var click = new Point((window.PreviewSurface.ActualWidth - drawWidth) / 2 + drawWidth * 0.75,
                        (window.PreviewSurface.ActualHeight - drawHeight) / 2 + drawHeight * 0.25);
                    var screenPoint = window.PreviewSurface.PointToScreen(click);
                    Assert.True(NativeMethods.SetCursorPos((int)screenPoint.X, (int)screenPoint.Y));
                    WpfTestHost.PumpFor(TimeSpan.FromMilliseconds(100));
                    ClickPreview(window);
                    var mapped = CursorPosition();
                    Assert.InRange(mapped.X, (int)(sourceBounds.Width * 0.75) - 4, (int)(sourceBounds.Width * 0.75) + 4);
                    Assert.InRange(mapped.Y, (int)(sourceBounds.Height * 0.25) - 4, (int)(sourceBounds.Height * 0.25) + 4);
                    WpfTestHost.SaveEvidenceText("211-pointer-mapping.txt", $"source={sourceBounds} frame={width}x{height} mapped={mapped}\n");
                }
                finally
                {
                    content.Close();
                }
            });
        }
        finally
        {
            DashboardSettings.UseDataDirectory(realDataDirectory);
            if (Directory.Exists(testDataDirectory)) Directory.Delete(testDataDirectory, recursive: true);
        }
    }

    // Layout menu: each preset must land inside the host monitor's work area (never on the
    // source), keep the source's shape for the preview, line up with its edge, and be saved.
    // Ways this goes wrong: DIP and pixel units mixed at 125%+ scaling, the title bar or
    // control bar left out of the fit, or the frame not persisted after a native move.
    [Fact]
    public void LayoutPresetsSnapWithinTheHostWorkArea()
    {
        var realDataDirectory = DashboardSettings.DataDirectory;
        var testDataDirectory = Path.Combine(Path.GetTempPath(), "ClassroomWidgetsTests", Guid.NewGuid().ToString("N"));
        DashboardSettings.UseDataDirectory(testDataDirectory);
        try
        {
            WpfTestHost.Run(() =>
            {
                var host = HostDescriptor();
                // A 16:9 source display to the right of the host, as a second monitor would be.
                var sourceBounds = new Rect(host.Bounds.Right, host.Bounds.Top, 1920, 1080);
                var catalog = new DisplayCatalog(() => new[]
                {
                    host,
                    new DisplayDescriptor(SourceId, "Test display", sourceBounds, sourceBounds, false)
                });
                var settings = new DashboardSettings { DisplayPreviewSourceId = SourceId, DisplayPreviewFrame = PreviewFrame };
                using var coordinator = new DisplayPreviewCoordinator(settings, catalog);
                coordinator.Open();
                var window = coordinator.Window!;
                WpfTestHost.PumpUntil(() => window.IsVisible && window.StatusText.Text == "Click to see display", Timeout, "the preview to open");
                var work = host.WorkingArea;
                var margin = 12 * window.DeviceScale;
                foreach (var preset in Enum.GetValues<WindowSnapPreset>())
                {
                    Assert.True(coordinator.SnapTo(preset), preset.ToString());
                    WpfTestHost.PumpFor(TimeSpan.FromMilliseconds(250));
                    var bounds = window.GetPhysicalBounds();
                    var preview = window.PreviewSizePixels;
                    Assert.True(bounds.Left >= work.Left + margin - 1 && bounds.Top >= work.Top + margin - 1
                        && bounds.Right <= work.Right - margin + 1 && bounds.Bottom <= work.Bottom - margin + 1,
                        $"{preset}: {bounds} inside {work} less {margin}");
                    Assert.False(DisplayGeometry.Intersects(bounds, sourceBounds), preset.ToString());
                    Assert.True(Math.Abs(preview.Width / preview.Height - 16d / 9d) < 0.02, $"{preset}: preview {preview}");
                    switch (preset)
                    {
                        case WindowSnapPreset.LeftHalf or WindowSnapPreset.TopLeft or WindowSnapPreset.BottomLeft:
                            Assert.InRange(bounds.Left - (work.Left + margin), -1, 1);
                            break;
                        case WindowSnapPreset.RightHalf or WindowSnapPreset.TopRight or WindowSnapPreset.BottomRight:
                            Assert.InRange(work.Right - margin - bounds.Right, -1, 1);
                            break;
                    }
                    switch (preset)
                    {
                        case WindowSnapPreset.TopHalf or WindowSnapPreset.TopLeft or WindowSnapPreset.TopRight:
                            Assert.InRange(bounds.Top - (work.Top + margin), -1, 1);
                            break;
                        case WindowSnapPreset.BottomHalf or WindowSnapPreset.BottomLeft or WindowSnapPreset.BottomRight:
                            Assert.InRange(work.Bottom - margin - bounds.Bottom, -1, 1);
                            break;
                    }
                    var saved = settings.DisplayPreviewFrame!;
                    Assert.InRange(saved.Left - window.Left, -0.5, 0.5);
                    Assert.InRange(saved.Width - window.ActualWidth, -0.5, 0.5);
                    if (preset is WindowSnapPreset.LeftHalf or WindowSnapPreset.BottomRight or WindowSnapPreset.Fill)
                    {
                        WpfTestHost.SaveEvidence($"snap-{preset}.png", Snapshot(window));
                    }
                }

                // A maximised window: the restore must not land after the snap and undo it.
                window.WindowState = WindowState.Maximized;
                WpfTestHost.PumpFor(TimeSpan.FromMilliseconds(300));
                Assert.True(coordinator.SnapTo(WindowSnapPreset.LeftHalf));
                WpfTestHost.PumpFor(TimeSpan.FromMilliseconds(600));
                Assert.Equal(WindowState.Normal, window.WindowState);
                var restored = window.GetPhysicalBounds();
                Assert.InRange(restored.Left - (work.Left + margin), -1, 1);
                Assert.True(restored.Width < work.Width * 0.6, $"Left Half after maximise: {restored}");
            });
        }
        finally
        {
            DashboardSettings.UseDataDirectory(realDataDirectory);
            if (Directory.Exists(testDataDirectory)) Directory.Delete(testDataDirectory, recursive: true);
        }
    }

    /// <summary>
    /// Whether a frame has the source's aspect ratio and fills the preview on its limiting side.
    /// WPF layout rounding can move the image area by a pixel when the 42 DIP bar is a half
    /// pixel (125%, 175%), which the aspect ratio can turn into about 1.9 px on the other side.
    /// </summary>
    private static bool FitsPreview(int width, int height, double expectedWidth, double expectedHeight, Size source)
        => Math.Abs(height - width * source.Height / source.Width) <= 1.5
            && Math.Min(Math.Abs(width - expectedWidth), Math.Abs(height - expectedHeight)) <= 1.5
            && width <= expectedWidth + 2 && height <= expectedHeight + 2;

    /// <summary>The primary monitor's scale factor, read from a throwaway window placed on it.</summary>
    private static double PrimaryScale()
    {
        var probe = new Window { Left = 0, Top = 0, Width = 10, Height = 10, ShowActivated = false, ShowInTaskbar = false, WindowStyle = WindowStyle.None };
        probe.Show();
        try
        {
            return PresentationSource.FromVisual(probe)!.CompositionTarget!.TransformToDevice.M11;
        }
        finally
        {
            probe.Close();
        }
    }

    private static void AssertQuadrant(System.Windows.Media.Color expected, (byte R, byte G, byte B, byte A) actual)
    {
        Assert.InRange(actual.R, Math.Max(0, expected.R - 3), Math.Min(255, expected.R + 3));
        Assert.InRange(actual.G, Math.Max(0, expected.G - 3), Math.Min(255, expected.G + 3));
        Assert.InRange(actual.B, Math.Max(0, expected.B - 3), Math.Min(255, expected.B + 3));
    }

    private static IEnumerable<T> Descendants<T>(DependencyObject root) where T : DependencyObject
    {
        for (var index = 0; index < VisualTreeHelper.GetChildrenCount(root); index++)
        {
            var child = VisualTreeHelper.GetChild(root, index);
            if (child is T match) yield return match;
            foreach (var descendant in Descendants<T>(child)) yield return descendant;
        }
    }

    private static DisplayDescriptor HostDescriptor()
    {
        var screen = Forms.Screen.PrimaryScreen!;
        return new DisplayDescriptor(
            screen.DeviceName,
            "Main display",
            new Rect(screen.Bounds.X, screen.Bounds.Y, screen.Bounds.Width, screen.Bounds.Height),
            new Rect(screen.WorkingArea.X, screen.WorkingArea.Y, screen.WorkingArea.Width, screen.WorkingArea.Height),
            true);
    }

    private static void ClickPower(DisplayPreviewWindow window)
    {
        window.PowerButton.RaiseEvent(new RoutedEventArgs(ButtonBase.ClickEvent));
        WpfTestHost.DoEvents();
    }

    private static void ClickPreview(DisplayPreviewWindow window)
        => window.PreviewSurface.RaiseEvent(new MouseButtonEventArgs(Mouse.PrimaryDevice, Environment.TickCount, MouseButton.Left)
        {
            RoutedEvent = UIElement.MouseLeftButtonDownEvent,
            Source = window.PreviewSurface
        });

    private static void Nudge(DisplayPreviewWindow window)
    {
        window.Left += 1;
        WpfTestHost.DoEvents();
    }

    private static (int X, int Y) CenterPointer(DisplayPreviewWindow window)
    {
        var bounds = window.GetPhysicalBounds();
        var target = ((int)(bounds.X + bounds.Width / 2), (int)(bounds.Y + bounds.Height / 3));
        Assert.True(NativeMethods.SetCursorPos(target.Item1, target.Item2));
        WpfTestHost.PumpFor(TimeSpan.FromMilliseconds(50));
        return CursorPosition();
    }

    private static (int X, int Y) CursorPosition()
    {
        Assert.True(NativeMethods.GetCursorPos(out var point));
        return (point.X, point.Y);
    }

    private static System.Windows.Media.Imaging.RenderTargetBitmap Snapshot(Window window)
    {
        var width = Math.Max(1, (int)window.ActualWidth);
        var height = Math.Max(1, (int)window.ActualHeight);
        var target = new System.Windows.Media.Imaging.RenderTargetBitmap(width, height, 96, 96, System.Windows.Media.PixelFormats.Pbgra32);
        target.Render(window);
        return target;
    }

    private static class NativeMethods
    {
        [StructLayout(LayoutKind.Sequential)]
        public struct POINT
        {
            public int X;
            public int Y;
        }

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool SetCursorPos(int x, int y);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool GetCursorPos(out POINT point);

        [StructLayout(LayoutKind.Sequential)]
        public struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool GetClientRect(IntPtr handle, out RECT rect);
    }
}
