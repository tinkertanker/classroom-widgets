using System.Diagnostics;
using System.IO;
using System.Text;
using System.Windows.Automation.Peers;
using System.Windows.Automation.Provider;
using System.Windows.Controls;
using ClassroomWidgets;
using Xunit;

namespace ClassroomWidgetsTests;

// How settings.json persistence can fail (#214), and the test for each:
// 1. The app is killed while saving and the file is left truncated, so the next launch
//    silently falls back to defaults: KillingTheAppWhileItSavesNeverLeavesAnUnreadableFile.
// 2. An unreadable file is overwritten by the next save, losing shortcuts, frames and the
//    Short.io key with no trace: UnreadableSettingsAreMovedAsideAndKept.
// 3. Every keystroke in a Short.io field rewrites the file, re-runs the panel scripts and
//    re-registers every global hotkey: TypingShortioFieldsSavesAndAppliesOnceAfterAPause.
// 4. Debouncing loses the last edit when Settings closes before the pause:
//    ClosingSettingsBeforeThePauseStillSavesAndAppliesTheEdit. (Quitting already calls Save.)
public sealed class SettingsPersistenceTests
{
    private const string ChildMode = "settings-save-loop";
    private const int PanelFrameCount = 3000;

    [Fact]
    public async Task KillingTheAppWhileItSavesNeverLeavesAnUnreadableFile()
    {
        var directory = NewDirectory();
        var log = new StringBuilder();
        var random = new Random(214);
        try
        {
            for (var run = 1; run <= 40; run++)
            {
                using var child = new Process
                {
                    StartInfo = new ProcessStartInfo(Path.ChangeExtension(typeof(SettingsPersistenceTests).Assembly.Location, ".exe"))
                    {
                        UseShellExecute = false,
                        RedirectStandardInput = true,
                        RedirectStandardOutput = true
                    }
                };
                child.StartInfo.ArgumentList.Add(ChildMode);
                child.StartInfo.ArgumentList.Add(directory);
                child.Start();
                var delay = random.Next(5, 60);
                try
                {
                    var ready = await child.StandardOutput.ReadLineAsync().WaitAsync(TimeSpan.FromSeconds(30));
                    Assert.True(ready == "saving", $"run {run}: the child did not start saving");
                    Thread.Sleep(delay);
                }
                finally
                {
                    if (!child.HasExited) child.Kill(entireProcessTree: true);
                    child.WaitForExit(10_000);
                }
                Assert.True(child.HasExited, $"run {run}: the child did not exit after being killed");

                var path = Path.Combine(directory, "settings.json");
                var length = new FileInfo(path).Length;
                var saved = DashboardSettings.DeserializeSettings(File.ReadAllText(path));
                log.AppendLine($"run {run}: killed after {delay} ms, settings.json {length} bytes, domain={saved?.LinkShortenerDomain}, frames={saved?.PanelFrames.Count}");
                Assert.NotNull(saved);
                Assert.Equal(PanelFrameCount, saved.PanelFrames.Count);
                Assert.StartsWith("run-", saved.LinkShortenerDomain);
            }
        }
        finally
        {
            SaveEvidence("214-kill-while-saving.txt", log.ToString());
            if (Directory.Exists(directory)) Directory.Delete(directory, recursive: true);
        }
    }

    /// <summary>Child process for the kill test: saves a large settings file in a loop until killed.</summary>
    internal static int RunSaveLoop(string directory)
    {
        // Stop if the test process goes away without killing this one.
        new Thread(() =>
        {
            Console.In.ReadToEnd();
            Environment.Exit(3);
        }) { IsBackground = true }.Start();
        DashboardSettings.UseDataDirectory(directory);
        var settings = new DashboardSettings();
        for (var index = 0; index < PanelFrameCount; index++)
        {
            settings.PanelFrames[$"widget-{index:D4}-{Guid.NewGuid():N}"] = new PanelFrame { Left = index, Top = index * 2, Width = 320.5, Height = 240.25 };
        }
        settings.LinkShortenerDomain = "run-0";
        settings.Save();
        Console.WriteLine("saving");
        for (var save = 1; ; save++)
        {
            settings.LinkShortenerDomain = $"run-{save}";
            settings.Save();
        }
    }

    internal static bool IsChildProcess(string[] args) => args.Length == 2 && args[0] == ChildMode;

    [Fact]
    public void UnreadableSettingsAreMovedAsideAndKept()
    {
        WithDirectory(directory =>
        {
            var path = Path.Combine(directory, "settings.json");
            File.WriteAllText(path, """{"LinkShortenerDomain":"go.school.edu","PanelFrames":{"timer":{"Left":1""");
            var truncated = File.ReadAllBytes(path);

            var loaded = DashboardSettings.ReadSettings();

            Assert.Equal("", loaded.LinkShortenerDomain);
            var aside = Assert.Single(Directory.GetFiles(directory, "settings.corrupt-*.json"));
            Assert.Equal(truncated, File.ReadAllBytes(aside));

            loaded.LinkShortenerDomain = "go.new.edu";
            loaded.Save();
            Assert.Equal(truncated, File.ReadAllBytes(aside));
            Assert.Equal("go.new.edu", DashboardSettings.DeserializeSettings(File.ReadAllText(path))!.LinkShortenerDomain);

            // A second bad file in the same second must not replace the first copy.
            File.WriteAllText(path, "null");
            DashboardSettings.ReadSettings();
            Assert.Equal(2, Directory.GetFiles(directory, "settings.corrupt-*.json").Length);
            Assert.Equal(truncated, File.ReadAllBytes(aside));
            Assert.Empty(Directory.GetFiles(directory, "*.tmp"));
            SaveEvidence("214-corrupt-aside.txt", string.Join(Environment.NewLine, Directory.GetFiles(directory).Select(Path.GetFileName)));
        });
    }

