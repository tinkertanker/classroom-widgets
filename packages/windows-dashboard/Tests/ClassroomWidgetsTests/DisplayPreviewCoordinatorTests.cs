using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
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
            coordinator.Close();
            WpfTestHost.PumpFor(Settle);
            Assert.Null(coordinator.Window);
            Assert.Null(coordinator.Capture);
            Assert.Null(last.Image);
            Assert.False(coordinator.IsOpen);
        }
        finally
        {
            content.Close();
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
    }
}
