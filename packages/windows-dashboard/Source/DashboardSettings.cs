using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
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

    public static string DataDirectory { get; private set; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "ClassroomWidgets");

    private static string SettingsPath => Path.Combine(DataDirectory, "settings.json");

    internal static void UseDataDirectory(string directory) => DataDirectory = directory;

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
    public Dictionary<int, string?> WidgetDismissShortcuts { get; set; } = new();
    public Dictionary<int, string> WidgetShortcutDefaults { get; set; } = new();
    public PanelFrame? DisplayPreviewFrame { get; set; }
    public string? DisplayPreviewSourceId { get; set; }
    public string? DisplayPreviewShortcut { get; set; }
    public string? DisplayPreviewDismissShortcut { get; set; }
    // Null is an intentional unassignment once the legacy Show-only settings have migrated.
    public bool DisplayPreviewShortcutsInitialized { get; set; }

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
                    loaded.WidgetDismissShortcuts ??= new();
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
                && !HasBackgroundArgument(command))
            {
                key.SetValue(RunValueName, $"\"{Environment.ProcessPath}\" --background");
            }
        }
        catch (UnauthorizedAccessException error)
        {
            DashboardLog.Warn($"Unable to update launch-at-login command: {error.Message}");
        }
    }

    internal static bool HasBackgroundArgument(string command)
        => Regex.IsMatch(command, @"(?:^|\s)--background(?=\s|$)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

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
        var changed = ApplyWidgetShortcutDefaults(options);
        if (changed) NotifyChanged();
        return changed;
    }

    internal bool ApplyWidgetShortcutDefaults(IReadOnlyList<CompactWidgetOption> options)
    {
        var changed = options.Count > 0 && !WidgetShortcutsInitialized;
        var numberedDefaults = Enumerable.Range(1, 9).Select(index => $"Ctrl+Alt+Shift+{index}").ToArray();
        var reserved = new HashSet<string>(
            WidgetShortcuts.Values.Concat(WidgetDismissShortcuts.Values).OfType<string>()
                .Concat(new[] { DisplayPreviewShortcut, DisplayPreviewDismissShortcut }.OfType<string>()),
            StringComparer.OrdinalIgnoreCase);
        if (!DisplayPreviewShortcutsInitialized)
        {
            var displayDefault = DisplayShortcutLogic.DefaultShortcut;
            if (DisplayPreviewShortcut is null && !reserved.Contains(displayDefault))
            {
                DisplayPreviewShortcut = displayDefault;
                reserved.Add(displayDefault);
            }
            DisplayPreviewDismissShortcut ??= DisplayPreviewShortcut;
            DisplayPreviewShortcutsInitialized = true;
            changed = true;
        }
        if (options.Count == 0)
        {
            return changed;
        }
        var plannedDefaults = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var option in options.Take(9))
        {
            WidgetShortcutDefaults.TryGetValue(option.WidgetType, out var storedDefault);
            WidgetShortcuts.TryGetValue(option.WidgetType, out var existing);
            var existingNumberedDefault = numberedDefaults.FirstOrDefault(shortcut =>
                string.Equals(shortcut, storedDefault, StringComparison.OrdinalIgnoreCase)
                || string.Equals(shortcut, existing, StringComparison.OrdinalIgnoreCase));
            var shortcut = existingNumberedDefault
                ?? numberedDefaults.FirstOrDefault(candidate => !reserved.Contains(candidate) && !plannedDefaults.Contains(candidate));
            if (shortcut is null) continue;
            plannedDefaults.Add(shortcut);
            if (!WidgetShortcuts.ContainsKey(option.WidgetType))
            {
                WidgetShortcuts[option.WidgetType] = shortcut;
                reserved.Add(shortcut);
                changed = true;
            }
            WidgetShortcutDefaults[option.WidgetType] = shortcut;
        }
        foreach (var option in options)
        {
            if (!WidgetDismissShortcuts.ContainsKey(option.WidgetType) && WidgetShortcuts.TryGetValue(option.WidgetType, out var shortcut))
            {
                WidgetDismissShortcuts[option.WidgetType] = shortcut;
                changed = true;
            }
        }
        WidgetShortcutsInitialized = true;
        return changed;
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