    [Fact]
    public void TypingShortioFieldsSavesAndAppliesOnceAfterAPause()
    {
        WithDirectory(_ => WpfTestHost.Run(() =>
        {
            var settings = WithoutShortcuts();
            var host = new WidgetHostController(settings);
            using var shortcuts = new WidgetShortcutManager(settings, host, _ => { });
            var window = new SettingsWindow(settings, host, shortcuts);
            try
            {
                window.Show();
                WpfTestHost.DoEvents();
                SelectShortio(window);
                var path = Path.Combine(DashboardSettings.DataDirectory, "settings.json");
                var before = File.ReadAllBytes(path);
                var changes = 0;
                var registrations = 0;
                settings.Changed += () => changes++;
                shortcuts.StatusChanged += () => registrations++;

                // One value change per keystroke, pumping the dispatcher between them as real typing does.
                const string domain = "go.myschool.edu";
                const string key = "pk_live_abcdefghijklmnop";
                Type(new TextBoxAutomationPeer(window.DomainBox), domain, pause: true);
                Type(new PasswordBoxAutomationPeer(window.ApiKeyBox), key, pause: true);

                Assert.Equal(domain, settings.LinkShortenerDomain);
                Assert.Equal(key, settings.LinkShortenerPublicApiKey);
                Assert.Equal(0, changes);
                Assert.Equal(before, File.ReadAllBytes(path));

                WpfTestHost.PumpUntil(() => changes > 0, TimeSpan.FromSeconds(5), "the settings commit after typing pauses");
                WpfTestHost.PumpFor(TimeSpan.FromMilliseconds(500));
                var saved = DashboardSettings.DeserializeSettings(File.ReadAllText(path))!;
                SaveEvidence("214-typing.txt",
                    $"keystrokes={domain.Length + key.Length}, saves and applies={changes}, hotkey re-registrations={registrations}, saved domain={saved.LinkShortenerDomain}");
                Assert.Equal(1, changes);
                Assert.Equal(0, registrations);
                Assert.Equal(domain, saved.LinkShortenerDomain);
                Assert.Equal(key, saved.LinkShortenerPublicApiKey);
            }
            finally
            {
                window.Close();
            }
        }));
    }

    [Fact]
    public void ClosingSettingsBeforeThePauseStillSavesAndAppliesTheEdit()
    {
        WithDirectory(_ => WpfTestHost.Run(() =>
        {
            var settings = new DashboardSettings();
            var host = new WidgetHostController(settings);
            using var shortcuts = new WidgetShortcutManager(settings, host, _ => { });
            var window = new SettingsWindow(settings, host, shortcuts);
            window.Show();
            WpfTestHost.DoEvents();
            SelectShortio(window);
            var changes = 0;
            settings.Changed += () => changes++;

            Type(new TextBoxAutomationPeer(window.DomainBox), "go.closed.edu");
            window.Close();

            var path = Path.Combine(DashboardSettings.DataDirectory, "settings.json");
            var saved = DashboardSettings.DeserializeSettings(File.ReadAllText(path))!.LinkShortenerDomain;
            var changesAtClose = changes;
            WpfTestHost.PumpFor(TimeSpan.FromMilliseconds(500));
            SaveEvidence("214-close-before-pause.txt", $"saves and applies at close={changesAtClose}, after 500 ms={changes}, saved domain={saved}");
            Assert.Equal(1, changesAtClose);
            Assert.Equal("go.closed.edu", saved);
            Assert.Equal(1, changes);
        }));
    }

    private static void SelectShortio(SettingsWindow window)
    {
        window.ProviderCombo.SelectedItem = window.ProviderCombo.Items.Cast<ComboBoxItem>()
            .Single(item => (string)item.Tag == DashboardShortenerSettings.ShortioProvider);
        WpfTestHost.DoEvents();
    }

    private static void Type(AutomationPeer peer, string text, bool pause = false)
    {
        var value = (IValueProvider)peer.GetPattern(PatternInterface.Value);
        for (var length = 1; length <= text.Length; length++)
        {
            value.SetValue(text[..length]);
            if (pause) WpfTestHost.PumpFor(TimeSpan.FromMilliseconds(40));
        }
    }

    // No global hotkeys, so the count of re-registrations cannot depend on what else
    // on the machine holds a shortcut.
    private static DashboardSettings WithoutShortcuts() => new()
    {
        WidgetShortcutsInitialized = true,
        WidgetShortcutMenuOrderMigrated = true,
        DisplayPreviewShortcutsInitialized = true,
        MoveWidgetShortcutsInitialized = true
    };

    private static string NewDirectory()
        => Path.Combine(Path.GetTempPath(), "ClassroomWidgetsTests", Guid.NewGuid().ToString("N"));

    private static void WithDirectory(Action<string> body)
    {
        var previous = DashboardSettings.DataDirectory;
        var directory = NewDirectory();
        Directory.CreateDirectory(directory);
        DashboardSettings.UseDataDirectory(directory);
        try { body(directory); }
        finally
        {
            DashboardSettings.UseDataDirectory(previous);
            Directory.Delete(directory, recursive: true);
        }
    }

    private static void SaveEvidence(string name, string text)
    {
        var evidence = Environment.GetEnvironmentVariable("CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR");
        if (string.IsNullOrEmpty(evidence)) return;
        Directory.CreateDirectory(evidence);
        File.WriteAllText(Path.Combine(evidence, name), text);
    }
}
