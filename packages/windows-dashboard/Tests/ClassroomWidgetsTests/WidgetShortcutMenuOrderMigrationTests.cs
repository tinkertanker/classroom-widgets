using System.Text.Json;
using ClassroomWidgets;
using Xunit;

namespace ClassroomWidgetsTests;

/// <summary>
/// One-time move of untouched default widget shortcuts from the legacy
/// registry order to the native menu order.
///
/// Ways this can fail:
/// 1. Untouched legacy defaults are never moved, so Ctrl+Alt+Shift+1 still
///    opens Randomiser although the menu now lists Timer first.
/// 2. The move is partial: show moves but dismiss stays on the old digit (a
///    show/dismiss mismatch stops the pair from toggling), or the stored
///    per-widget defaults keep the old digits so the allocator re-claims them
///    and Settings' Reset restores the legacy digit.
/// 3. A customised show or dismiss binding is overwritten, or the other
///    bindings are renumbered around it.
/// 4. A cleared (unassigned) binding is treated as a default and reassigned.
/// 5. A missing or extra widget binding is treated as the legacy map.
/// 6. Display or Move to Previous/Next Display shortcuts are changed.
/// 7. The migration runs on the empty inventory sent while the web app is
///    still loading and spends its one chance before any widgets are known.
/// 8. The migration runs again later: after a customised install is set back
///    to the legacy digits by hand, or after the flag fails to persist.
/// 9. The change is not reported, so it is never saved and the registered
///    hotkeys and Settings keep showing the legacy bindings.
/// 10. A fresh install does not get menu-order defaults or does not record
///    that it is already on the new numbering.
/// </summary>
public sealed class WidgetShortcutMenuOrderMigrationTests
{
    // Randomiser, Timer, List, Task Cue, Traffic Light, Link Shortener, Text Banner, QR Code, Sound Effects.
    private static readonly int[] LegacyOrder = { 0, 1, 2, 3, 4, 6, 7, 12, 9 };

    // Timer, Text Banner | Traffic Light, Task Cue | Randomiser, List | Link Shortener, QR Code, Sound Effects.
    private static readonly int[] MenuOrder = { 1, 7, 4, 3, 0, 2, 6, 12, 9 };

    // A settings file written by the previous release after its first inventory.
    private const string LegacySettingsJson = """
        {
          "WidgetShortcutsInitialized": true,
          "WidgetShortcuts": {"0":"Ctrl+Alt+Shift+1","1":"Ctrl+Alt+Shift+2","2":"Ctrl+Alt+Shift+3","3":"Ctrl+Alt+Shift+4","4":"Ctrl+Alt+Shift+5","6":"Ctrl+Alt+Shift+6","7":"Ctrl+Alt+Shift+7","12":"Ctrl+Alt+Shift+8","9":"Ctrl+Alt+Shift+9"},
          "WidgetDismissShortcuts": {"0":"Ctrl+Alt+Shift+1","1":"Ctrl+Alt+Shift+2","2":"Ctrl+Alt+Shift+3","3":"Ctrl+Alt+Shift+4","4":"Ctrl+Alt+Shift+5","6":"Ctrl+Alt+Shift+6","7":"Ctrl+Alt+Shift+7","12":"Ctrl+Alt+Shift+8","9":"Ctrl+Alt+Shift+9"},
          "WidgetShortcutDefaults": {"0":"Ctrl+Alt+Shift+1","1":"Ctrl+Alt+Shift+2","2":"Ctrl+Alt+Shift+3","3":"Ctrl+Alt+Shift+4","4":"Ctrl+Alt+Shift+5","6":"Ctrl+Alt+Shift+6","7":"Ctrl+Alt+Shift+7","12":"Ctrl+Alt+Shift+8","9":"Ctrl+Alt+Shift+9"},
          "DisplayPreviewShortcutsInitialized": true,
          "DisplayPreviewShortcut": "Ctrl+Alt+Shift+0",
          "DisplayPreviewDismissShortcut": "Ctrl+Alt+Shift+0",
          "MoveWidgetShortcutsInitialized": true,
          "MoveWidgetPreviousShortcut": "Ctrl+Alt+Shift+Left",
          "MoveWidgetNextShortcut": "Ctrl+Alt+Shift+Right"
        }
        """;

