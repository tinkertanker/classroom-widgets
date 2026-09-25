using System.Text.Json;
using ClassroomWidgets;
using Xunit;

namespace ClassroomWidgetsTests;

/// <summary>
/// The teacher app's compactWidgetOptions contract as the tray and panel add
/// menus consume it.
///
/// Ways this can fail:
/// 1. An inventory without menuGroup or emoji (an older bundle, or a newer one
///    that drops emoji) loses its options, so the menus stay on "Loading".
/// 2. A non-numeric menuGroup throws out of JsonElement.TryGetInt32 and the
///    whole inventory is discarded.
/// 3. A blank emoji is kept, so the label starts with an empty gap.
/// 4. Options are re-sorted (by type or title) instead of kept in the order
///    received, which is the native menu order.
/// 5. Separators land in the wrong place: before the first widget (splitting
///    it from Display), between widgets of one group, or not at a group change.
/// </summary>
public sealed class CompactWidgetMenuTests
{
    private static IReadOnlyList<CompactWidgetOption> ParseOptions(string optionsJson)
    {
        using var document = JsonDocument.Parse(
            $$"""{"schemaVersion":1,"hostInstanceId":"host","inventoryRevision":1,"widgets":[],"compactWidgetOptions":{{optionsJson}}}""");
        var inventory = WidgetPanelInventory.FromMessage(document.RootElement);
        Assert.NotNull(inventory);
        Assert.NotNull(inventory.Options);
        return inventory.Options;
    }

    [Fact]
    public void OptionsWithoutGroupOrEmojiParseInReceivedOrder()
    {
        var options = ParseOptions("""
            [{"widgetType":12,"title":"QR Code","menuGroup":3,"emoji":"\uD83D\uDD33"},
             {"widgetType":1,"title":"Timer"},
             {"widgetType":7,"title":"Text Banner","menuGroup":0}]
            """);

        Assert.Equal(new[] { 12, 1, 7 }, options.Select(option => option.WidgetType));
        Assert.Equal(3, options[0].MenuGroup);
        Assert.Equal("\uD83D\uDD33", options[0].Emoji);
        Assert.Equal(0, options[1].MenuGroup);
        Assert.Null(options[1].Emoji);
    }

    [Fact]
    public void MalformedGroupOrBlankEmojiKeepsTheOption()
    {
        var options = ParseOptions("""
            [{"widgetType":1,"title":"Timer","menuGroup":null,"emoji":"  "},
             {"widgetType":7,"title":"Text Banner","menuGroup":"1","emoji":5},
             {"widgetType":4,"title":"Traffic Light","menuGroup":1.5}]
            """);

        Assert.Equal(new[] { 1, 7, 4 }, options.Select(option => option.WidgetType));
        Assert.All(options, option => Assert.Equal(0, option.MenuGroup));
        Assert.All(options, option => Assert.Null(option.Emoji));
        Assert.Equal("Timer", CompactWidgetMenu.Label(options[0]));
    }

    [Fact]
    public void SeparatorsFallOnlyWhereTheGroupChanges()
    {
        var options = new[]
        {
            new CompactWidgetOption(1, "Timer", 0),
            new CompactWidgetOption(7, "Text Banner", 0),
            new CompactWidgetOption(4, "Traffic Light", 1),
            new CompactWidgetOption(3, "Task Cue", 1),
            new CompactWidgetOption(0, "Randomiser", 2),
            new CompactWidgetOption(6, "Link Shortener", 3)
        };

        var separated = CompactWidgetMenu.Entries(options)
            .Where(entry => entry.SeparatorBefore)
            .Select(entry => entry.Option.WidgetType);

        Assert.Equal(new[] { 4, 0, 6 }, separated);
    }
}
