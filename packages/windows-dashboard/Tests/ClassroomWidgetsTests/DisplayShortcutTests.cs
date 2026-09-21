using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using ClassroomWidgets;
using Xunit;

// Global hotkeys, the interactive desktop and the settings directory are process-wide.
[assembly: CollectionBehavior(DisableTestParallelization = true)]

namespace ClassroomWidgetsTests;

public sealed class DisplayShortcutTests
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(5);

    [Fact]
    public void GlobalDisplayShortcutsToggleOrDispatchSeparateActionsWithoutWidgetHost()
    {
        WithSettings(settings =>
        {
            var host = new WidgetHostController(settings);
            using var preview = new DisplayPreviewCoordinator(settings, new DisplayCatalog());
            var actions = new List<WidgetShortcutAction>();
            using var shortcuts = new WidgetShortcutManager(settings, host, action =>
            {
                actions.Add(action);
                preview.PerformShortcut(action);
            });
            Assert.False(host.IsAvailable);
            Assert.Empty(host.WidgetOptions);
            AssertActive(shortcuts, WidgetShortcutAction.Show);
            AssertActive(shortcuts, WidgetShortcutAction.Dismiss);

            Press(0x30); // Ctrl+Alt+Shift+0: one registration for the matching pair.
            WpfTestHost.PumpUntil(() => actions.Count == 1, Timeout, "Display toggle to show");
            Assert.Equal(WidgetShortcutAction.Toggle, actions[0]);
            Assert.True(preview.IsOpen);
            Press(0x30);
            WpfTestHost.PumpUntil(() => actions.Count == 2, Timeout, "Display toggle to dismiss");
            Assert.Equal(WidgetShortcutAction.Toggle, actions[1]);
            Assert.Null(preview.Window);

            settings.DisplayPreviewShortcut = "Ctrl+Alt+Shift+F9";
            settings.DisplayPreviewDismissShortcut = "Ctrl+Alt+Shift+F10";
            settings.NotifyChanged();
            AssertActive(shortcuts, WidgetShortcutAction.Show);
            AssertActive(shortcuts, WidgetShortcutAction.Dismiss);
            Press(0x79); // F10: dismissing an absent preview must not create it.
            WpfTestHost.PumpUntil(() => actions.Count == 3, Timeout, "separate Display dismiss");
            Assert.Equal(WidgetShortcutAction.Dismiss, actions[2]);
            Assert.Null(preview.Window);
            Press(0x78);
            WpfTestHost.PumpUntil(() => actions.Count == 4, Timeout, "separate Display show");
            Assert.Equal(WidgetShortcutAction.Show, actions[3]);
            var window = preview.Window;
            Assert.NotNull(window);
            Press(0x78);
            WpfTestHost.PumpUntil(() => actions.Count == 5, Timeout, "repeated Display show");
            Assert.Same(window, preview.Window);

            shortcuts.Suspend();
            Press(0x79);
            WpfTestHost.PumpFor(TimeSpan.FromMilliseconds(250));
            Assert.Equal(5, actions.Count);
            Assert.Same(window, preview.Window);
            shortcuts.Resume();
            Press(0x79);
            WpfTestHost.PumpUntil(() => actions.Count == 6, Timeout, "Display dismiss after recording");
            Assert.Null(preview.Window);
            Assert.Null(preview.Capture);
        });
    }

    [Fact]
    public void BothDisplayKeysReserveAgainstWidgetsButMayShareWithEachOther()
    {
        WithSettings(settings =>
        {
            settings.DisplayPreviewShortcut = "Ctrl+Alt+Shift+F9";
            settings.DisplayPreviewDismissShortcut = "Ctrl+Alt+Shift+F10";
            settings.WidgetShortcuts[7] = "Ctrl+Alt+T";
            settings.WidgetDismissShortcuts[7] = "Ctrl+Alt+Y";
            var host = new WidgetHostController(settings);
            using var shortcuts = new WidgetShortcutManager(settings, host, _ => { });

            Assert.True(shortcuts.IsDuplicate(7, "Shift+Alt+Ctrl+F9"));
            Assert.True(shortcuts.IsDuplicate(7, "Ctrl+Alt+Shift+F10"));
            Assert.False(shortcuts.IsDuplicate(DisplayShortcutLogic.WidgetType, "Ctrl+Alt+Shift+F9"));
            Assert.False(shortcuts.IsDuplicate(DisplayShortcutLogic.WidgetType, "Ctrl+Alt+Shift+F10"));
            Assert.True(shortcuts.IsDuplicate(DisplayShortcutLogic.WidgetType, "Alt+Ctrl+T"));
            Assert.True(shortcuts.IsDuplicate(DisplayShortcutLogic.WidgetType, "Ctrl+Alt+Y"));

            // An actual competing registration must surface a conflict on both halves of a toggle.
            var other = new DashboardSettings { DisplayPreviewShortcut = "Ctrl+Alt+Shift+F9" };
            using var competing = new WidgetShortcutManager(other, host, _ => { });
            Assert.Equal(WidgetShortcutStatus.Conflict, competing.StatusFor(DisplayShortcutLogic.WidgetType, WidgetShortcutAction.Show).Status);
            Assert.Equal(WidgetShortcutStatus.Conflict, competing.StatusFor(DisplayShortcutLogic.WidgetType, WidgetShortcutAction.Dismiss).Status);
            Assert.Equal("Ctrl+Alt+Shift+F9", other.DisplayPreviewShortcut);
            AssertActive(shortcuts, WidgetShortcutAction.Show);
        });
    }

    [Fact]
    public void DisplaySettingsRenderPairedAccessibleControlsAndPersistClearAndReset()
    {
        WithSettings(settings =>
        {
            var host = new WidgetHostController(settings);
            using var shortcuts = new WidgetShortcutManager(settings, host, _ => { });
            var window = new SettingsWindow(settings, host, shortcuts);
            try
            {
                window.Show();
                WpfTestHost.PumpFor(TimeSpan.FromMilliseconds(300));
                var show = Find<TextBox>(window, "Show shortcut for Display");
                var dismiss = Find<TextBox>(window, "Dismiss shortcut for Display");
                show.BringIntoView();
                WpfTestHost.DoEvents();
                Assert.Equal(DisplayShortcutLogic.DefaultShortcut, show.Text);
                Assert.Equal(DisplayShortcutLogic.DefaultShortcut, dismiss.Text);
                Assert.True(show.IsReadOnly && dismiss.IsReadOnly);
                SaveWindow("display-shortcuts-default.png", window);

                Click(Find<Button>(window, "Clear show shortcut for Display"));
                Click(Find<Button>(window, "Clear dismiss shortcut for Display"));
                Assert.Equal("", show.Text);
                Assert.Equal("", dismiss.Text);
                Assert.Null(settings.DisplayPreviewShortcut);
                Assert.Null(settings.DisplayPreviewDismissShortcut);
                var saved = System.Text.Json.JsonSerializer.Deserialize<DashboardSettings>(
                    File.ReadAllText(Path.Combine(DashboardSettings.DataDirectory, "settings.json")))!;
                saved.ApplyWidgetShortcutDefaults(Array.Empty<CompactWidgetOption>());
                Assert.Null(saved.DisplayPreviewShortcut);
                Assert.Null(saved.DisplayPreviewDismissShortcut);
                SaveWindow("display-shortcuts-cleared.png", window);

                // Reset refuses another widget's assignment rather than silently stealing it.
                settings.WidgetDismissShortcuts[7] = DisplayShortcutLogic.DefaultShortcut;
                Click(Find<Button>(window, "Reset shortcuts for Display"));
                Assert.Null(settings.DisplayPreviewShortcut);
                Assert.Null(settings.DisplayPreviewDismissShortcut);
                Assert.Contains(Descendants<TextBlock>(window), text => text.Text.StartsWith("Conflict — already assigned", StringComparison.Ordinal));
                SaveWindow("display-shortcuts-conflict.png", window);
                settings.WidgetDismissShortcuts.Clear();
                Click(Find<Button>(window, "Reset shortcuts for Display"));
                Assert.Equal(DisplayShortcutLogic.DefaultShortcut, settings.DisplayPreviewShortcut);
                Assert.Equal(DisplayShortcutLogic.DefaultShortcut, settings.DisplayPreviewDismissShortcut);
                AssertActive(shortcuts, WidgetShortcutAction.Show);
                AssertActive(shortcuts, WidgetShortcutAction.Dismiss);
            }
            finally
            {
                window.Close();
            }
        });
    }

    private static void WithSettings(Action<DashboardSettings> body)
    {
        var previous = DashboardSettings.DataDirectory;
        var directory = Path.Combine(Path.GetTempPath(), "ClassroomWidgetsTests", Guid.NewGuid().ToString("N"));
        DashboardSettings.UseDataDirectory(directory);
        try { WpfTestHost.Run(() => body(new DashboardSettings())); }
        finally
        {
            DashboardSettings.UseDataDirectory(previous);
            if (Directory.Exists(directory)) Directory.Delete(directory, recursive: true);
        }
    }

    private static void AssertActive(WidgetShortcutManager shortcuts, WidgetShortcutAction action)
        => Assert.Equal(WidgetShortcutStatus.Active, shortcuts.StatusFor(DisplayShortcutLogic.WidgetType, action).Status);

    private static void Press(byte key)
    {
        byte[] keys = [0x11, 0x12, 0x10, key];
        try
        {
            foreach (var value in keys) keybd_event(value, 0, 0, 0);
        }
        finally
        {
            foreach (var value in keys.Reverse()) keybd_event(value, 0, 2, 0);
        }
        WpfTestHost.DoEvents();
    }

    private static void Click(Button button)
    {
        button.RaiseEvent(new RoutedEventArgs(ButtonBase.ClickEvent));
        WpfTestHost.DoEvents();
    }

    private static T Find<T>(DependencyObject root, string name) where T : DependencyObject
        => Assert.Single(Descendants<T>(root), control => AutomationProperties.GetName(control) == name);

    private static IEnumerable<T> Descendants<T>(DependencyObject root) where T : DependencyObject
    {
        for (var index = 0; index < VisualTreeHelper.GetChildrenCount(root); index++)
        {
            var child = VisualTreeHelper.GetChild(root, index);
            if (child is T match) yield return match;
            foreach (var descendant in Descendants<T>(child)) yield return descendant;
        }
    }

    private static void SaveWindow(string name, Window window)
    {
        window.UpdateLayout();
        var bitmap = new RenderTargetBitmap((int)window.ActualWidth * 2, (int)window.ActualHeight * 2, 192, 192, PixelFormats.Pbgra32);
        bitmap.Render(window);
        WpfTestHost.SaveEvidence(name, bitmap);
    }

    [DllImport("user32.dll")]
    private static extern void keybd_event(byte virtualKey, byte scanCode, uint flags, nuint extraInfo);
}
