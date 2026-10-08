using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using ClassroomWidgets;
using Xunit;

namespace ClassroomWidgetsTests;

public sealed class NativeWindowRegressionTests
{
    // Failure modes: activation without restoration leaves an iconic HWND;
    // changing only the WPF setting leaves Display's native topmost flag set.
    [Fact]
    public void DisplayShowRestoresMinimizedWindowWithoutReplacingIt()
        => WithSettings("display-restore", settings =>
        {
            using var preview = new DisplayPreviewCoordinator(settings, new DisplayCatalog());
            preview.Open();
            var window = preview.Window!;
            var handle = new WindowInteropHelper(window).Handle;
            window.WindowState = WindowState.Minimized;
            WpfTestHost.PumpUntil(() => IsIconic(handle), TimeSpan.FromSeconds(5), "Display to minimize");
            preview.Open();
            WpfTestHost.PumpFor(TimeSpan.FromMilliseconds(200));
            Assert.Same(window, preview.Window);
            Assert.False(IsIconic(handle), "Show must restore the existing Display HWND.");
            SaveWindow("display-restored.png", window);
        });

    [Fact]
    public void TraySettingsRestoresMinimizedWindowWithoutReplacingIt()
        => WithSettings("settings-restore", settings =>
        {
            var host = new WidgetHostController(settings);
            using var shortcuts = new WidgetShortcutManager(settings, host, _ => { });
            using var tray = new TrayController(host, settings, shortcuts,
                new UpdateController(() => Task.CompletedTask), () => { }, () => { });
            tray.OpenSettings();
            var field = typeof(TrayController).GetField("_settingsWindow", BindingFlags.Instance | BindingFlags.NonPublic)!;
            var window = (Window)field.GetValue(tray)!;
            try
            {
                var handle = new WindowInteropHelper(window).Handle;
                window.WindowState = WindowState.Minimized;
                WpfTestHost.PumpUntil(() => IsIconic(handle), TimeSpan.FromSeconds(5), "Settings to minimize");
                tray.OpenSettings();
                WpfTestHost.PumpFor(TimeSpan.FromMilliseconds(200));
                Assert.Same(window, field.GetValue(tray));
                Assert.False(IsIconic(handle), "Tray Settings must restore the existing HWND.");
                SaveWindow("settings-restored.png", window);
            }
            finally { window.Close(); }
        });

    [Fact]
    public void DisplayHonorsTopmostPreferenceAtCreationAndWhileOpen()
        => WithSettings("display-topmost", settings =>
        {
            settings.AlwaysOnTop = false;
            using var preview = new DisplayPreviewCoordinator(settings, new DisplayCatalog());
            preview.Open();
            var handle = new WindowInteropHelper(preview.Window!).Handle;
            WpfTestHost.PumpUntil(() => preview.Window!.IsLoaded, TimeSpan.FromSeconds(5), "Display loaded before live preference changes");
            Console.WriteLine($"D10 loaded={preview.Window!.IsLoaded}, managed={preview.Window.Topmost}, style={GetWindowLong(handle, -20):X}");
            Assert.Equal(0, GetWindowLong(handle, -20) & 0x8);
            settings.AlwaysOnTop = true;
            settings.NotifyChanged();
            WpfTestHost.DoEvents();
            Console.WriteLine($"D10 enabled: open={preview.IsOpen}, managed={preview.Window!.Topmost}, style={GetWindowLong(handle, -20):X}");
            Assert.NotEqual(0, GetWindowLong(handle, -20) & 0x8);
            settings.AlwaysOnTop = false;
            settings.NotifyChanged();
            WpfTestHost.DoEvents();
            Console.WriteLine($"D10 disabled: open={preview.IsOpen}, managed={preview.Window!.Topmost}, style={GetWindowLong(handle, -20):X}");
            Assert.Equal(0, GetWindowLong(handle, -20) & 0x8);
            preview.Close();
            preview.Open();
            Assert.Equal(0, GetWindowLong(new WindowInteropHelper(preview.Window!).Handle, -20) & 0x8);
            SaveWindow("display-not-topmost.png", preview.Window!);
        });

    private static void WithSettings(string name, Action<DashboardSettings> scenario)
    {
        if (!NativeMovementTests.IsChildProcess)
        {
            NativeMovementTests.RunScenario(name);
            return;
        }
        var original = DashboardSettings.DataDirectory;
        var directory = Path.Combine(Path.GetTempPath(), "ClassroomWidgetsTests", Guid.NewGuid().ToString("N"));
        DashboardSettings.UseDataDirectory(directory);
        try { WpfTestHost.Run(() => scenario(new DashboardSettings())); }
        finally
        {
            DashboardSettings.UseDataDirectory(original);
            if (Directory.Exists(directory)) Directory.Delete(directory, true);
        }
    }

    private static void SaveWindow(string name, Window window)
    {
        window.UpdateLayout();
        var bitmap = new RenderTargetBitmap((int)window.ActualWidth * 2, (int)window.ActualHeight * 2,
            192, 192, PixelFormats.Pbgra32);
        bitmap.Render(window);
        WpfTestHost.SaveEvidence(name, bitmap);
    }

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsIconic(IntPtr hwnd);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongW")]
    private static extern int GetWindowLong(IntPtr hwnd, int index);
}