    private static DashboardSettings LegacyInstall() => DashboardSettings.DeserializeSettings(LegacySettingsJson)!;

    private static CompactWidgetOption[] MenuOptions() =>
        MenuOrder.Select(widgetType => new CompactWidgetOption(widgetType, $"Widget {widgetType}")).ToArray();

    private static DashboardSettings Reload(DashboardSettings settings) =>
        DashboardSettings.DeserializeSettings(JsonSerializer.Serialize(settings))!;

    private static void AssertNumbered(DashboardSettings settings, int[] order)
    {
        for (var index = 0; index < order.Length; index++)
        {
            var expected = $"Ctrl+Alt+Shift+{index + 1}";
            Assert.Equal(expected, settings.WidgetShortcuts[order[index]]);
            Assert.Equal(expected, settings.WidgetDismissShortcuts[order[index]]);
        }
    }

    [Fact]
    public void UntouchedLegacyDefaultsMoveToMenuOrderAndReport()
    {
        var settings = LegacyInstall();

        Assert.True(settings.ApplyWidgetShortcutDefaults(MenuOptions()));

        AssertNumbered(settings, MenuOrder);
        for (var index = 0; index < MenuOrder.Length; index++)
        {
            Assert.Equal($"Ctrl+Alt+Shift+{index + 1}", settings.WidgetShortcutDefaults[MenuOrder[index]]);
        }
        Assert.Equal(MenuOrder.Length, settings.WidgetShortcuts.Count);
        Assert.Equal(MenuOrder.Length, settings.WidgetDismissShortcuts.Count);
    }

    [Fact]
    public void MigrationLeavesDisplayAndMoveShortcutsAlone()
    {
        var settings = LegacyInstall();
        settings.DisplayPreviewShortcut = "Ctrl+Alt+D";
        settings.DisplayPreviewDismissShortcut = "Ctrl+Alt+E";
        settings.MoveWidgetPreviousShortcut = null;
        settings.MoveWidgetNextShortcut = "Ctrl+Alt+N";

        settings.ApplyWidgetShortcutDefaults(MenuOptions());

        AssertNumbered(settings, MenuOrder);
        Assert.Equal("Ctrl+Alt+D", settings.DisplayPreviewShortcut);
        Assert.Equal("Ctrl+Alt+E", settings.DisplayPreviewDismissShortcut);
        Assert.Null(settings.MoveWidgetPreviousShortcut);
        Assert.Equal("Ctrl+Alt+N", settings.MoveWidgetNextShortcut);
    }

    [Theory]
    [InlineData(true, "Ctrl+Alt+T")]
    [InlineData(false, "Ctrl+Alt+T")]
    [InlineData(true, null)]
    [InlineData(false, null)]
    public void AnyCustomisedOrClearedWidgetBindingLeavesEveryBindingUntouched(bool show, string? replacement)
    {
        var settings = LegacyInstall();
        var bindings = show ? settings.WidgetShortcuts : settings.WidgetDismissShortcuts;
        bindings[1] = replacement;

        settings.ApplyWidgetShortcutDefaults(MenuOptions());

        Assert.Equal(replacement, bindings[1]);
        var other = show ? settings.WidgetDismissShortcuts : settings.WidgetShortcuts;
        Assert.Equal("Ctrl+Alt+Shift+2", other[1]);
        for (var index = 0; index < LegacyOrder.Length; index++)
        {
            if (LegacyOrder[index] == 1) continue;
            Assert.Equal($"Ctrl+Alt+Shift+{index + 1}", settings.WidgetShortcuts[LegacyOrder[index]]);
            Assert.Equal($"Ctrl+Alt+Shift+{index + 1}", settings.WidgetDismissShortcuts[LegacyOrder[index]]);
        }
    }

