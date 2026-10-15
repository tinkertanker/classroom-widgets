using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.Json;

namespace ClassroomWidgets;

/// <summary>
/// Opt-in timing marks for the Windows benchmark in <c>perf/bench.mjs</c>.
/// Setting CLASSROOM_WIDGETS_PERF_LOG to a file path appends one JSON line
/// per mark (Unix epoch milliseconds, the clock web marks also use). When it
/// is unset every call returns at once and no script is injected into pages.
/// </summary>
internal static class PerfLog
{
    private static readonly string? FilePath =
        Environment.GetEnvironmentVariable("CLASSROOM_WIDGETS_PERF_LOG") is { Length: > 0 } path ? path : null;
    private static readonly object Gate = new();
    private static StreamWriter? _writer;

    public static bool Enabled => FilePath is not null;

    private static double Now() => (DateTime.UtcNow - DateTime.UnixEpoch).TotalMilliseconds;

    /// <summary>Records the kernel's process creation time, so marks can be measured from launch.</summary>
    public static void ProcessStarted()
    {
        if (FilePath is null) return;
        using var process = Process.GetCurrentProcess();
        Mark("process.start", at: (process.StartTime.ToUniversalTime() - DateTime.UnixEpoch).TotalMilliseconds);
    }

    public static void Mark(string name, string? widgetId = null, int? widgetType = null, double? at = null, string? detail = null)
    {
        if (FilePath is null) return;
        var buffer = new MemoryStream();
        using (var json = new Utf8JsonWriter(buffer))
        {
            json.WriteStartObject();
            json.WriteString("src", "native");
            json.WriteString("mark", name);
            json.WriteNumber("t", at ?? Now());
            if (widgetId is not null) json.WriteString("widgetId", widgetId);
            if (widgetType is not null) json.WriteNumber("widgetType", widgetType.Value);
            if (detail is not null) json.WriteString("detail", detail);
            json.WriteNumber("jitMs", Math.Round(System.Runtime.JitInfo.GetCompilationTime().TotalMilliseconds, 2));
            json.WriteNumber("jitMethods", System.Runtime.JitInfo.GetCompiledMethodCount());
            json.WriteEndObject();
        }
        Append(Encoding.UTF8.GetString(buffer.ToArray()));
    }

    /// <summary>Logs a mark posted by <see cref="WebScript"/> with the time native received it.</summary>
    public static void WebMark(string messageJson)
    {
        if (FilePath is null) return;
        Append($"{{\"src\":\"web\",\"rt\":{Now().ToString("0.###", System.Globalization.CultureInfo.InvariantCulture)},\"msg\":{messageJson}}}");
    }

    private static void Append(string line)
    {
        try
        {
            lock (Gate)
            {
                _writer ??= new StreamWriter(new FileStream(FilePath!, FileMode.Append, FileAccess.Write, FileShare.ReadWrite)) { AutoFlush = true };
                _writer.WriteLine(line);
            }
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
        }
    }

    /// <summary>
    /// Document-created script that posts web-side marks: first contentful
    /// paint, the launcher's widget grid painted, and a panel's widget painted
    /// (the frame after the page posts panel-content-ready). It also keeps a
    /// running long-task tally the benchmark reads over DevTools.
    /// </summary>
    public const string WebScript = """
        (() => {
          if (window.__cwPerf || !window.chrome || !window.chrome.webview) return;
          const webview = window.chrome.webview;
          const post = webview.postMessage.bind(webview);
          const query = new URLSearchParams(location.search);
          const surface = query.get('surface') || (query.get('dashboard') === '1' ? 'host' : 'app');
          const widgetId = query.get('widgetId') || undefined;
          const now = () => performance.timeOrigin + performance.now();
          const send = (mark, extra) => { try { post({ handler: 'classroomPerf', mark, t: now(), surface, widgetId, ...extra }); } catch (_) {} };
          const afterPaint = (mark) => requestAnimationFrame(() => setTimeout(() => send(mark), 0));
          const longTasks = { count: 0, totalMs: 0, maxMs: 0 };
          window.__cwPerf = { send, longTasks };
          send('doc.created', { timeOrigin: performance.timeOrigin });
          document.addEventListener('DOMContentLoaded', () => send('dom.loaded'), { once: true });
          try {
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                if (entry.name === 'first-contentful-paint') send('fcp', { at: performance.timeOrigin + entry.startTime });
              }
            }).observe({ type: 'paint', buffered: true });
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                longTasks.count += 1;
                longTasks.totalMs += entry.duration;
                longTasks.maxMs = Math.max(longTasks.maxMs, entry.duration);
              }
            }).observe({ type: 'longtask', buffered: true });
          } catch (_) {}
          if (surface === 'widget-panel') {
            webview.postMessage = (message) => {
              post(message);
              if (message && message.type === 'panel-content-ready') afterPaint('content.painted');
            };
          } else if (surface === 'widget-launcher') {
            // content.repainted marks the first frames after the page becomes
            // visible or is resized, as when a preloaded launcher is shown.
            let painted = false;
            const ready = () => [...document.querySelectorAll('button')].some((button) => /Timer/.test(button.textContent || ''));
            const contentPainted = () => { painted = true; afterPaint('content.painted'); };
            const observer = new MutationObserver(() => {
              if (!ready()) return;
              observer.disconnect();
              contentPainted();
            });
            document.addEventListener('DOMContentLoaded', () => {
              if (ready()) contentPainted();
              else observer.observe(document.body, { childList: true, subtree: true });
            }, { once: true });
            const repainted = () => { if (painted && document.visibilityState === 'visible') afterPaint('content.repainted'); };
            document.addEventListener('visibilitychange', repainted);
            window.addEventListener('resize', repainted);
          }
        })();
        """;
}
