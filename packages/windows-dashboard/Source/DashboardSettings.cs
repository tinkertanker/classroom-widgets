using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Win32;

namespace ClassroomWidgets;

public sealed class PanelFrame
{
    public double Left { get; set; }
    public double Top { get; set; }
    public double Width { get; set; }
    public double Height { get; set; }
}

/// <summary>
/// User preferences persisted as JSON under %LOCALAPPDATA%\ClassroomWidgets.
/// Panel frames are keyed by widget ID so widgets reopen where they were left.
/// </summary>
public sealed class DashboardSettings
{
    private const string RunKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string RunValueName = "ClassroomWidgets";

    public static string DataDirectory { get; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "ClassroomWidgets");

    private static readonly string SettingsPath = Path.Combine(DataDirectory, "settings.json");
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public double BackgroundOpacity { get; set; } = 1.0;
    public bool AlwaysOnTop { get; set; } = true;
    public Dictionary<string, PanelFrame> PanelFrames { get; set; } = new();
    public bool WidgetShortcutsInitialized { get; set; }
    public Dictionary<int, string?> WidgetShortcuts { get; set; } = new();
    public Dictionary<int, string> WidgetShortcutDefaults { get; set; } = new();

    /// <summary>Shortening service used by Link Shortener and QR Code widgets.</summary>
    public string LinkShortenerProvider { get; set; } = DashboardShortenerSettings.DefaultProvider;

    /// <summary>Short.io public API key (pk_…). Never a secret API key.</summary>
    public string LinkShortenerPublicApiKey { get; set; } = "";

    /// <summary>Short.io branded domain (e.g. go.myschool.edu).</summary>
    public string LinkShortenerDomain { get; set; } = "";

    public event Action? Changed;

    public static DashboardSettings Load()
    {
        var settings = new DashboardSettings();
        try
        {
            if (File.Exists(SettingsPath))
            {
                var loaded = JsonSerializer.Deserialize<DashboardSettings>(File.ReadAllText(SettingsPath), JsonOptions);
                if (loaded is not null)
                {
                    loaded.BackgroundOpacity = Math.Clamp(loaded.BackgroundOpacity, 0, 1);
                    loaded.WidgetShortcuts ??= new();
                    loaded.WidgetShortcutDefaults ??= new();
                    settings = loaded;
                }
            }
        }
        catch (Exception error) when (error is IOException or JsonException or UnauthorizedAccessException)
        {
            DashboardLog.Warn($"Unable to read settings: {error.Message}");
        }
        MigrateLaunchAtLoginCommand();
        return settings;
    }

    private static void MigrateLaunchAtLoginCommand()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RunKeyPath, writable: true);
            if (key?.GetValue(RunValueName) is string command
                && !command.Contains("--background", StringComparison.OrdinalIgnoreCase))
            {
                key.SetValue(RunValueName, $"\"{Environment.ProcessPath}\" --background");
            }
        }
        catch (UnauthorizedAccessException error)
        {
            DashboardLog.Warn($"Unable to update launch-at-login command: {error.Message}");
        }
    }

    public void Save()
    {
        try
        {
            Directory.CreateDirectory(DataDirectory);
            File.WriteAllText(SettingsPath, JsonSerializer.Serialize(this, JsonOptions));
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            DashboardLog.Warn($"Unable to write settings: {error.Message}");
        }
    }

    public void NotifyChanged()
    {
        Save();
        Changed?.Invoke();
    }

    public bool InitializeWidgetShortcuts(IReadOnlyList<CompactWidgetOption> options)
    {
        if (WidgetShortcutsInitialized || options.Count == 0) return false;

        WidgetShortcutsInitialized = true;
        foreach (var (option, index) in options.Take(9).Select((option, index) => (option, index)))
        {
            var shortcut = $"Ctrl+Alt+Shift+{index + 1}";
            WidgetShortcuts[option.WidgetType] = shortcut;
            WidgetShortcutDefaults[option.WidgetType] = shortcut;
        }
        NotifyChanged();
        return true;
    }

    public static bool LaunchAtLoginEnabled
    {
        get
        {
            using var key = Registry.CurrentUser.OpenSubKey(RunKeyPath, writable: false);
            return key?.GetValue(RunValueName) is string;
        }
        set
        {
            using var key = Registry.CurrentUser.CreateSubKey(RunKeyPath, writable: true);
            if (key is null) return;
            if (value)
            {
                key.SetValue(RunValueName, $"\"{Environment.ProcessPath}\" --background");
            }
            else
            {
                key.DeleteValue(RunValueName, throwOnMissingValue: false);
            }
        }
    }
}
