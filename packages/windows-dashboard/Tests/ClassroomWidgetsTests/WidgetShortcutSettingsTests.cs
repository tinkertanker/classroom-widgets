using ClassroomWidgets;
using Xunit;

namespace ClassroomWidgetsTests;

public sealed class WidgetShortcutSettingsTests
{
    [Fact]
    public void ExistingShowShortcutMigratesToMatchingDismissShortcut()
    {
        var settings = new DashboardSettings
        {
            WidgetShortcutsInitialized = true,
            WidgetShortcuts = new Dictionary<int, string?> { [40] = "Ctrl+Alt+D" }
        };

        settings.ApplyWidgetShortcutDefaults([new CompactWidgetOption(40, "Display")]);

        Assert.Equal("Ctrl+Alt+D", settings.WidgetDismissShortcuts[40]);
    }

    [Fact]
    public void LaterInventoryBackfillsShowAndDismissDefaultsWithoutOverwritingCustomValues()
    {
        var settings = new DashboardSettings();
        settings.ApplyWidgetShortcutDefaults([new CompactWidgetOption(40, "Display")]);
        settings.WidgetShortcuts[40] = "Ctrl+Alt+D";

        settings.ApplyWidgetShortcutDefaults([
            new CompactWidgetOption(40, "Display"),
            new CompactWidgetOption(7, "Timer")
        ]);

        Assert.Equal("Ctrl+Alt+D", settings.WidgetShortcuts[40]);
        Assert.Equal("Ctrl+Alt+Shift+2", settings.WidgetShortcuts[7]);
        Assert.Equal("Ctrl+Alt+Shift+1", settings.WidgetDismissShortcuts[40]);
        Assert.Equal("Ctrl+Alt+Shift+2", settings.WidgetDismissShortcuts[7]);
    }

    [Fact]
    public void BackfillUsesAnUnclaimedDefaultWhenInventoryOrderChanges()
    {
        var settings = new DashboardSettings
        {
            WidgetShortcutsInitialized = true,
            WidgetShortcuts = new Dictionary<int, string?> { [7] = "Ctrl+Alt+Shift+1" },
            WidgetDismissShortcuts = new Dictionary<int, string?> { [7] = "Ctrl+Alt+Shift+1" }
        };

        settings.ApplyWidgetShortcutDefaults([
            new CompactWidgetOption(40, "Randomiser"),
            new CompactWidgetOption(7, "Timer")
        ]);

        Assert.Equal("Ctrl+Alt+Shift+1", settings.WidgetShortcuts[7]);
        Assert.Equal("Ctrl+Alt+Shift+2", settings.WidgetShortcuts[40]);
        Assert.Equal("Ctrl+Alt+Shift+2", settings.WidgetDismissShortcuts[40]);
    }
}
