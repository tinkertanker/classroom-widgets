using System.Windows;
using ClassroomWidgets;
using Xunit;

namespace ClassroomWidgetsTests;

public sealed class MoveToNextDisplayGeometryTests
{
    private static readonly Rect Left = new(0, 0, 1920, 1080);
    private static readonly Rect Right = new(1920, 0, 1920, 1080);

    [Fact]
    public void PanelMovesToNextDisplayPreservingOffset()
    {
        var result = MoveToNextDisplayGeometry.NextDisplayFrame(new Rect(100, 50, 400, 300), [Left, Right]);
        Assert.Equal(new Rect(2020, 50, 400, 300), result);
    }

    [Fact]
    public void PanelWrapsFromLastDisplayToFirst()
    {
        var result = MoveToNextDisplayGeometry.NextDisplayFrame(new Rect(2000, 80, 300, 200), [Left, Right]);
        Assert.Equal(new Rect(80, 80, 300, 200), result);
    }

    [Fact]
    public void OffsetOverflowingSmallerTargetIsClamped()
    {
        var small = new Rect(1920, 0, 800, 600);
        var result = MoveToNextDisplayGeometry.NextDisplayFrame(new Rect(1500, 700, 400, 300), [Left, small]);
        Assert.Equal(new Rect(1920 + 800 - 400, 600 - 300, 400, 300), result);
    }

    [Fact]
    public void SingleOrNoDisplayReturnsNull()
    {
        Assert.Null(MoveToNextDisplayGeometry.NextDisplayFrame(new Rect(100, 50, 400, 300), [Left]));
        Assert.Null(MoveToNextDisplayGeometry.NextDisplayFrame(new Rect(100, 50, 400, 300), []));
    }

    [Fact]
    public void PanelOverlappingNoWorkAreaReturnsNull()
    {
        Assert.Null(MoveToNextDisplayGeometry.NextDisplayFrame(new Rect(5000, 5000, 400, 300), [Left, Right]));
    }

    [Fact]
    public void MoveWidgetDefaultInitializesOnceAndReservesItsKey()
    {
        var settings = new DashboardSettings();
        settings.ApplyWidgetShortcutDefaults([new CompactWidgetOption(7, "Timer")]);
        Assert.Equal(MoveWidgetShortcutLogic.DefaultShortcut, settings.MoveWidgetShortcut);
        Assert.True(settings.MoveWidgetShortcutInitialized);
        Assert.DoesNotContain(MoveWidgetShortcutLogic.DefaultShortcut, settings.WidgetShortcuts.Values);
        Assert.False(settings.ApplyWidgetShortcutDefaults([new CompactWidgetOption(7, "Timer")]));
    }

    [Fact]
    public void TakenMoveWidgetDefaultStaysUnassigned()
    {
        var settings = new DashboardSettings
        {
            WidgetShortcuts = new Dictionary<int, string?> { [7] = MoveWidgetShortcutLogic.DefaultShortcut }
        };
        settings.ApplyWidgetShortcutDefaults([new CompactWidgetOption(7, "Timer")]);
        Assert.Null(settings.MoveWidgetShortcut);
        Assert.True(settings.MoveWidgetShortcutInitialized);
    }
}
