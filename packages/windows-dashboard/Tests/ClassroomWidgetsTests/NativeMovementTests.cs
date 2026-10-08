using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls.Primitives;
using System.Windows.Interop;
using ClassroomWidgets;
using Xunit;
using Forms = System.Windows.Forms;

namespace ClassroomWidgetsTests;

// These tests need Windows-visible monitors, not injected rectangles. A child
// process runs the production App startup and hotkey wiring with an isolated
// profile, without leaving Application.Current/IsShuttingDown in the test host.
public sealed class NativeMovementTests
{
    [MultiMonitorFact]
    public void FocusedDisplayOwnsMoveShortcutAndSuspendsOverlappingCapture()
        => RunApplicationScenario("display");

    [MultiMonitorFact]
    public void MixedDpiMoveUsesPhysicalMonitorOriginsAndPersistsResult()
        => RunApplicationScenario("dpi");

    private static void RunApplicationScenario(string scenario)
    {
        using var process = new Process
        {
            StartInfo = new ProcessStartInfo("dotnet")
            {
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            }
        };
        process.StartInfo.ArgumentList.Add(typeof(NativeMovementTests).Assembly.Location);
        process.StartInfo.ArgumentList.Add(scenario);
        process.Start();
        var stdout = process.StandardOutput.ReadToEndAsync();
        var stderr = process.StandardError.ReadToEndAsync();
        if (!process.WaitForExit(120_000))
        {
            process.Kill(entireProcessTree: true);
            process.WaitForExit();
        }
        var output = stdout.GetAwaiter().GetResult() + stderr.GetAwaiter().GetResult();
        Console.WriteLine(output);
        var evidence = Environment.GetEnvironmentVariable("CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR");
        if (!string.IsNullOrEmpty(evidence))
        {
            Directory.CreateDirectory(evidence);
            File.WriteAllText(Path.Combine(evidence, $"movement-{scenario}.log"), output);
        }
        Assert.True(process.ExitCode == 0, output);
    }

    [STAThread]
    public static int Main(string[] args)
    {
        if (args.Length != 1 || args[0] is not ("display" or "dpi")) return 2;
        if (!SetProcessDpiAwarenessContext(new IntPtr(-4)))
        {
            Console.Error.WriteLine("Fixture requires PerMonitorV2 DPI awareness before creating any HWND.");
            return 2;
        }
        Application.ResourceAssembly = typeof(App).Assembly;
        DashboardSettings.UseDataDirectory(Path.Combine(Path.GetTempPath(), "ClassroomWidgetsMovementTests", Guid.NewGuid().ToString("N")));
        var application = new App();
        application.InitializeComponent();
        var exitCode = 1;
        application.Startup += (_, _) => application.Dispatcher.BeginInvoke(new Action(async () =>
        {
            try
            {
                await ExerciseMovementAsync(application, args[0]);
                exitCode = 0;
            }
            catch (Exception error) { Console.Error.WriteLine(error); }
            finally { await application.RequestQuitAsync(); }
        }));
        application.Run();
        return exitCode;
    }

