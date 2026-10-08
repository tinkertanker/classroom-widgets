using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Text.Json;
using System.Windows;
using ClassroomWidgets;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using Xunit;

namespace ClassroomWidgetsTests;

public sealed class WebViewRecoveryTests
{
    // Failure modes: navigating a browser's closed control never restores the
    // host; a launcher's ready flag hides a crashed renderer; one failed panel
    // checkpoint discards another panel's destructively collected latest edit.
    [Fact]
    public void BrowserCrashRestoresHostPanelsAndLauncherWithSavedList()
        => WithBrowser((host, launcher) =>
        {
            Add(host, 2);
            var list = Panels(host).Single();
            WaitForTextArea(View(list));
            EnterText(View(list), "Saved before browser crash");
            WaitForState(host, "Saved before browser crash");
            WpfTestHost.PumpFor(TimeSpan.FromMilliseconds(800));
            var browserId = View(host).CoreWebView2.BrowserProcessId;
            Log($"D11 killing owned browser PID {browserId}");
            using (var process = Process.GetProcessById((int)browserId)) process.Kill();
            WpfTestHost.PumpUntil(() => host.IsAvailable && BrowserId(View(host)) is { } id && id != browserId,
                TimeSpan.FromSeconds(30), "a replacement browser and host inventory");
            WaitForState(host, "Saved before browser crash");
            var restored = Panels(host).Single();
            Assert.NotSame(list, restored);
            WaitForTextArea(View(restored));
            Assert.Equal("Saved before browser crash", Script(View(restored), "document.querySelector('textarea').value").GetString());
            AssertLauncherAddsWidget(host, launcher);
            Capture("browser-recovered-list.png", View(restored));
            Capture("browser-recovered-launcher.png", View(launcher));
            Log($"D11 recovered browser PID {BrowserId(View(host))}; saved List and launcher add action verified");
        });

    [Fact]
    public void LauncherRendererCrashRecoversAndReopenedLauncherCanAddWidget()
        => WithBrowser((host, launcher) =>
        {
            var failed = false;
            View(launcher).CoreWebView2.ProcessFailed += (_, args) =>
                failed |= args.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessExited;
            // Target this page, not an arbitrary renderer PID which may belong
            // to another application. The response can fault when it crashes.
            var crash = View(launcher).CoreWebView2.CallDevToolsProtocolMethodAsync("Page.crash", "{}");
            _ = crash.ContinueWith(task => _ = task.Exception, TaskContinuationOptions.OnlyOnFaulted);
            WpfTestHost.PumpUntil(() => failed, TimeSpan.FromSeconds(15), "the launcher renderer failure event");
            Log("D12 Page.crash produced RenderProcessExited for the launcher");
            launcher.Hide();
            launcher.Show();
            AssertLauncherAddsWidget(host, launcher);
            Capture("renderer-recovered-launcher.png", View(launcher));
            Log("D12 reopened launcher added Timer through its actual web bridge");
        });

    [Fact]
    public void FailedCheckpointPreservesAnotherPanelsLatestQueuedEdit()
        => WithBrowser((host, _) =>
        {
            Add(host, 2);
            var list = Panels(host).Single();
            WaitForTextArea(View(list));
            EnterText(View(list), "A");
            WaitForState(host, "A");
            // Hold acknowledgements while still delivering the first edit to
            // the real host, leaving the second edit genuinely queued locally.
            Script(View(list), "window.classroomWidgetPanel.receiveSnapshot = () => {};");
            EnterText(View(list), "AB");
            WaitForState(host, "AB");
            EnterText(View(list), "ABC");
            WpfTestHost.PumpFor(TimeSpan.FromMilliseconds(100));
            Assert.Equal("AB", ListState(host));
            Add(host, 12);
            var qr = Panels(host).Single(panel => panel != list);
            WpfTestHost.PumpUntil(() => SafeBool(View(qr), "!!window.classroomWidgetPanel"),
                TimeSpan.FromSeconds(15), "QR panel bridge");
            Script(View(qr), "window.classroomWidgetPanel.takePendingState = () => null;");
            Log("D13 pre-reload: host AB, List textarea ABC, QR checkpoint intentionally absent");
            Complete(host.ReloadWidgetsAsync());
            WaitForState(host, "ABC");
            var restored = Panels(host).Single(panel => Descriptor(panel).SnapshotPayload.GetProperty("widgetType").GetInt32() == 2);
            WaitForTextArea(View(restored));
            Assert.Equal("ABC", Script(View(restored), "document.querySelector('textarea').value").GetString());
            Capture("failed-checkpoint-preserved-list.png", View(restored));
            Log("D13 refused reload preserved ABC in both host inventory and recreated List textarea");
        });

    private static void WithBrowser(Action<WidgetHostController, LauncherWindow> scenario)
    {
        var original = DashboardSettings.DataDirectory;
        var directory = Path.Combine(Path.GetTempPath(), "ClassroomWidgetsBrowserTests", Guid.NewGuid().ToString("N"));
        DashboardSettings.UseDataDirectory(directory);
        WpfTestHost.Run(() =>
        {
            typeof(DashboardWebView).GetField("_environment", BindingFlags.Static | BindingFlags.NonPublic)!.SetValue(null, null);
            var settings = new DashboardSettings();
            var host = new WidgetHostController(settings);
            var launcher = new LauncherWindow(type => Complete(host.AddWidgetAsync(type)), () => { });
            try
            {
                Complete(host.StartAsync());
                WpfTestHost.PumpUntil(() => host.IsAvailable, TimeSpan.FromSeconds(30), "the real teacher host inventory");
                launcher.Show();
                WaitForLauncher(launcher);
                Log($"fixture: {App.AppVersion}, browser PID {BrowserId(View(host))}, profile {directory}");
                scenario(host, launcher);
            }
            finally
            {
                host.Coordinator.Deactivate();
                View(host).Dispose();
                View(launcher).Dispose();
                Field<Window>(host, "_hostWindow").Hide();
                Field<Window>(launcher, "_window").Hide();
                WpfTestHost.PumpFor(TimeSpan.FromMilliseconds(300));
                DashboardSettings.UseDataDirectory(original);
            }
        });
        // Keep a failed run's isolated profile for diagnosis. No real user
        // profile is touched; the browser may release its files asynchronously.
    }

