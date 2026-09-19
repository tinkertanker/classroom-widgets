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
        Assert.Equal("right", DisplayGeometry.DescribePosition(new Rect(1, -1, 1, 1)));
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
}
