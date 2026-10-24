using System.IO;
using System.Text.Json;
using System.Windows;
using ClassroomWidgets;
using Xunit;

namespace ClassroomWidgetsTests;

/// <summary>
/// Real panel windows. Ways this goes wrong: the 30 DIP chrome strip is left out so the web
/// view loses its aspect ratio, a widget's maximum size is ignored, a fixed-size widget is
/// resized, the panel leaves its monitor's work area, or the new frame is not saved.
/// </summary>
public sealed class WidgetPanelSnapTests
{
    [Fact]
    public void PresetsPlaceRealPanelsOnTheirMonitorWithinTheirLimits()
    {
        var realDataDirectory = DashboardSettings.DataDirectory;
        var testDataDirectory = Path.Combine(Path.GetTempPath(), "ClassroomWidgetsTests", Guid.NewGuid().ToString("N"));
        DashboardSettings.UseDataDirectory(testDataDirectory);
        try
        {
            WpfTestHost.Run(() =>
            {
                var payload = JsonDocument.Parse("{}").RootElement;
                WidgetPanelDescriptor Descriptor(string id, PanelSize preferred, PanelSize? maximum, bool resizable, double? aspect)
                    => new(id, id, preferred, new PanelSize(250, 160), maximum, resizable, aspect, 1, 1, false, payload);
                var settings = new DashboardSettings();
                var coordinator = new WidgetPanelCoordinator(settings);
                coordinator.Reconcile(new WidgetPanelInventory("fixture", 1, new[]
                {
                    Descriptor("timer", new PanelSize(350, 415), null, true, 350d / 415d),
                    Descriptor("banner", new PanelSize(400, 200), new PanelSize(500, 300), true, null),
                    Descriptor("light", new PanelSize(300, 180), null, false, null)
                }, null));
                try
                {
                    WpfTestHost.PumpFor(TimeSpan.FromMilliseconds(500));
                    var lightSize = new Size(300, 180 + WidgetPanelWindow.ChromeHeight);
                    foreach (var preset in Enum.GetValues<WindowSnapPreset>())
                    {
                        foreach (var id in new[] { "timer", "banner", "light" })
                        {
                            Assert.True(coordinator.SnapPanel(id, preset), $"{id} {preset}");
                            WpfTestHost.PumpFor(TimeSpan.FromMilliseconds(150));
                            var panel = coordinator.PanelFor(id)!;
                            var frame = panel.CurrentFrame;
                            var area = ScreenGeometry.WorkAreaContaining(frame);
                            area.Inflate(-12, -12);
                            var label = $"{id} {preset} {frame} in {area}";
                            Assert.True(frame.Left >= area.Left - 0.5 && frame.Top >= area.Top - 0.5
                                && frame.Right <= area.Right + 0.5 && frame.Bottom <= area.Bottom + 0.5, label);
                            switch (preset)
                            {
                                case WindowSnapPreset.LeftHalf or WindowSnapPreset.TopLeft or WindowSnapPreset.BottomLeft:
                                    Assert.True(Math.Abs(frame.Left - area.Left) <= 0.5, label);
                                    break;
                                case WindowSnapPreset.RightHalf or WindowSnapPreset.TopRight or WindowSnapPreset.BottomRight:
                                    Assert.True(Math.Abs(frame.Right - area.Right) <= 0.5, label);
                                    break;
                            }
                            switch (preset)
                            {
                                case WindowSnapPreset.TopHalf or WindowSnapPreset.TopLeft or WindowSnapPreset.TopRight:
                                    Assert.True(Math.Abs(frame.Top - area.Top) <= 0.5, label);
                                    break;
                                case WindowSnapPreset.BottomHalf or WindowSnapPreset.BottomLeft or WindowSnapPreset.BottomRight:
                                    Assert.True(Math.Abs(frame.Bottom - area.Bottom) <= 0.5, label);
                                    break;
                            }
                            var saved = settings.PanelFrames[id];
                            Assert.True(Math.Abs(saved.Left - frame.Left) <= 0.5 && Math.Abs(saved.Width - frame.Width) <= 0.5, $"{label} is saved");
                        }
                        var timer = coordinator.PanelFor("timer")!.CurrentFrame;
                        Assert.True(Math.Abs(timer.Width / (timer.Height - WidgetPanelWindow.ChromeHeight) - 350d / 415d) < 0.005, $"timer {preset} keeps its web aspect ratio");
                        var banner = coordinator.PanelFor("banner")!.CurrentFrame;
                        Assert.True(banner.Width <= 500.5 && banner.Height <= 300.5 + WidgetPanelWindow.ChromeHeight, $"banner {preset} keeps its maximum");
                        Assert.Equal(lightSize, coordinator.PanelFor("light")!.CurrentFrame.Size);
                    }
                    Assert.Equal(WidgetPanelLayout.Freeform, coordinator.Layout);
                }
                finally
                {
                    coordinator.Deactivate();
                }
            });
        }
        finally
        {
            DashboardSettings.UseDataDirectory(realDataDirectory);
            if (Directory.Exists(testDataDirectory)) Directory.Delete(testDataDirectory, recursive: true);
        }
    }
}