    private static void Add(WidgetHostController host, int type)
    {
        var count = Panels(host).Count;
        Complete(host.AddWidgetAsync(type));
        WpfTestHost.PumpUntil(() => Panels(host).Count == count + 1, TimeSpan.FromSeconds(15), "new native widget panel");
    }

    private static void AssertLauncherAddsWidget(WidgetHostController host, LauncherWindow launcher)
    {
        WaitForLauncher(launcher);
        WpfTestHost.PumpUntil(() => host.IsAvailable, TimeSpan.FromSeconds(30), "host after renderer recovery");
        var count = Panels(host).Count;
        Assert.True(Script(View(launcher), "(() => { const b = [...document.querySelectorAll('button')].find(b => /Timer/.test(b.textContent)); if (!b) return false; b.click(); return true; })()").GetBoolean());
        WpfTestHost.PumpUntil(() => Panels(host).Count == count + 1, TimeSpan.FromSeconds(15), "launcher to add Timer through the host");
    }

    private static void WaitForLauncher(LauncherWindow launcher)
        => WpfTestHost.PumpUntil(() => SafeBool(View(launcher), "document.querySelector('h1')?.textContent === 'Add a widget'"),
            TimeSpan.FromSeconds(30), "live launcher content");

    private static void WaitForTextArea(WebView2 view)
        => WpfTestHost.PumpUntil(() => SafeBool(view, "!!document.querySelector('textarea')"),
            TimeSpan.FromSeconds(15), "List textarea");

    private static void EnterText(WebView2 view, string text)
    {
        Script(view, $"(() => {{ const t = document.querySelector('textarea'); t.focus(); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, {JsonSerializer.Serialize(text)}); t.dispatchEvent(new Event('input', {{bubbles:true}})); }})()");
        WpfTestHost.DoEvents();
        Assert.Equal(text, Script(view, "document.querySelector('textarea').value").GetString());
    }

    private static void WaitForState(WidgetHostController host, string text)
        => WpfTestHost.PumpUntil(() => ListState(host) == text, TimeSpan.FromSeconds(15), $"host List state {text}");

    private static string? ListState(WidgetHostController host)
    {
        var list = Panels(host).Select(Descriptor).FirstOrDefault(d => d.SnapshotPayload.GetProperty("widgetType").GetInt32() == 2);
        if (list is null || !list.SnapshotPayload.TryGetProperty("state", out var state) || state.ValueKind != JsonValueKind.Object) return null;
        return state.TryGetProperty("inputs", out var inputs) && inputs.GetArrayLength() > 0 ? inputs[0].GetString() : null;
    }

    private static bool SafeBool(WebView2 view, string script)
    {
        try { return Script(view, script).ValueKind == JsonValueKind.True; }
        catch (Exception error) when (error is InvalidOperationException or System.Runtime.InteropServices.COMException or NullReferenceException) { return false; }
    }

    private static uint? BrowserId(WebView2 view)
    {
        try { return view.CoreWebView2?.BrowserProcessId; }
        catch (InvalidOperationException) { return null; }
    }

    private static JsonElement Script(WebView2 view, string script)
    {
        var task = view.CoreWebView2.ExecuteScriptAsync(script);
        Complete(task);
        using var document = JsonDocument.Parse(task.Result);
        return document.RootElement.Clone();
    }

    private static void Complete(Task task)
    {
        WpfTestHost.PumpUntil(() => task.IsCompleted, TimeSpan.FromSeconds(30), "native asynchronous operation");
        task.GetAwaiter().GetResult();
    }

    private static WebView2 View(object owner) => owner is WidgetPanelWindow panel ? panel.WebView : Field<WebView2>(owner, "_webView");
    private static WidgetPanelDescriptor Descriptor(WidgetPanelWindow panel) => Field<WidgetPanelDescriptor>(panel, "_descriptor");
    private static List<WidgetPanelWindow> Panels(WidgetHostController host)
        => Field<Dictionary<string, WidgetPanelWindow>>(host.Coordinator, "_panels").Values.ToList();
    private static T Field<T>(object owner, string name)
        => (T)owner.GetType().GetField(name, BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(owner)!;

    private static void Capture(string name, WebView2 view)
    {
        var directory = Environment.GetEnvironmentVariable("CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR");
        if (string.IsNullOrEmpty(directory)) return;
        Directory.CreateDirectory(directory);
        using var stream = File.Create(Path.Combine(directory, name));
        Complete(view.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, stream));
    }

    private static void Log(string message)
    {
        var line = $"{DateTime.UtcNow:O} {message}";
        Console.WriteLine(line);
        var directory = Environment.GetEnvironmentVariable("CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR");
        if (string.IsNullOrEmpty(directory)) return;
        Directory.CreateDirectory(directory);
        File.AppendAllText(Path.Combine(directory, "webview-recovery.log"), line + Environment.NewLine);
    }
}
