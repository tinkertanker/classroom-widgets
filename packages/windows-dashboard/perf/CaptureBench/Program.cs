// Display capture benchmark for #211. Windows only.
//
//   dotnet run -c Release --project packages/windows-dashboard/perf/CaptureBench --
//       [--label NAME] [--source X,Y,W,H] [--preview W,H] [--seconds 20] [--captures 200]
//       [--cycles 50] [--out DIR]
//
// --source is the captured region in physical pixels (default: the primary display).
// --preview is the preview image area in physical pixels (default 720,540: the default
// 480x360 DIP preview at 150% scaling). Builds without the target-size constructor (before
// #211) ignore it and capture at source size; summary.json records which constructor ran.
//
// Phases, all on one STA dispatcher like the app:
//   1. idle:      dispatcher latency with no capture, for a baseline.
//   2. sync:      --captures synchronous captures (Start() captures one frame at once).
//   3. live:      the real 66 ms capture timer feeding an Image in a preview-sized window for
//                 --seconds, while a worker thread posts an Input-priority item every 16 ms
//                 and records how late it runs (what a click or key press would feel).
//   4. gdi:       GDI object count before, during and after --cycles start/stop sessions.
// Writes summary.json and summary.md to --out (default capture-bench-<label>-<time>).

using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Threading;
using ClassroomWidgets;
using Forms = System.Windows.Forms;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        var options = Options.Parse(args);
        Directory.CreateDirectory(options.Out);
        var dispatcher = Dispatcher.CurrentDispatcher;
        SynchronizationContext.SetSynchronizationContext(new DispatcherSynchronizationContext(dispatcher));
        var result = new Dictionary<string, object?>
        {
            ["label"] = options.Label,
            ["machine"] = Environment.MachineName,
            ["os"] = Environment.OSVersion.VersionString,
            ["primaryDisplay"] = Forms.Screen.PrimaryScreen?.Bounds.ToString(),
            ["source"] = options.Source.ToString(),
            ["preview"] = options.Preview.ToString(),
            ["targetSizeConstructor"] = TargetConstructor() is not null,
        };

        result["idle"] = Latency(dispatcher, TimeSpan.FromSeconds(Math.Min(5, options.Seconds)), null);
        result["sync"] = SyncCaptures(options);
        result["live"] = Live(dispatcher, options);
        result["gdi"] = GdiCycles(options);

        var json = JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(Path.Combine(options.Out, "summary.json"), json);
        File.WriteAllText(Path.Combine(options.Out, "summary.md"), Markdown(result));
        Console.WriteLine(json);
        return 0;
    }

    private static ConstructorInfo? TargetConstructor()
        => typeof(DisplayCaptureSession).GetConstructor(new[] { typeof(Rect), typeof(Func<bool>), typeof(Func<Size>) });

    private static DisplayCaptureSession Create(Options options, Func<Size> target)
    {
        var withTarget = TargetConstructor();
        return withTarget is not null
            ? (DisplayCaptureSession)withTarget.Invoke(new object?[] { options.Source, null, target })
            : new DisplayCaptureSession(options.Source);
    }

    private static object SyncCaptures(Options options)
    {
        using var session = Create(options, () => options.Preview);
        Exception? failure = null;
        session.Failed += error => failure = error;
        // Warm up allocations and GDI's first-use costs.
        for (var i = 0; i < 5; i++) session.Start();
        var samples = new List<double>(options.Captures);
        for (var i = 0; i < options.Captures && failure is null; i++)
        {
            var started = Stopwatch.GetTimestamp();
            session.Start();
            samples.Add(Stopwatch.GetElapsedTime(started).TotalMilliseconds);
        }
        var image = session.Image as System.Windows.Media.Imaging.BitmapSource;
        return new
        {
            failure = failure?.Message,
            frameWidth = image?.PixelWidth,
            frameHeight = image?.PixelHeight,
            captureMs = Stats(samples),
        };
    }

    private static object Live(Dispatcher dispatcher, Options options)
    {
        var dpi = 1.0;
        var image = new Image { Stretch = Stretch.Uniform };
        var window = new Window
        {
            Title = "Capture bench preview",
            Content = new Grid { Background = Brushes.Black, Children = { image } },
            WindowStyle = WindowStyle.ToolWindow,
            ShowActivated = false,
            Left = 0,
            Top = 0,
        };
        window.SourceInitialized += (_, _) =>
        {
            dpi = PresentationSource.FromVisual(window)!.CompositionTarget!.TransformToDevice.M11;
            window.Width = options.Preview.Width / dpi;
            window.Height = options.Preview.Height / dpi;
        };
        window.Show();
        // Keep the bench window off the captured region where possible: park it bottom-right.
        var area = SystemParameters.WorkArea;
        window.Left = Math.Max(0, area.Right - window.Width);
        window.Top = Math.Max(0, area.Bottom - window.Height);
        Pump(TimeSpan.FromMilliseconds(500));

        using var session = Create(options, () => options.Preview);
        var frames = 0;
        Exception? failure = null;
        var gdiMax = 0u;
        session.FrameReady += () =>
        {
            frames++;
            image.Source = session.Image;
            gdiMax = Math.Max(gdiMax, Gdi());
        };
        session.Failed += error => failure = error;
        using var process = Process.GetCurrentProcess();
        process.Refresh();
        var cpuBefore = process.TotalProcessorTime;
        var wall = Stopwatch.StartNew();
        session.Start();
        var latency = Latency(dispatcher, TimeSpan.FromSeconds(options.Seconds), () => failure is not null);
        wall.Stop();
        process.Refresh();
        var cpu = process.TotalProcessorTime - cpuBefore;
        var shown = image.Source as System.Windows.Media.Imaging.BitmapSource;
        var screenshot = Path.Combine(options.Out, "live-preview.png");
        SaveWindow(window, screenshot);
        session.Dispose();
        window.Close();
        return new
        {
            failure = failure?.Message,
            seconds = wall.Elapsed.TotalSeconds,
            frames,
            fps = frames / wall.Elapsed.TotalSeconds,
            frameWidth = shown?.PixelWidth,
            frameHeight = shown?.PixelHeight,
            cpuPercentOfOneCore = 100 * cpu.TotalMilliseconds / wall.Elapsed.TotalMilliseconds,
            gdiObjectsMax = gdiMax,
            inputLatencyMs = latency,
        };
    }

    private static object GdiCycles(Options options)
    {
        var before = Gdi();
        var during = new List<uint>();
        for (var cycle = 0; cycle < options.Cycles; cycle++)
        {
            var size = cycle % 2 == 0 ? options.Preview : new Size(options.Preview.Width / 2, options.Preview.Height / 2);
            using var session = Create(options, () => size);
            session.Start();
            session.Start();
            during.Add(Gdi());
        }
        Pump(TimeSpan.FromMilliseconds(200));
        GC.Collect();
        GC.WaitForPendingFinalizers();
        return new { before, duringMax = during.Count == 0 ? 0 : during.Max(), after = Gdi(), cycles = options.Cycles };
    }

    /// <summary>Posts an Input-priority item every 16 ms from a worker and records how late each runs.</summary>
    private static object Latency(Dispatcher dispatcher, TimeSpan duration, Func<bool>? stop)
    {
        var samples = new List<double>();
        var gate = new object();
        using var done = new ManualResetEventSlim();
        var worker = new Thread(() =>
        {
            while (!done.IsSet)
            {
                var posted = Stopwatch.GetTimestamp();
                dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
                {
                    var late = Stopwatch.GetElapsedTime(posted).TotalMilliseconds;
                    lock (gate) samples.Add(late);
                }));
                done.Wait(16);
            }
        }) { IsBackground = true };
        worker.Start();
        var deadline = Stopwatch.StartNew();
        while (deadline.Elapsed < duration && !(stop?.Invoke() ?? false)) Pump(TimeSpan.FromMilliseconds(50));
        done.Set();
        worker.Join();
        Pump(TimeSpan.FromMilliseconds(100));
        lock (gate) return Stats(samples);
    }

    private static void Pump(TimeSpan duration)
    {
        var frame = new DispatcherFrame();
        var timer = new DispatcherTimer(DispatcherPriority.Send) { Interval = duration };
        timer.Tick += (_, _) => { timer.Stop(); frame.Continue = false; };
        timer.Start();
        Dispatcher.PushFrame(frame);
    }

    private static object Stats(List<double> samples)
    {
        if (samples.Count == 0) return new { count = 0 };
        var sorted = samples.OrderBy(value => value).ToArray();
        double At(double q) => sorted[Math.Min(sorted.Length - 1, (int)Math.Floor(q * sorted.Length))];
        return new
        {
            count = sorted.Length,
            mean = Math.Round(sorted.Average(), 3),
            p50 = Math.Round(At(0.5), 3),
            p95 = Math.Round(At(0.95), 3),
            p99 = Math.Round(At(0.99), 3),
            max = Math.Round(sorted[^1], 3),
            over33 = sorted.Count(value => value > 33),
        };
    }

    private static void SaveWindow(Window window, string path)
    {
        if (window.Content is not FrameworkElement content || content.ActualWidth <= 0) return;
        var bitmap = new System.Windows.Media.Imaging.RenderTargetBitmap(
            (int)content.ActualWidth, (int)content.ActualHeight, 96, 96, PixelFormats.Pbgra32);
        bitmap.Render(content);
        var encoder = new System.Windows.Media.Imaging.PngBitmapEncoder();
        encoder.Frames.Add(System.Windows.Media.Imaging.BitmapFrame.Create(bitmap));
        using var stream = File.Create(path);
        encoder.Save(stream);
    }

    private static string Markdown(Dictionary<string, object?> result)
    {
        var element = JsonSerializer.SerializeToElement(result);
        string Get(params string[] path)
        {
            var node = element;
            foreach (var key in path)
            {
                if (node.ValueKind != JsonValueKind.Object || !node.TryGetProperty(key, out node)) return "-";
            }
            return node.ToString();
        }
        return $"""
            # Capture bench: {Get("label")}

            - Source {Get("source")}, preview {Get("preview")}, primary display {Get("primaryDisplay")}
            - Target-size constructor: {Get("targetSizeConstructor")}

            | Measure | Value |
            | --- | --- |
            | Frame size | {Get("sync", "frameWidth")}x{Get("sync", "frameHeight")} |
            | Capture ms p50 / p95 / max | {Get("sync", "captureMs", "p50")} / {Get("sync", "captureMs", "p95")} / {Get("sync", "captureMs", "max")} |
            | Live fps | {Get("live", "fps")} |
            | Live CPU % of one core | {Get("live", "cpuPercentOfOneCore")} |
            | Input latency idle p50 / p95 / max ms | {Get("idle", "p50")} / {Get("idle", "p95")} / {Get("idle", "max")} |
            | Input latency live p50 / p95 / p99 / max ms | {Get("live", "inputLatencyMs", "p50")} / {Get("live", "inputLatencyMs", "p95")} / {Get("live", "inputLatencyMs", "p99")} / {Get("live", "inputLatencyMs", "max")} |
            | Input items later than 33 ms (live) | {Get("live", "inputLatencyMs", "over33")} of {Get("live", "inputLatencyMs", "count")} |
            | GDI objects live max | {Get("live", "gdiObjectsMax")} |
            | GDI objects before / during max / after {Get("gdi", "cycles")} sessions | {Get("gdi", "before")} / {Get("gdi", "duringMax")} / {Get("gdi", "after")} |

            """;
    }

    private static uint Gdi()
    {
        using var process = Process.GetCurrentProcess();
        return GetGuiResources(process.Handle, 0);
    }

    [DllImport("user32.dll")]
    private static extern uint GetGuiResources(IntPtr process, uint flags);

    private sealed record Options(string Label, Rect Source, Size Preview, int Seconds, int Captures, int Cycles, string Out)
    {
        public static Options Parse(string[] args)
        {
            string? Value(string name)
            {
                var index = Array.IndexOf(args, name);
                return index >= 0 && index + 1 < args.Length ? args[index + 1] : null;
            }
            double[] Numbers(string text) => text.Split(',').Select(double.Parse).ToArray();
            var primary = Forms.Screen.PrimaryScreen!.Bounds;
            var source = Value("--source") is { } s && Numbers(s) is { Length: 4 } r
                ? new Rect(r[0], r[1], r[2], r[3])
                : new Rect(primary.X, primary.Y, primary.Width, primary.Height);
            var preview = Value("--preview") is { } p && Numbers(p) is { Length: 2 } v ? new Size(v[0], v[1]) : new Size(720, 540);
            var label = Value("--label") ?? "run";
            return new Options(
                label,
                source,
                preview,
                int.Parse(Value("--seconds") ?? "20"),
                int.Parse(Value("--captures") ?? "200"),
                int.Parse(Value("--cycles") ?? "50"),
                Value("--out") ?? $"capture-bench-{label}-{DateTime.Now:yyyyMMdd-HHmmss}");
        }
    }
}
