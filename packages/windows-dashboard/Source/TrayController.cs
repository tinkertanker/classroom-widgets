using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using Microsoft.Win32;

namespace ClassroomWidgets;

/// <summary>
/// The system tray icon and its context menu: the only always-available UI,
/// mirroring the macOS menu bar item.
/// </summary>
public sealed class TrayController : IDisposable
{
    private readonly WidgetHostController _host;
    private readonly DashboardSettings _settings;
    private readonly WidgetShortcutManager _shortcuts;
    private readonly UpdateController _updates;
    private readonly Action _openLauncher;
    private readonly Action _openDisplayPreview;
    private readonly NotifyIcon _icon;
    private readonly ContextMenuStrip _menu = new();
    private readonly List<ToolStripItem> _fixedItems = new();
    private readonly ToolStripMenuItem _arrangeMenu = new("Arrange Widgets");
    private readonly ToolStripMenuItem _launchAtLogin = new("Launch at Login") { CheckOnClick = true };
    private SettingsWindow? _settingsWindow;

    public TrayController(WidgetHostController host, DashboardSettings settings, WidgetShortcutManager shortcuts, UpdateController updates, Action openLauncher, Action openDisplayPreview)
    {
        _host = host;
        _settings = settings;
        _shortcuts = shortcuts;
        _updates = updates;
        _openLauncher = openLauncher;
        _openDisplayPreview = openDisplayPreview;

        _icon = new NotifyIcon
        {
            Icon = LoadIcon(),
            Text = "Classroom Widgets",
            Visible = true,
            ContextMenuStrip = _menu
        };
        _icon.MouseClick += (_, args) =>
        {
            if (args.Button == MouseButtons.Left) ShowMenu();
        };

        SystemEvents.UserPreferenceChanged += UserPreferenceChanged;

        BuildMenu();
        _host.WidgetOptionsChanged += RebuildMenu;
        _menu.Opening += (_, _) =>
        {
            // Rebuilt on every open so shortcut changes made in Settings show up.
            RebuildMenu();
            RebuildArrangeMenu();
            _launchAtLogin.Checked = DashboardSettings.LaunchAtLoginEnabled;
        };
    }

    private void BuildMenu()
    {
        RebuildArrangeMenu();

        var openLauncher = new ToolStripMenuItem("Open Widget Launcher");
        openLauncher.Click += (_, _) => _openLauncher();

        var reload = new ToolStripMenuItem("Reload Widgets");
        reload.Click += (_, _) => _ = _host.ReloadWidgetsAsync();

        var settingsItem = new ToolStripMenuItem("Settings…");
        settingsItem.Click += (_, _) => OpenSettings();

        _launchAtLogin.Click += (_, _) =>
        {
            try
            {
                DashboardSettings.LaunchAtLoginEnabled = _launchAtLogin.Checked;
            }
            catch (Exception error) when (error is System.Security.SecurityException or UnauthorizedAccessException or IOException)
            {
                DashboardLog.Warn($"Unable to update launch at login: {error.Message}");
                _launchAtLogin.Checked = DashboardSettings.LaunchAtLoginEnabled;
            }
        };

        var about = new ToolStripMenuItem($"About Classroom Widgets (v{App.AppVersion})");
        about.Click += (_, _) => OpenUrl("https://github.com/tinkertanker/classroom-widgets");

        var openWeb = new ToolStripMenuItem("Open Full Web App");
        openWeb.Click += (_, _) => OpenUrl("https://widgets.tk.sg");

        var checkForUpdates = new ToolStripMenuItem("Check for Updates…");
        checkForUpdates.Click += (_, _) => _ = _updates.CheckAsync(manual: true);

        var quit = new ToolStripMenuItem("Quit Classroom Widgets");
        quit.Click += (_, _) => _ = ((App)System.Windows.Application.Current).RequestQuitAsync();

        _fixedItems.AddRange(new ToolStripItem[]
        {
            new ToolStripSeparator(),
            _arrangeMenu,
            openLauncher,
            new ToolStripSeparator(),
            settingsItem,
            _launchAtLogin,
            new ToolStripSeparator(),
            checkForUpdates,
            reload,
            about,
            openWeb,
            new ToolStripSeparator(),
            quit
        });
        RebuildMenu();
    }

