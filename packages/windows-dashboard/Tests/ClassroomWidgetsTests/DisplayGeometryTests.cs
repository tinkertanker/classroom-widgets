using System.Windows;
using ClassroomWidgets;
using Xunit;

namespace ClassroomWidgetsTests;

public sealed class DisplayGeometryTests
{
    [Fact]
    public void AspectFitCentersContentAndRejectsInvalidSizes()
    {
        var result = DisplayGeometry.AspectFit(new Size(16, 9), new Rect(0, 0, 100, 100));
        Assert.Equal(new Rect(0, 21.875, 100, 56.25), result);
        Assert.Null(DisplayGeometry.AspectFit(new Size(0, 1), new Rect(0, 0, 100, 100)));
    }

    [Fact]
    public void MappingUsesOpenEdgesAndClampsCoordinates()
    {
        var source = new Rect(100, 200, 10, 20);
        Assert.Equal(new Point(100, 200), DisplayGeometry.MapPreviewPointToSource(new Point(0, 0), new Rect(0, 0, 10, 20), source));
        Assert.Equal(new Point(109, 219), DisplayGeometry.MapPreviewPointToSource(new Point(9.999, 19.999), new Rect(0, 0, 10, 20), source));
        Assert.Null(DisplayGeometry.MapPreviewPointToSource(new Point(10, 5), new Rect(0, 0, 10, 20), source));
    }

    [Fact]
    public void IntersectsOnlyWhenAreaIsPositive()
    {
        Assert.False(DisplayGeometry.Intersects(new Rect(0, 0, 10, 10), new Rect(10, 0, 10, 10)));
        Assert.True(DisplayGeometry.Intersects(new Rect(0, 0, 10, 10), new Rect(9, 0, 10, 10)));
    }

    [Fact]
    public void PositionUsesRequestedPriority()
    {
        Assert.Equal("left", DisplayGeometry.DescribePosition(new Rect(-1, -1, 1, 1)));
        Assert.Equal("above", DisplayGeometry.DescribePosition(new Rect(0, -1, 1, 1)));
        Assert.Equal("right", DisplayGeometry.DescribePosition(new Rect(1, 0, 1, 1)));
        Assert.Equal("below", DisplayGeometry.DescribePosition(new Rect(0, 1, 1, 1)));
        Assert.Equal("main", DisplayGeometry.DescribePosition(new Rect(0, 0, 1, 1)));
    }

    [Fact]
    public void AspectNormalizationHonorsMinimumAndMaximum()
    {
        var fitted = DisplayGeometry.AspectNormalizedWindowSize(16.0 / 9, new Size(800, 600), 42, new Size(320, 180), new Size(1200, 900));
        Assert.Equal(800, fitted.Width);
        Assert.Equal(492, fitted.Height);
        var limited = DisplayGeometry.AspectNormalizedWindowSize(16.0 / 9, new Size(2000, 1500), 42, new Size(320, 180), new Size(1000, 700));
        Assert.True(limited.Width <= 1000);
        Assert.True(limited.Height <= 700);
    }

    // How capture sizing can go wrong (#211): the aspect ratio drifts so the preview is
    // squashed and clicks land in the wrong place; a small source is upscaled (more work,
    // no gain); a not-yet-laid-out, collapsed or non-finite preview size gives a zero or NaN
    // capture size, or a silent full-size capture; an extreme aspect rounds one side to 0.
    [Fact]
    public void CaptureSizeFitsThePreviewKeepsAspectAndNeverUpscales()
    {
        var uhd = new Size(3840, 2160);
        Assert.Equal((720, 405), DisplayGeometry.CaptureSize(uhd, new Size(720, 405)));
        Assert.Equal((720, 405), DisplayGeometry.CaptureSize(uhd, new Size(720, 540)));
        Assert.Equal((600, 338), DisplayGeometry.CaptureSize(uhd, new Size(600, 600)));
        Assert.Equal((889, 500), DisplayGeometry.CaptureSize(new Size(1280, 720), new Size(2000, 500)));

        Assert.Equal((1280, 720), DisplayGeometry.CaptureSize(new Size(1280, 720), new Size(1920, 1080)));
        Assert.Equal((1280, 720), DisplayGeometry.CaptureSize(new Size(1280, 720), new Size(1280, 720)));
    }

    [Fact]
    public void CaptureSizeIsUndefinedUntilThePreviewHasAUsableSize()
    {
        var source = new Size(1920, 1080);
        Assert.Null(DisplayGeometry.CaptureSize(source, Size.Empty));
        Assert.Null(DisplayGeometry.CaptureSize(source, new Size(0, 0)));
        Assert.Null(DisplayGeometry.CaptureSize(source, new Size(0.4, 300)));
        Assert.Null(DisplayGeometry.CaptureSize(source, new Size(double.NaN, 300)));
        Assert.Null(DisplayGeometry.CaptureSize(source, new Size(double.PositiveInfinity, double.PositiveInfinity)));
        Assert.Equal((100, 1), DisplayGeometry.CaptureSize(new Size(4000, 10), new Size(100, 100)));
        Assert.Equal((1, 1), DisplayGeometry.CaptureSize(new Size(0, 0), new Size(100, 100)));
    }
}
