using System.Windows;
using ClassroomWidgets;
using Xunit;

namespace ClassroomWidgetsTests;

// Failure modes this guards (WPF DIPs, y down):
// - a half or quarter leaves its edge, or overlaps its neighbour
// - the title bar, control bar and borders are left out, so the frame spills past the region
// - the preview loses the source aspect ratio
// - a work area with a non-zero origin (second monitor, top taskbar) is ignored
// - the minimum size pushes the frame off the work area
// - bad aspect or work-area values produce NaN frames
// - a widget's maximum size is ignored, or a capped window drifts off its edge
// - a fixed-size widget is resized instead of only moved
public sealed class WindowSnapGeometryTests
{
    private static readonly Rect Work = new(0, 0, 1920, 1080);
    private static readonly Rect Area = new(12, 12, 1896, 1056);
    private static readonly Size Chrome = new(16, 81);
    private static readonly Size Minimum = new(320, 282);
    private static readonly Rect Current = new(100, 100, 480, 360);

    private static Rect? Frame(WindowSnapPreset preset, double? aspect = 16d / 9d, Rect? work = null, Rect? current = null, Size? minimum = null, Size? maximum = null)
        => WindowSnapGeometry.Frame(preset, work ?? Work, aspect, Chrome, minimum ?? Minimum, maximum, current ?? Current, 12);

    private static void AssertInside(Rect rect, Rect outer, string message)
        => Assert.True(rect.Left >= outer.Left - 0.001 && rect.Top >= outer.Top - 0.001
            && rect.Right <= outer.Right + 0.001 && rect.Bottom <= outer.Bottom + 0.001, $"{message} {rect}");

    private static bool Overlaps(Rect a, Rect b)
        => Math.Min(a.Right, b.Right) - Math.Max(a.Left, b.Left) > 0.001 && Math.Min(a.Bottom, b.Bottom) - Math.Max(a.Top, b.Top) > 0.001;

    [Fact]
    public void EveryPresetStaysInsideTheInsetWorkArea()
    {
        foreach (var preset in Enum.GetValues<WindowSnapPreset>())
        {
            var frame = Frame(preset);
            Assert.NotNull(frame);
            AssertInside(frame!.Value, Area, preset.ToString());
        }
    }

    [Fact]
    public void HalvesAndQuartersTouchTheirEdgesWithoutOverlapping()
    {
        var left = Frame(WindowSnapPreset.LeftHalf)!.Value;
        var right = Frame(WindowSnapPreset.RightHalf)!.Value;
        Assert.Equal(Area.Left, left.Left, 3);
        Assert.Equal(Area.Right, right.Right, 3);
        Assert.Equal(Area.Top + Area.Height / 2, left.Top + left.Height / 2, 3);
        Assert.Equal(942, left.Width, 3);
        Assert.False(Overlaps(left, right));
        Assert.Equal(Area.Top, Frame(WindowSnapPreset.TopHalf)!.Value.Top, 3);
        Assert.Equal(Area.Bottom, Frame(WindowSnapPreset.BottomHalf)!.Value.Bottom, 3);

        var corners = new[] { WindowSnapPreset.TopLeft, WindowSnapPreset.TopRight, WindowSnapPreset.BottomLeft, WindowSnapPreset.BottomRight }
            .Select(preset => Frame(preset)!.Value).ToArray();
        Assert.Equal(new Point(Area.Left, Area.Top), corners[0].TopLeft);
        Assert.Equal(new Point(Area.Right, Area.Bottom), corners[3].BottomRight);
        for (var i = 0; i < corners.Length; i++)
        {
            for (var j = i + 1; j < corners.Length; j++) Assert.False(Overlaps(corners[i], corners[j]), $"{i} {j}");
        }
    }

    [Fact]
    public void PreviewKeepsTheSourceAspectWithChromeAdded()
    {
        foreach (var aspect in new[] { 16d / 9d, 4d / 3d, 16d / 10d, 21d / 9d, 9d / 16d })
        {
            foreach (var preset in Enum.GetValues<WindowSnapPreset>().Where(preset => preset != WindowSnapPreset.Centre))
            {
                var frame = Frame(preset, aspect)!.Value;
                var preview = (frame.Width - Chrome.Width) / (frame.Height - Chrome.Height);
                Assert.True(Math.Abs(preview - aspect) < aspect * 0.001, $"{preset} {aspect} {frame}");
            }
        }
    }

