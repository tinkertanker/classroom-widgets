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

    [Fact]
    public void LegacyDisplayShowBecomesMatchingDismissEvenWithoutWidgetInventory()
    {
        var settings = DashboardSettings.DeserializeSettings(
            """{"DisplayPreviewShortcut":"Ctrl+Alt+D"}""")!;

        settings.ApplyWidgetShortcutDefaults(Array.Empty<CompactWidgetOption>());

        var saved = System.Text.Json.JsonSerializer.SerializeToElement(settings);
        Assert.True(saved.TryGetProperty("DisplayPreviewDismissShortcut", out var dismiss));
        Assert.Equal("Ctrl+Alt+D", dismiss.GetString());
        Assert.Equal("Ctrl+Alt+D", settings.DisplayPreviewShortcut);
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("""{"DisplayPreviewShortcut":null}""")]
    public void LegacyMissingOrNullDisplayShowStaysUnassigned(string json)
    {
        var settings = DashboardSettings.DeserializeSettings(json)!;

        settings.ApplyWidgetShortcutDefaults(Array.Empty<CompactWidgetOption>());

        Assert.Null(settings.DisplayPreviewShortcut);
        Assert.Null(settings.DisplayPreviewDismissShortcut);
        Assert.True(settings.DisplayPreviewShortcutsInitialized);
    }

    [Fact]
    public void ExplicitlyClearedDisplayShortcutsStayClearedAfterReloadAndBackfill()
    {
        var settings = System.Text.Json.JsonSerializer.Deserialize<DashboardSettings>(
            """{"DisplayPreviewShortcutsInitialized":true,"DisplayPreviewShortcut":null,"DisplayPreviewDismissShortcut":null}""")!;

        settings.ApplyWidgetShortcutDefaults([new CompactWidgetOption(7, "Timer")]);

        Assert.Null(settings.DisplayPreviewShortcut);
        var reloaded = System.Text.Json.JsonSerializer.Deserialize<DashboardSettings>(
            System.Text.Json.JsonSerializer.Serialize(settings))!;
        reloaded.ApplyWidgetShortcutDefaults([new CompactWidgetOption(7, "Timer"), new CompactWidgetOption(40, "Randomiser")]);
        Assert.Null(reloaded.DisplayPreviewShortcut);
        var saved = System.Text.Json.JsonSerializer.SerializeToElement(reloaded);
        Assert.Equal(System.Text.Json.JsonValueKind.Null, saved.GetProperty("DisplayPreviewDismissShortcut").ValueKind);
    }

    [Fact]
    public void DisplayDismissReservesItsOwnKeyAgainstWidgetDefaults()
    {
        var settings = System.Text.Json.JsonSerializer.Deserialize<DashboardSettings>(
            """{"DisplayPreviewShortcutsInitialized":true,"DisplayPreviewShortcut":"Ctrl+Alt+D","DisplayPreviewDismissShortcut":"Ctrl+Alt+Shift+1"}""")!;

        settings.ApplyWidgetShortcutDefaults([new CompactWidgetOption(7, "Timer")]);

        Assert.Equal("Ctrl+Alt+Shift+2", settings.WidgetShortcuts[7]);
        Assert.Equal("Ctrl+Alt+Shift+2", settings.WidgetDismissShortcuts[7]);
    }

    [Fact]
    public void DisplayDefaultsInitializeOnceWhileWidgetInventoryIsUnavailable()
    {
        var settings = new DashboardSettings();

        Assert.True(settings.ApplyWidgetShortcutDefaults(Array.Empty<CompactWidgetOption>()));
        Assert.False(settings.ApplyWidgetShortcutDefaults(Array.Empty<CompactWidgetOption>()));
        Assert.False(settings.WidgetShortcutsInitialized);
        Assert.Equal(DisplayShortcutLogic.DefaultShortcut, settings.DisplayPreviewShortcut);
        Assert.Equal(DisplayShortcutLogic.DefaultShortcut, settings.DisplayPreviewDismissShortcut);
    }

    [Fact]
    public void LegacyDefaultIsNotStolenFromAnotherWidgetsDismissAssignment()
    {
        var settings = new DashboardSettings
        {
            WidgetDismissShortcuts = new Dictionary<int, string?> { [7] = DisplayShortcutLogic.DefaultShortcut }
        };

        settings.ApplyWidgetShortcutDefaults(Array.Empty<CompactWidgetOption>());

        Assert.Null(settings.DisplayPreviewShortcut);
        Assert.Null(settings.DisplayPreviewDismissShortcut);
        Assert.True(settings.DisplayPreviewShortcutsInitialized);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void EquivalentWidgetAssignmentsReserveDisplayDefaultBeforeInventory(bool dismiss)
    {
        const string equivalent = " Shift + Alt + Ctrl + 0 ";
        var settings = new DashboardSettings
        {
            WidgetShortcuts = new Dictionary<int, string?> { [7] = dismiss ? "Ctrl+Alt+T" : equivalent },
            WidgetDismissShortcuts = new Dictionary<int, string?> { [7] = dismiss ? equivalent : "Ctrl+Alt+Y" }
        };

        settings.ApplyWidgetShortcutDefaults(Array.Empty<CompactWidgetOption>());

        Assert.Null(settings.DisplayPreviewShortcut);
        Assert.Null(settings.DisplayPreviewDismissShortcut);
        var reloaded = System.Text.Json.JsonSerializer.Deserialize<DashboardSettings>(
            System.Text.Json.JsonSerializer.Serialize(settings))!;
        reloaded.ApplyWidgetShortcutDefaults([new CompactWidgetOption(7, "Timer")]);
        Assert.Null(reloaded.DisplayPreviewShortcut);
        Assert.Null(reloaded.DisplayPreviewDismissShortcut);
        Assert.Equal(equivalent, dismiss ? reloaded.WidgetDismissShortcuts[7] : reloaded.WidgetShortcuts[7]);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void EquivalentDisplayAssignmentsReserveNumberedWidgetDefaults(bool dismiss)
    {
        const string equivalent = " shift + ALT + ctrl + 1 ";
        var settings = new DashboardSettings
        {
            DisplayPreviewShortcutsInitialized = true,
            DisplayPreviewShortcut = dismiss ? "Ctrl+Alt+S" : equivalent,
            DisplayPreviewDismissShortcut = dismiss ? equivalent : "Ctrl+Alt+D"
        };

        settings.ApplyWidgetShortcutDefaults([new CompactWidgetOption(7, "Timer")]);

        Assert.Equal("Ctrl+Alt+Shift+2", settings.WidgetShortcuts[7]);
        Assert.Equal("Ctrl+Alt+Shift+2", settings.WidgetDismissShortcuts[7]);
        var reloaded = System.Text.Json.JsonSerializer.Deserialize<DashboardSettings>(
            System.Text.Json.JsonSerializer.Serialize(settings))!;
        reloaded.ApplyWidgetShortcutDefaults([
            new CompactWidgetOption(40, "Randomiser"), new CompactWidgetOption(7, "Timer")
        ]);
        Assert.Equal("Ctrl+Alt+Shift+2", reloaded.WidgetShortcuts[7]);
        Assert.Equal("Ctrl+Alt+Shift+3", reloaded.WidgetShortcuts[40]);
        Assert.Equal("Ctrl+Alt+Shift+3", reloaded.WidgetDismissShortcuts[40]);
        Assert.Equal(equivalent, dismiss ? reloaded.DisplayPreviewDismissShortcut : reloaded.DisplayPreviewShortcut);
    }

    [Fact]
    public void EmptyInventoryDoesNotPreventLaterWidgetDefaults()
    {
        var settings = new DashboardSettings();

        settings.ApplyWidgetShortcutDefaults(Array.Empty<CompactWidgetOption>());

        Assert.Equal(DisplayShortcutLogic.DefaultShortcut, settings.DisplayPreviewShortcut);
        Assert.False(settings.WidgetShortcutsInitialized);

        var options = Enumerable.Range(1, 9)
            .Select(index => new CompactWidgetOption(index, $"Widget {index}"))
            .ToArray();
        settings.ApplyWidgetShortcutDefaults(options);

        Assert.Equal(9, settings.WidgetShortcuts.Count);
        for (var index = 1; index <= 9; index++)
        {
            Assert.Equal($"Ctrl+Alt+Shift+{index}", settings.WidgetShortcuts[index]);
        }
        Assert.DoesNotContain(DisplayShortcutLogic.DefaultShortcut, settings.WidgetShortcuts.Values);
        Assert.True(settings.WidgetShortcutsInitialized);
    }
}