    [Fact]
    public void MissingWidgetBindingLeavesTheOthersOnLegacyDigits()
    {
        var settings = LegacyInstall();
        settings.WidgetShortcuts.Remove(0);
        settings.WidgetDismissShortcuts.Remove(0);
        settings.WidgetShortcutDefaults.Remove(0);

        settings.ApplyWidgetShortcutDefaults(MenuOptions());

        for (var index = 1; index < LegacyOrder.Length; index++)
        {
            Assert.Equal($"Ctrl+Alt+Shift+{index + 1}", settings.WidgetShortcuts[LegacyOrder[index]]);
            Assert.Equal($"Ctrl+Alt+Shift+{index + 1}", settings.WidgetDismissShortcuts[LegacyOrder[index]]);
        }
    }

    [Fact]
    public void ExtraWidgetBindingLeavesEveryBindingUntouched()
    {
        var settings = LegacyInstall();
        settings.WidgetShortcuts[40] = "Ctrl+Alt+R";
        settings.WidgetDismissShortcuts[40] = "Ctrl+Alt+R";

        settings.ApplyWidgetShortcutDefaults(MenuOptions());

        AssertNumbered(settings, LegacyOrder);
        Assert.Equal("Ctrl+Alt+R", settings.WidgetShortcuts[40]);
    }

    [Fact]
    public void EmptyInventoryDoesNotSpendTheMigration()
    {
        var settings = LegacyInstall();

        settings.ApplyWidgetShortcutDefaults(Array.Empty<CompactWidgetOption>());
        AssertNumbered(settings, LegacyOrder);

        settings = Reload(settings);
        settings.ApplyWidgetShortcutDefaults(MenuOptions());
        AssertNumbered(settings, MenuOrder);
    }

    [Fact]
    public void CustomisedInstallNeverMigratesAfterLaterMatchingTheLegacyMap()
    {
        var settings = LegacyInstall();
        settings.WidgetShortcuts[1] = "Ctrl+Alt+T";
        Assert.True(settings.ApplyWidgetShortcutDefaults(MenuOptions()));

        settings = Reload(settings);
        settings.WidgetShortcuts[1] = "Ctrl+Alt+Shift+2";
        settings.ApplyWidgetShortcutDefaults(MenuOptions());

        AssertNumbered(settings, LegacyOrder);
    }

    [Fact]
    public void MigratedInstallIsStableAcrossReloads()
    {
        var settings = LegacyInstall();
        settings.ApplyWidgetShortcutDefaults(MenuOptions());

        settings = Reload(settings);

        Assert.False(settings.ApplyWidgetShortcutDefaults(MenuOptions()));
        AssertNumbered(settings, MenuOrder);
    }

    [Fact]
    public void FreshInstallGetsMenuOrderDefaultsAndIsNeverMigratedLater()
    {
        var settings = new DashboardSettings();
        settings.ApplyWidgetShortcutDefaults(Array.Empty<CompactWidgetOption>());

        Assert.True(settings.ApplyWidgetShortcutDefaults(MenuOptions()));
        AssertNumbered(settings, MenuOrder);

        // Hand-assigning the legacy digits afterwards is a customisation, not a legacy install.
        settings = Reload(settings);
        for (var index = 0; index < LegacyOrder.Length; index++)
        {
            settings.WidgetShortcuts[LegacyOrder[index]] = $"Ctrl+Alt+Shift+{index + 1}";
            settings.WidgetDismissShortcuts[LegacyOrder[index]] = $"Ctrl+Alt+Shift+{index + 1}";
        }
        settings.ApplyWidgetShortcutDefaults(MenuOptions());
        AssertNumbered(settings, LegacyOrder);
    }
}
