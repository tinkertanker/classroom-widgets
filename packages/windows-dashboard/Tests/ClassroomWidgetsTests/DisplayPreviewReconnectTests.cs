using System.IO;
using System.Windows;
using System.Windows.Controls.Primitives;
using ClassroomWidgets;
using Xunit;
using Forms = System.Windows.Forms;

namespace ClassroomWidgetsTests;

/// <summary>
/// Drives the real coordinator and preview window through an unplug and replug.
/// The external displays are fake descriptors beside the primary display; each
/// test calls <c>DisplaysChanged</c> the way the SystemEvents handler does.
/// </summary>
public sealed class DisplayPreviewReconnectTests
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan PastDebounce = DisplayReconnectPolicy.Debounce + TimeSpan.FromMilliseconds(500);
    private static readonly PanelFrame PreviewFrame = new() { Left = 700, Top = 340, Width = 480, Height = 330 };
    private const string Ready = "Click to see display";

    [Fact]
    public void UnpluggingADockHidesDisplayAndReplugReopensTheChosenDisplayWithoutActivating()
        => WithDisplays((host, displays, settings, coordinator) =>
        {
            var (left, right) = Externals(host);
            displays.AddRange(new[] { left, right });
            settings.DisplayPreviewSourceId = right.Id;
            coordinator.Open();
            WpfTestHost.PumpUntil(() => coordinator.Window?.StatusText.Text == Ready, Timeout, "the preview to open");

            displays.RemoveRange(1, 2);
            coordinator.DisplaysChanged();
            WpfTestHost.PumpUntil(() => coordinator.Window is null, Timeout, "the disconnect to hide Display");
            Assert.Equal(right.Id, settings.DisplayPreviewSourceId);

            displays.AddRange(new[] { right, left });
            coordinator.DisplaysChanged();
            WpfTestHost.PumpUntil(() => coordinator.Window is { IsVisible: true }, Timeout, "the reconnect to reopen Display");
            Assert.False(coordinator.Window!.ShowActivated);
            WpfTestHost.PumpUntil(() => coordinator.Window?.StatusText.Text == Ready, Timeout, "the saved display to be selected");
            Assert.Equal(right.Id, settings.DisplayPreviewSourceId);
        });

    [Fact]
    public void ADockWhoseDisplaysReturnOneAtATimeEndsOnTheSavedDisplay()
        => WithDisplays((host, displays, settings, coordinator) =>
        {
            var (left, right) = Externals(host);
            displays.AddRange(new[] { left, right });
            settings.DisplayPreviewSourceId = right.Id;
            coordinator.Open();

            displays.RemoveRange(1, 2);
            coordinator.DisplaysChanged();
            WpfTestHost.PumpUntil(() => coordinator.Window is null, Timeout, "the disconnect to hide Display");
            displays.Add(left);
            coordinator.DisplaysChanged();
            WpfTestHost.PumpUntil(() => coordinator.Window is { IsVisible: true }, Timeout, "the first display to reopen Display");
            Assert.Equal(left.Id, coordinator.SelectedSource?.Id);
            Assert.Equal(right.Id, settings.DisplayPreviewSourceId);

            displays.Add(right);
            coordinator.DisplaysChanged();
            Assert.Equal(right.Id, coordinator.SelectedSource?.Id);
        });

    [Fact]
    public void ALiveStandInIsNotSwitchedAwayOutsideTheReopenWindow()
        => WithDisplays((host, displays, settings, coordinator) =>
        {
            var (_, right) = Externals(host);
            // Covers the preview window, so turning it on keeps capture intent without GDI capture.
            var standIn = new DisplayDescriptor(@"\\.\CLASSROOM_WIDGETS_TEST_C", "Test display C", host.Bounds, host.WorkingArea, false);
            displays.AddRange(new[] { standIn, right });
            settings.DisplayPreviewSourceId = right.Id;
            coordinator.Open();
            displays.Remove(right);
            coordinator.DisplaysChanged();
            Assert.Equal(standIn.Id, coordinator.SelectedSource?.Id);

            coordinator.Window!.PowerButton.RaiseEvent(new RoutedEventArgs(ButtonBase.ClickEvent));
            WpfTestHost.DoEvents();
            displays.Add(right);
            coordinator.DisplaysChanged();
            Assert.Equal(standIn.Id, coordinator.SelectedSource?.Id);
        });

    [Fact]
    public void DisplayTheUserClosedStaysClosedAcrossUnplugAndReplug()
        => WithDisplays((host, displays, _, coordinator) =>
        {
            var (left, _) = Externals(host);
            displays.Add(left);
            coordinator.Open();
            coordinator.Close();
            Assert.Null(coordinator.Window);

            displays.RemoveAt(1);
            coordinator.DisplaysChanged();
            WpfTestHost.PumpFor(PastDebounce);
            displays.Add(left);
            coordinator.DisplaysChanged();
            WpfTestHost.PumpFor(PastDebounce);
            Assert.Null(coordinator.Window);
        });

    [Fact]
    public void WithReconnectShowingOffAnAutoHiddenDisplayStaysHidden()
        => WithDisplays((host, displays, settings, coordinator) =>
        {
            var (left, _) = Externals(host);
            displays.Add(left);
            settings.DisplayPreviewShowOnReconnect = false;
            coordinator.Open();

            displays.RemoveAt(1);
            coordinator.DisplaysChanged();
            WpfTestHost.PumpUntil(() => coordinator.Window is null, Timeout, "the disconnect to hide Display");
            displays.Add(left);
            coordinator.DisplaysChanged();
            WpfTestHost.PumpFor(PastDebounce);
            Assert.Null(coordinator.Window);
        });

    private static void WithDisplays(Action<DisplayDescriptor, List<DisplayDescriptor>, DashboardSettings, DisplayPreviewCoordinator> body)
    {
        var realDataDirectory = DashboardSettings.DataDirectory;
        var testDataDirectory = Path.Combine(Path.GetTempPath(), "ClassroomWidgetsTests", Guid.NewGuid().ToString("N"));
        DashboardSettings.UseDataDirectory(testDataDirectory);
        try
        {
            WpfTestHost.Run(() =>
            {
                var host = HostDescriptor();
                var displays = new List<DisplayDescriptor> { host };
                var settings = new DashboardSettings { DisplayPreviewFrame = PreviewFrame };
                // The catalog reads the live list, so tests unplug by editing it.
                var catalog = new DisplayCatalog(() => displays.ToList());
                // Seed the two-display state before the coordinator captures it.
                displays.Add(Externals(host).Left);
                using var coordinator = new DisplayPreviewCoordinator(settings, catalog);
                displays.RemoveAt(1);
                body(host, displays, settings, coordinator);
            });
        }
        finally
        {
            DashboardSettings.UseDataDirectory(realDataDirectory);
            if (Directory.Exists(testDataDirectory)) Directory.Delete(testDataDirectory, recursive: true);
        }
    }

    private static (DisplayDescriptor Left, DisplayDescriptor Right) Externals(DisplayDescriptor host)
    {
        var first = new Rect(host.Bounds.Right, host.Bounds.Top, 1920, 1080);
        var second = new Rect(first.Right, host.Bounds.Top, 1920, 1080);
        return (
            new DisplayDescriptor(@"\\.\CLASSROOM_WIDGETS_TEST_A", "Test display A", first, first, false),
            new DisplayDescriptor(@"\\.\CLASSROOM_WIDGETS_TEST_B", "Test display B", second, second, false));
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
}
