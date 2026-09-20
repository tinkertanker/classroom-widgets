using System.Windows;
using ClassroomWidgets;
using Xunit;

namespace ClassroomWidgetsTests;

public sealed class DisplayCatalogTests
{
    private static DisplayDescriptor Display(string id, string name, double x, bool primary = false)
        => new(id, name, new Rect(x, 0, 800, 600), new Rect(x, 0, 800, 580), primary);

    [Fact]
    public void SourcesExcludeHostAndResolveRememberedOrSoleDisplay()
    {
        var displays = new[] { Display("A", "Main display", 0, true), Display("B", "Display 2", 800) };
        var catalog = new DisplayCatalog(() => displays);
        var candidates = catalog.EligibleSources("A");
        Assert.Single(candidates);
        Assert.Equal("B", catalog.ResolveSource(null, candidates)?.Id);
        Assert.Equal("B", catalog.ResolveSource("B", candidates)?.Id);
        Assert.Null(catalog.ResolveSource("missing", new[] { displays[0], displays[1] }));
    }

    [Fact]
    public void CurrentMatchingRefreshesDescriptorAndFormatsLabel()
    {
        var catalog = new DisplayCatalog(() => new[] { Display("B", "Display 2", -800) });
        var current = catalog.CurrentMatching(Display("B", "old", 0));
        Assert.Equal(-800, current?.Bounds.X);
        Assert.Contains("800 × 600", catalog.SourceLabel(current!));
        Assert.Contains("left", catalog.SourceLabel(current!));
    }
}
