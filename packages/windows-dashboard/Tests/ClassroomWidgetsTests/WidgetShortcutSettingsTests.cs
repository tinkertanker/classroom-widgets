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
    public void DisplayPreviewGetsTheZeroShortcutAndReservesIt()
    {
        var settings = new DashboardSettings();
        settings.ApplyWidgetShortcutDefaults([new CompactWidgetOption(40, "Display")]);
        Assert.Equal("Ctrl+Alt+Shift+0", settings.DisplayPreviewShortcut);
        Assert.DoesNotContain("Ctrl+Alt+Shift+0", settings.WidgetShortcuts.Values);
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

    [Fact]
    public void DisplayPreviewSettingsRoundTripThroughJson()
    {
        var settings = new DashboardSettings
        {
            DisplayPreviewFrame = new PanelFrame { Left = 1, Top = 2, Width = 480, Height = 402 },
            DisplayPreviewSourceId = @"\\.\DISPLAY2",
            DisplayPreviewShortcut = "Ctrl+Alt+Shift+0",
            DisplayPreviewDismissShortcut = "Ctrl+Alt+Shift+D",
            DisplayPreviewShortcutsInitialized = true
        };
        var options = new System.Text.Json.JsonSerializerOptions();
        var reloaded = System.Text.Json.JsonSerializer.Deserialize<DashboardSettings>(
            System.Text.Json.JsonSerializer.Serialize(settings, options), options);
        Assert.Equal(settings.DisplayPreviewFrame?.Width, reloaded?.DisplayPreviewFrame?.Width);
        Assert.Equal(settings.DisplayPreviewSourceId, reloaded?.DisplayPreviewSourceId);
        Assert.Equal(settings.DisplayPreviewShortcut, reloaded?.DisplayPreviewShortcut);
        Assert.Equal(settings.DisplayPreviewDismissShortcut, reloaded?.DisplayPreviewDismissShortcut);
        Assert.True(reloaded?.DisplayPreviewShortcutsInitialized);
    }

    [Fact]
    public void DisplayPreviewDuplicateDetectionMatchesWidgetAssignments()
    {
        Assert.True(DisplayShortcutLogic.IsDuplicate(
            DisplayShortcutLogic.DefaultShortcut,
            ["Ctrl+Alt+Shift+1", DisplayShortcutLogic.DefaultShortcut]));
        Assert.False(DisplayShortcutLogic.IsDuplicate(
            DisplayShortcutLogic.DefaultShortcut,
            ["Ctrl+Alt+Shift+1"]));
    }
}
