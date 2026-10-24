// Display capture benchmark for #211. Windows only.
//
//   dotnet run -c Release --project packages/windows-dashboard/perf/CaptureBench --
//       [--label NAME] [--source X,Y,W,H] [--preview W,H] [--seconds 20] [--captures 200]
//       [--cycles 50] [--out DIR] [--moving-source]
//
// --source is the captured region in physical pixels (default: the primary display). With
// only one display the live phase captures its own window; use another monitor if you can.
// --preview is the preview image area in physical pixels (default 720,540: the default
// 480x360 DIP preview at 150% scaling). The live phase sizes its window to it and then
// targets the image area it actually got, as the app does.
//
// To measure a baseline, keep this folder and the csproj and swap in the old capture code:
//   git checkout <base> -- packages/windows-dashboard/Source
// Builds without the target-size constructor ignore --preview and capture at source size;
// summary.json records which constructor ran. Capture-to-presentation latency starts when
// the session samples the preview size and ends at FrameReady, on both sync and async builds.
// It includes worker/dispatcher scheduling but not the 66 ms inter-frame delay. WPF's render
// thread and GPU upload show up in live CPU and input latency. --moving-source starts a
// separate animated-source process, excluded from the measured capture-process CPU.
//
// Phases, all on one STA dispatcher like the app:
//   1. idle:      dispatcher latency with no capture, for a baseline.
//   2. capture:   --captures completed frames; Start need not emit a frame synchronously.
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
        if (args.Contains("--source-only"))
        {
            MovingSource(Options.Parse(args).Source);
            return 0;
        }
        var options = Options.Parse(args);
        Directory.CreateDirectory(options.Out);
        var dispatcher = Dispatcher.CurrentDispatcher;
        SynchronizationContext.SetSynchronizationContext(new DispatcherSynchronizationContext(dispatcher));
        using var source = args.Contains("--moving-source") ? StartMovingSource(options) : null;
        Pump(TimeSpan.FromSeconds(1));
        var result = new Dictionary<string, object?>
        {
            ["label"] = options.Label,
            ["machine"] = Environment.MachineName,
            ["os"] = Environment.OSVersion.VersionString,
            ["primaryDisplay"] = Forms.Screen.PrimaryScreen?.Bounds.ToString(),
            ["source"] = options.Source.ToString(),
            ["preview"] = options.Preview.ToString(),
            ["targetSizeConstructor"] = TargetConstructor() is not null,
            ["movingSource"] = source is not null,
            ["processorCount"] = Environment.ProcessorCount,
            ["captureMetric"] = "Preview-size sampling to FrameReady, including scheduling/presentation, excluding cadence delay",
        };

        try
        {
            result["idle"] = Latency(dispatcher, TimeSpan.FromSeconds(Math.Min(5, options.Seconds)), null);
            result["capture"] = Captures(options);
            result["live"] = Live(dispatcher, options);
            result["gdi"] = GdiCycles(options);
        }
        finally
        {
            if (source is { HasExited: false }) source.Kill();
        }

        var json = JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(Path.Combine(options.Out, "summary.json"), json);
        File.WriteAllText(Path.Combine(options.Out, "summary.md"), Markdown(result));
        Console.WriteLine(json);
        return 0;
    }

    private static Process StartMovingSource(Options options)
    {
        var start = new ProcessStartInfo(Environment.ProcessPath!) { UseShellExecute = false };
        // Also support `dotnet CaptureBench.dll`, not only the apphost executable.
        if (Path.GetFileNameWithoutExtension(start.FileName).Equals("dotnet", StringComparison.OrdinalIgnoreCase))
            start.ArgumentList.Add(typeof(Program).Assembly.Location);
        start.ArgumentList.Add("--source-only");
        start.ArgumentList.Add("--source");
        start.ArgumentList.Add(options.Source.ToString(System.Globalization.CultureInfo.InvariantCulture));
        return Process.Start(start)!;
    }

    private static void MovingSource(Rect bounds)
    {
        var canvas = new Canvas { Background = Brushes.DarkSlateBlue, ClipToBounds = true };
        var window = new Window { Content = canvas, WindowStyle = WindowStyle.None, ResizeMode = ResizeMode.NoResize, ShowInTaskbar = false };
        window.SourceInitialized += (_, _) =>
        {
            var transform = PresentationSource.FromVisual(window)!.CompositionTarget!.TransformFromDevice;
            var dip = Rect.Transform(bounds, transform);
            window.Left = dip.X;
            window.Top = dip.Y;
            window.Width = dip.Width;
            window.Height = dip.Height;
        };
        var stripe = new System.Windows.Shapes.Rectangle { Width = 180, Fill = Brushes.Gold };
        canvas.Children.Add(stripe);
        var label = new TextBlock { Foreground = Brushes.White, FontSize = 48, Text = "Moving capture source" };
        canvas.Children.Add(label);
        Canvas.SetTop(label, 60);
        var clock = Stopwatch.StartNew();
        var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(16) };
        timer.Tick += (_, _) =>
        {
            stripe.Height = canvas.ActualHeight;
            Canvas.SetLeft(stripe, (clock.Elapsed.TotalSeconds * 250) % Math.Max(1, canvas.ActualWidth));
            label.Text = $"Moving capture source {clock.Elapsed.TotalSeconds:0.00}s";
        };
        timer.Start();
        new Application().Run(window);
        timer.Stop();
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

    private static object Captures(Options options)
    {
        var started = 0L;
        using var session = Create(options, () => { started = Stopwatch.GetTimestamp(); return options.Preview; });
        Exception? failure = null;
        session.Failed += error => failure = error;
        var samples = new List<double>(options.Captures);
        var frames = 0;
        session.FrameReady += () =>
        {
            if (++frames > 5) samples.Add(Stopwatch.GetElapsedTime(started).TotalMilliseconds);
        };
        session.Start();
        WaitUntil(() => samples.Count >= options.Captures || failure is not null, TimeSpan.FromSeconds(Math.Max(30, options.Captures)), "capture samples");
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
        var surface = new Grid { Background = Brushes.Black, Children = { image } };
        var window = new Window
        {
            Title = "Capture bench preview",
            Content = surface,
            UseLayoutRounding = true,
            WindowStyle = WindowStyle.ToolWindow,
            ShowActivated = false,
            Topmost = true,
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

        Size ImagePixels() => new(Math.Round(surface.ActualWidth * dpi), Math.Round(surface.ActualHeight * dpi));
        using var session = Create(options, () => surface.ActualWidth > 0 ? ImagePixels() : options.Preview);
        var frames = 0;
        Exception? failure = null;
        var gdiMax = 0u;
        long workingSetMax = 0;
        session.FrameReady += () =>
        {
            frames++;
            image.Source = session.Image;
            gdiMax = Math.Max(gdiMax, Gdi());
            using var current = Process.GetCurrentProcess();
            workingSetMax = Math.Max(workingSetMax, current.WorkingSet64);
        };
        session.Failed += error => failure = error;
        using var process = Process.GetCurrentProcess();
        process.Refresh();
        var cpuBefore = process.TotalProcessorTime;
        var workingSetBefore = process.WorkingSet64;
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
            imageAreaPixels = ImagePixels().ToString(),
            cpuPercentOfOneCore = 100 * cpu.TotalMilliseconds / wall.Elapsed.TotalMilliseconds,
            workingSetBefore,
            workingSetMax,
            workingSetAfter = process.WorkingSet64,
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
            var frames = 0;
            session.FrameReady += () => frames++;
            session.Start();
            WaitUntil(() => frames >= 2, TimeSpan.FromSeconds(10), "GDI cycle frames");
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
        var heartbeat = new List<double>();
        var lastBeat = Stopwatch.GetTimestamp();
        var timer = new DispatcherTimer(DispatcherPriority.Background) { Interval = TimeSpan.FromMilliseconds(16) };
        timer.Tick += (_, _) =>
        {
            heartbeat.Add(Math.Max(0, Stopwatch.GetElapsedTime(lastBeat).TotalMilliseconds - 16));
            lastBeat = Stopwatch.GetTimestamp();
        };
        timer.Start();
        var gate = new object();
        var pending = 0;
        using var done = new ManualResetEventSlim();
        var worker = new Thread(() =>
        {
            while (!done.IsSet)
            {
                if (Interlocked.CompareExchange(ref pending, 1, 0) == 0)
                {
                    var posted = Stopwatch.GetTimestamp();
                    dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
                    {
                        var late = Stopwatch.GetElapsedTime(posted).TotalMilliseconds;
                        lock (gate) samples.Add(late);
                        Interlocked.Exchange(ref pending, 0);
                    }));
                }
                done.Wait(16);
            }
        }) { IsBackground = true };
        worker.Start();
        var deadline = Stopwatch.StartNew();
        while (deadline.Elapsed < duration && !(stop?.Invoke() ?? false)) Pump(TimeSpan.FromMilliseconds(50));
        done.Set();
        worker.Join();
        timer.Stop();
        Pump(TimeSpan.FromMilliseconds(100));
        lock (gate) return new { input = Stats(samples), heartbeatDelay = Stats(heartbeat) };
    }

    private static void WaitUntil(Func<bool> condition, TimeSpan timeout, string what)
    {
        var deadline = Stopwatch.StartNew();
        while (!condition())
        {
            if (deadline.Elapsed > timeout) throw new TimeoutException($"Waiting for {what}");
            Pump(TimeSpan.FromMilliseconds(5));
        }
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
            | Frame size | {Get("capture", "frameWidth")}x{Get("capture", "frameHeight")} |
            | Capture-to-presentation ms p50 / p95 / max | {Get("capture", "captureMs", "p50")} / {Get("capture", "captureMs", "p95")} / {Get("capture", "captureMs", "max")} |
            | Live fps | {Get("live", "fps")} |
            | Live CPU % of one core | {Get("live", "cpuPercentOfOneCore")} |
            | Input latency idle p50 / p95 / max ms | {Get("idle", "input", "p50")} / {Get("idle", "input", "p95")} / {Get("idle", "input", "max")} |
            | Input latency live p50 / p95 / p99 / max ms | {Get("live", "inputLatencyMs", "input", "p50")} / {Get("live", "inputLatencyMs", "input", "p95")} / {Get("live", "inputLatencyMs", "input", "p99")} / {Get("live", "inputLatencyMs", "input", "max")} |
            | Input items later than 33 ms (live) | {Get("live", "inputLatencyMs", "input", "over33")} of {Get("live", "inputLatencyMs", "input", "count")} |
            | Heartbeat delay live p95 / max ms | {Get("live", "inputLatencyMs", "heartbeatDelay", "p95")} / {Get("live", "inputLatencyMs", "heartbeatDelay", "max")} |
            | Working set before / peak / after bytes | {Get("live", "workingSetBefore")} / {Get("live", "workingSetMax")} / {Get("live", "workingSetAfter")} |
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