    /// <summary>
    /// Lists Display and the widgets in the teacher app's menu order, one level
    /// deep with a separator between groups, followed by the fixed items. Each
    /// widget shows its global show shortcut as a hint; the hotkeys themselves
    /// are registered by <see cref="WidgetShortcutManager"/>.
    /// </summary>
    private void RebuildMenu()
    {
        var widgetItems = new List<ToolStripItem>();
        var display = new ToolStripMenuItem(CompactWidgetMenu.DisplayLabel)
        {
            ShortcutKeyDisplayString = ShowShortcutHint(DisplayShortcutLogic.WidgetType, _settings.DisplayPreviewShortcut)
        };
        display.Click += (_, _) => _openDisplayPreview();
        widgetItems.Add(display);

        var options = _host.WidgetOptions;
        if (options.Count == 0)
        {
            widgetItems.Add(new ToolStripMenuItem("Loading widgets…") { Enabled = false });
        }
        foreach (var (option, separatorBefore) in CompactWidgetMenu.Entries(options))
        {
            if (separatorBefore) widgetItems.Add(new ToolStripSeparator());
            var item = new ToolStripMenuItem(CompactWidgetMenu.Label(option))
            {
                Tag = option.WidgetType,
                ShortcutKeyDisplayString = ShowShortcutHint(option.WidgetType, _settings.WidgetShortcuts.GetValueOrDefault(option.WidgetType))
            };
            item.Click += (_, _) => _ = _host.AddWidgetAsync(option.WidgetType);
            widgetItems.Add(item);
        }

        _menu.SuspendLayout();
        var previous = _menu.Items.Cast<ToolStripItem>().Where(item => !_fixedItems.Contains(item)).ToList();
        _menu.Items.Clear();
        foreach (var item in previous) item.Dispose();
        _menu.Items.AddRange(widgetItems.ToArray());
        _menu.Items.AddRange(_fixedItems.ToArray());
        _menu.ResumeLayout();
    }

    /// <summary>
    /// The assigned show shortcut as menu hint text, or null when it is
    /// unassigned or Windows could not register it.
    /// </summary>
    private string? ShowShortcutHint(int widgetType, string? shortcut)
    {
        if (!WidgetShortcutGesture.TryParse(shortcut, out var gesture)) return null;
        return _shortcuts.StatusFor(widgetType, WidgetShortcutAction.Show).Status == WidgetShortcutStatus.Conflict
            ? null
            : gesture.Display;
    }

    private void RebuildArrangeMenu()
    {
        _arrangeMenu.DropDownItems.Clear();
        var current = _host.Coordinator.Layout;
        foreach (var (label, layout) in new[]
        {
            ("Free Placement", WidgetPanelLayout.Freeform),
            ("Arrange in a Row", WidgetPanelLayout.Row),
            ("Arrange in a Column", WidgetPanelLayout.Column)
        })
        {
            var item = new ToolStripMenuItem(label) { Checked = layout == current };
            item.Click += (_, _) => _host.Coordinator.Arrange(layout);
            _arrangeMenu.DropDownItems.Add(item);
        }
        _arrangeMenu.Enabled = _host.Coordinator.PanelCount > 0;
    }

    private void ShowMenu()
    {
        // NotifyIcon only opens the menu on right-click by itself; mirror it for left-click.
        typeof(NotifyIcon).GetMethod("ShowContextMenu", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)
            ?.Invoke(_icon, null);
    }

    /// <summary>
    /// Shows the settings window (single instance), also opened when a widget
    /// panel asks for its link-shortener settings gear.
    /// </summary>
    public void OpenSettings()
    {
        if (_settingsWindow is { IsLoaded: true })
        {
            _settingsWindow.Activate();
            return;
        }
        _settingsWindow = new SettingsWindow(_settings, _host, _shortcuts);
        _settingsWindow.Closed += (_, _) => _settingsWindow = null;
        _settingsWindow.Show();
        _settingsWindow.Activate();
    }

    private static void OpenUrl(string url)
    {
        try
        {
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
        }
        catch (Exception error) when (error is System.ComponentModel.Win32Exception or InvalidOperationException)
        {
            DashboardLog.Warn($"Unable to open {url}: {error.Message}");
        }
    }

    /// <summary>
    /// The tray glyph in the taskbar's colour: black on a light taskbar, white on a dark one.
    /// </summary>
    private static Icon LoadIcon()
    {
        var name = TaskbarUsesLightTheme() ? "TrayIcon-Black.ico" : "TrayIcon-White.ico";
        var resource = System.Windows.Application.GetResourceStream(new Uri($"pack://application:,,,/Assets/{name}"));
        if (resource is not null)
        {
            using var stream = resource.Stream;
            return new Icon(stream, SystemInformation.SmallIconSize);
        }
        return SystemIcons.Application;
    }

    private static bool TaskbarUsesLightTheme()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize");
            return key?.GetValue("SystemUsesLightTheme") is int value && value != 0;
        }
        catch (Exception error) when (error is System.Security.SecurityException or UnauthorizedAccessException or IOException)
        {
            return false;
        }
    }

    private void UserPreferenceChanged(object? sender, UserPreferenceChangedEventArgs args)
    {
        if (args.Category != UserPreferenceCategory.General) return;
        System.Windows.Application.Current?.Dispatcher.BeginInvoke(new Action(() =>
        {
            var previous = _icon.Icon;
            _icon.Icon = LoadIcon();
            previous?.Dispose();
        }));
    }

    public void Dispose()
    {
        SystemEvents.UserPreferenceChanged -= UserPreferenceChanged;
        _icon.Visible = false;
        _icon.Dispose();
        _menu.Dispose();
    }
}