    private static async Task ExerciseMovementAsync(App application, string scenario)
    {
        var screens = Forms.Screen.AllScreens.OrderBy(s => s.WorkingArea.X).ThenBy(s => s.WorkingArea.Y).ToArray();
        Assert.True(screens.Length >= 2, "Fixture requires at least two native monitors.");
        foreach (var screen in screens)
            Console.WriteLine($"Monitor {screen.DeviceName}: bounds={screen.Bounds}, work={screen.WorkingArea}, dpi={MonitorDpi(screen)}");

        var host = Field<WidgetHostController>(application, "_host");
        var preview = Field<DisplayPreviewCoordinator>(application, "_displayPreview");
        var shortcuts = Field<WidgetShortcutManager>(application, "_shortcuts");
        await Until(() => host.IsAvailable, "production host inventory");
        Field<LauncherWindow>(application, "_launcher").Hide();
        Assert.Equal(WidgetShortcutStatus.Active, shortcuts.StatusFor(MoveWidgetShortcutLogic.NextWidgetType, WidgetShortcutAction.Toggle).Status);
        Assert.Equal(WidgetShortcutStatus.Active, shortcuts.StatusFor(MoveWidgetShortcutLogic.PreviousWidgetType, WidgetShortcutAction.Toggle).Status);
        await host.AddWidgetAsync(1); // Timer through the real host.
        await Until(() => Panels(host).Count == 1, "Timer panel");
        var timer = Panels(host).Single();

        var sourceIndex = 0;
        if (scenario == "dpi")
        {
            sourceIndex = Array.FindIndex(screens, source => MonitorDpi(screens[(Array.IndexOf(screens, source) + 1) % screens.Length]) > MonitorDpi(source));
            Assert.True(sourceIndex >= 0, "Fixture requires adjacent monitors with an increase in effective DPI.");
        }
        var source = screens[sourceIndex];
        var destination = screens[(sourceIndex + 1) % screens.Length];
        Position(timer, source.WorkingArea.Left + 100, source.WorkingArea.Top + 50);
        await Until(() => ScreenOf(timer) == source.DeviceName, "Timer on source monitor");
        timer.Activate();
        await Until(() => timer.IsActive, "Timer focus");
        var before = Bounds(timer);
        Console.WriteLine($"Timer before: {before}, dpi={GetDpiForWindow(Handle(timer))}");

        if (scenario == "display")
        {
            preview.Open();
            var display = preview.Window!;
            Position(display, source.WorkingArea.Left + 650, source.WorkingArea.Top + 300);
            var descriptor = new DisplayCatalog().Displays().Single(d => d.Id == destination.DeviceName);
            typeof(DisplayPreviewCoordinator).GetMethod("SelectSource", BindingFlags.Instance | BindingFlags.NonPublic)!.Invoke(preview, [descriptor]);
            display.Activate();
            await Until(() => display.IsActive, "Display focus after Timer");
            display.PowerButton.RaiseEvent(new RoutedEventArgs(ButtonBase.ClickEvent));
            await Until(() => preview.Capture is not null && display.PreviewImage.Source is not null, "live Display capture");
            Press(0x27); // Actual registered Ctrl+Alt+Shift+Right.
            await Task.Delay(100);
            Console.WriteLine($"D06 after shortcut: Timer={Bounds(timer)}, Display={Bounds(display)}, capture={preview.Capture is not null}");
            Assert.Equal(before, Bounds(timer));
            Assert.Equal(destination.DeviceName, ScreenOf(display));
            Assert.Null(preview.Capture);
            Assert.StartsWith("Preview suspended", display.StatusText.Text);
            Capture("movement-display-overlap-suspended.png", display);
            Press(0x25);
            await Until(() => ScreenOf(display) == source.DeviceName && preview.Capture is not null, "Display move back and capture resume");
            Capture("movement-display-resumed.png", display);

            var unrelated = new Window { Title = "Unrelated foreground window", Width = 300, Height = 200 };
            try
            {
                unrelated.Show();
                unrelated.Activate();
                await Until(() => unrelated.IsActive, "unrelated window focus");
                Press(0x27);
                await Until(() => ScreenOf(timer) == destination.DeviceName, "prior-widget fallback from unrelated window");
                Console.WriteLine("D06 focused Display moved, overlap capture stopped/resumed, prior Timer fallback preserved.");
            }
            finally { unrelated.Close(); }
        }
        else
        {
            var sourceDpi = GetDpiForWindow(Handle(timer));
            var targetDpi = MonitorDpi(destination);
            Press(0x27);
            await Task.Delay(500);
            var after = Bounds(timer);
            Console.WriteLine($"D09 after shortcut: {after}, monitor={ScreenOf(timer)}, dpi={GetDpiForWindow(Handle(timer))}");
            Assert.Equal(destination.DeviceName, ScreenOf(timer));
            Assert.Equal(targetDpi, GetDpiForWindow(Handle(timer)));
            Assert.InRange(Math.Abs(after.X - (destination.WorkingArea.Left + before.X - source.WorkingArea.Left)), 0, 2);
            Assert.InRange(Math.Abs(after.Y - (destination.WorkingArea.Top + before.Y - source.WorkingArea.Top)), 0, 2);
            Assert.InRange(Math.Abs(after.Width - before.Width * targetDpi / sourceDpi), 0, 2);
            Assert.InRange(Math.Abs(after.Height - before.Height * targetDpi / sourceDpi), 0, 2);
            host.Coordinator.FlushPersistedFrames();
            var persisted = DashboardSettings.Load().PanelFrames[timer.WidgetId];
            Assert.InRange(Math.Abs(persisted.Left - timer.CurrentFrame.Left), 0, 0.01);
            Assert.InRange(Math.Abs(persisted.Top - timer.CurrentFrame.Top), 0, 0.01);
            Capture("movement-mixed-dpi-timer.png", timer);
            Press(0x25);
            await Until(() => ScreenOf(timer) == source.DeviceName, "previous display round trip");
            Console.WriteLine("D09 physical destination, offset, DPI-sized bounds, persisted frame and previous-display round trip verified.");
        }
    }