    [Fact]
    public void WithoutAnAspectTheFrameFillsItsRegion()
    {
        Assert.Equal(new Rect(12, 12, 942, 1056), Frame(WindowSnapPreset.LeftHalf, null));
        Assert.Equal(new Rect(966, 546, 942, 522), Frame(WindowSnapPreset.BottomRight, null));
        Assert.Equal(Area, Frame(WindowSnapPreset.Fill, null));
        foreach (var invalid in new[] { 0, -1, double.NaN, double.PositiveInfinity })
        {
            Assert.Equal(new Rect(12, 12, 942, 1056), Frame(WindowSnapPreset.LeftHalf, invalid));
        }
    }

    [Fact]
    public void CentreKeepsTheSizeAndIsClampedToTheWorkArea()
    {
        Assert.Equal(new Rect(720, 360, 480, 360), Frame(WindowSnapPreset.Centre));
        Assert.Equal(Area, Frame(WindowSnapPreset.Centre, current: new Rect(0, 0, 4000, 3000)));
    }

    [Fact]
    public void WorkAreaWithANonZeroOriginIsRespected()
    {
        var second = new Rect(-1440, 40, 1440, 860);
        var secondArea = new Rect(-1428, 52, 1416, 836);
        foreach (var preset in Enum.GetValues<WindowSnapPreset>()) AssertInside(Frame(preset, work: second)!.Value, secondArea, preset.ToString());
        Assert.Equal(new Point(-1428, 52), Frame(WindowSnapPreset.TopLeft, work: second)!.Value.TopLeft);
    }

    [Fact]
    public void MinimumSizeWinsOverASmallRegionButStaysOnTheWorkArea()
    {
        var small = new Rect(100, 50, 700, 500);
        var smallArea = new Rect(112, 62, 676, 476);
        foreach (var preset in Enum.GetValues<WindowSnapPreset>())
        {
            var frame = Frame(preset, work: small)!.Value;
            Assert.True(frame.Width >= Minimum.Width - 0.001 && frame.Height >= Minimum.Height - 0.001, $"{preset} {frame}");
            AssertInside(frame, smallArea, preset.ToString());
        }
        Assert.Equal(smallArea.Right, Frame(WindowSnapPreset.BottomRight, work: small)!.Value.Right, 3);
        AssertInside(Frame(WindowSnapPreset.LeftHalf, work: new Rect(0, 0, 300, 200))!.Value, new Rect(0, 0, 300, 200), "tiny");
    }

    [Fact]
    public void MaximumCapsTheFrameKeepsTheAspectAndTheEdge()
    {
        var rightHalf = Frame(WindowSnapPreset.RightHalf, maximum: new Size(500, 600))!.Value;
        Assert.True(rightHalf.Width <= 500.001, rightHalf.ToString());
        Assert.Equal(16d / 9d, (rightHalf.Width - Chrome.Width) / (rightHalf.Height - Chrome.Height), 3);
        Assert.Equal(Area.Right, rightHalf.Right, 3);
        Assert.Equal(new Rect(12, 546, 500, 522), Frame(WindowSnapPreset.BottomLeft, null, maximum: new Size(500, 600)));
    }

    [Fact]
    public void FixedSizeWidgetIsOnlyMoved()
    {
        var size = new Size(300, 200);
        foreach (var preset in Enum.GetValues<WindowSnapPreset>())
        {
            var frame = Frame(preset, null, minimum: size, maximum: size)!.Value;
            Assert.Equal(size, frame.Size);
            AssertInside(frame, Area, preset.ToString());
        }
        Assert.Equal(new Rect(1608, 12, 300, 200), Frame(WindowSnapPreset.TopRight, null, minimum: size, maximum: size));
    }

    [Fact]
    public void MinimumWinsOverABrokenMaximum()
        => Assert.Equal(Minimum, Frame(WindowSnapPreset.Fill, null, maximum: new Size(100, 100))!.Value.Size);

    [Fact]
    public void UnusableInputReturnsNull()
    {
        Assert.Null(Frame(WindowSnapPreset.LeftHalf, work: new Rect(0, 0, 0, 1080)));
        Assert.Null(Frame(WindowSnapPreset.LeftHalf, work: new Rect(double.NaN, 0, 1920, 1080)));
        Assert.Null(Frame(WindowSnapPreset.Centre, current: new Rect(0, 0, double.NaN, 10)));
    }
}