    private static async Task Until(Func<bool> condition, string what)
    {
        var deadline = DateTime.UtcNow.AddSeconds(30);
        while (!condition())
        {
            if (DateTime.UtcNow >= deadline) throw new TimeoutException($"Timed out waiting for {what}.");
            await Task.Delay(20);
        }
    }

    private static T Field<T>(object owner, string name)
        => (T)owner.GetType().GetField(name, BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(owner)!;
    private static List<WidgetPanelWindow> Panels(WidgetHostController host)
        => Field<Dictionary<string, WidgetPanelWindow>>(host.Coordinator, "_panels").Values.ToList();
    private static IntPtr Handle(Window window) => new WindowInteropHelper(window).Handle;
    private static string ScreenOf(Window window) => Forms.Screen.FromHandle(Handle(window)).DeviceName;
    private static Rect Bounds(Window window)
    {
        Assert.True(GetWindowRect(Handle(window), out var rect));
        return new Rect(rect.Left, rect.Top, rect.Right - rect.Left, rect.Bottom - rect.Top);
    }
    private static void Position(Window window, int x, int y)
        => Assert.True(SetWindowPos(Handle(window), IntPtr.Zero, x, y, 0, 0, 0x15));
    private static uint MonitorDpi(Forms.Screen screen)
    {
        var bounds = screen.Bounds;
        var monitor = MonitorFromPoint(new POINT { X = bounds.Left + bounds.Width / 2, Y = bounds.Top + bounds.Height / 2 }, 2);
        Assert.Equal(0, GetDpiForMonitor(monitor, 0, out var dpi, out _));
        return dpi;
    }
    private static void Press(byte key)
    {
        byte[] keys = [0x11, 0x12, 0x10, key];
        foreach (var value in keys) keybd_event(value, 0, 0, 0);
        foreach (var value in keys.Reverse()) keybd_event(value, 0, 2, 0);
    }
    private static void Capture(string name, Window window)
    {
        var directory = Environment.GetEnvironmentVariable("CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR");
        if (string.IsNullOrEmpty(directory)) return;
        Directory.CreateDirectory(directory);
        // Capture the actual desktop pixels, including the WebView2 child
        // HWND which RenderTargetBitmap cannot paint.
        var bounds = Bounds(window);
        using var bitmap = new System.Drawing.Bitmap((int)bounds.Width, (int)bounds.Height);
        using var graphics = System.Drawing.Graphics.FromImage(bitmap);
        graphics.CopyFromScreen((int)bounds.X, (int)bounds.Y, 0, 0, bitmap.Size);
        bitmap.Save(Path.Combine(directory, name), System.Drawing.Imaging.ImageFormat.Png);
    }

    [StructLayout(LayoutKind.Sequential)] private struct RECT { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] private struct POINT { public int X, Y; }
    [DllImport("user32.dll")] private static extern bool SetProcessDpiAwarenessContext(IntPtr value);
    [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
    [DllImport("user32.dll")] private static extern bool SetWindowPos(IntPtr hwnd, IntPtr insertAfter, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll")] private static extern uint GetDpiForWindow(IntPtr hwnd);
    [DllImport("user32.dll")] private static extern IntPtr MonitorFromPoint(POINT point, uint flags);
    [DllImport("shcore.dll")] private static extern int GetDpiForMonitor(IntPtr monitor, int kind, out uint x, out uint y);
    [DllImport("user32.dll")] private static extern void keybd_event(byte key, byte scan, uint flags, nuint extra);
}

public sealed class MultiMonitorFactAttribute : FactAttribute
{
    public MultiMonitorFactAttribute()
    {
        if (Forms.Screen.AllScreens.Length < 2)
            Skip = "Requires at least two Windows-visible monitors; single-monitor runs do not verify movement or mixed DPI.";
    }
}
