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
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void BrowserCrashRestoresHostPanelsAndLauncherWithSavedList(bool duringRendererRecovery)
        => WithBrowser((host, launcher) =>
        {
            Add(host, 2);
            var list = Panels(host).Single();
            WaitForTextArea(View(list));
            EnterText(View(list), "Saved before browser crash");
            WaitForState(host, "Saved before browser crash");
            // Let the page's debounce and Chromium's disk commit finish;
            // this scenario kills the browser, not just its renderer.
            WpfTestHost.PumpFor(TimeSpan.FromSeconds(7));
            var browserId = View(host).CoreWebView2.BrowserProcessId;
            var overlappedRecovery = false;
            if (duringRendererRecovery)
            {
                // Keep collection open for the real 900ms checkpoint timeout;
                // healthy acknowledgements can finish within one dispatcher pump.
                Script(View(list), "window.classroomWidgetPanel.takePendingState = () => null;");
                var rendererFailed = false;
                View(host).CoreWebView2.ProcessFailed += (_, args) =>
                {
                    rendererFailed |= args.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessExited;
                    if (args.ProcessFailedKind != CoreWebView2ProcessFailedKind.BrowserProcessExited) return;
                    overlappedRecovery = Field<bool>(host, "_recoveryInProgress");
                    Log($"D11 BrowserProcessExited during active recovery: {overlappedRecovery}");
                };
                var crash = View(host).CoreWebView2.CallDevToolsProtocolMethodAsync("Page.crash", "{}");
                _ = crash.ContinueWith(task => _ = task.Exception, TaskContinuationOptions.OnlyOnFaulted);
                WpfTestHost.PumpUntil(() => rendererFailed && Field<bool>(host, "_recoveryInProgress"),
                    TimeSpan.FromSeconds(15), "host collecting checkpoints after renderer failure");
                Log("D11 browser exit injected while renderer recovery is collecting checkpoints");
            }
            Log($"D11 killing owned browser PID {browserId}");
            using (var process = Process.GetProcessById((int)browserId)) process.Kill();
            WpfTestHost.PumpUntil(() => host.IsAvailable && BrowserId(View(host)) is { } id && id != browserId,
                TimeSpan.FromSeconds(30), "a replacement browser and host inventory");
            if (duringRendererRecovery) Assert.True(overlappedRecovery, "Fixture must exercise browser exit during active recovery.");
            WaitForState(host, "Saved before browser crash");
            var restored = Panels(host).Single();
            WaitForListText(View(restored), "Saved before browser crash");
            var suffix = duringRendererRecovery ? "during-recovery" : "idle";
            Capture($"browser-recovered-list-{suffix}.png", View(restored));
            AssertLauncherAddsWidget(host, launcher, $"browser-recovered-launcher-{suffix}.png");
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
            AssertLauncherAddsWidget(host, launcher, "renderer-recovered-launcher.png");
            Log("D12 reopened launcher added Timer through its actual web bridge");
        });

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void FailedCheckpointPreservesAnotherPanelsLatestQueuedEdit(bool terminating)
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
            if (terminating)
            {
                var preparation = host.PrepareForTerminationAsync();
                Complete(preparation);
                Assert.False(preparation.Result);
            }
            else Complete(host.ReloadWidgetsAsync());
            WaitForState(host, "ABC");
            var restored = Panels(host).Single(panel => Descriptor(panel).SnapshotPayload.GetProperty("widgetType").GetInt32() == 2);
            WaitForListText(View(restored), "ABC");
            Capture($"failed-checkpoint-preserved-list-{(terminating ? "quit" : "reload")}.png", View(restored));
            Log($"D13 refused {(terminating ? "quit" : "reload")} preserved ABC in both host inventory and rendered List");
        });

    // A failure must not dispose a panel while another operation is consuming
    // its edit. Browser exit also removes the checkpoint sender, so a valid
    // returned edit must survive even when that checkpoint cannot arrive.
    [Theory]
    [InlineData(false, false)]
    [InlineData(true, false)]
    [InlineData(false, true)]
    [InlineData(true, true)]
    public void HostFailureDuringUserPreparationPreservesConsumedEdit(bool terminating, bool browserExit)
        => WithBrowser((host, launcher) =>
        {
            Add(host, 2);
            var list = Panels(host).Single();
            WaitForTextArea(View(list));
            EnterText(View(list), "A");
            WaitForState(host, "A");
            Script(View(list), "window.classroomWidgetPanel.receiveSnapshot = () => {};");
            EnterText(View(list), "AB");
            WaitForState(host, "AB");
            // Persist the old host value before a real process crash. ABC is
            // deliberately still queued in the actual List, not in the host.
            WpfTestHost.PumpFor(TimeSpan.FromSeconds(7));
            EnterText(View(list), "ABC");
            Assert.Equal("AB", ListState(host));
            Script(View(list), """
                (() => {
                    const post = window.chrome.webview.postMessage.bind(window.chrome.webview);
                    window.chrome.webview.postMessage = message => {
                        if (message.type === 'panel-writes-checkpoint') setTimeout(() => post(message), 600);
                        else post(message);
                    };
                    const take = window.classroomWidgetPanel.takePendingState;
                    window.classroomWidgetPanel.takePendingState = () => {
                        const change = take();
                        window.__consumedEdit = change?.state?.inputs?.[0];
                        return change;
                    };
                })()
                """);
            var oldInstance = Field<WidgetPanelInventory>(host.Coordinator, "_lastInventory").HostInstanceId;
            var browserId = View(host).CoreWebView2.BrowserProcessId;
            var failedDuringPreparation = false;
            View(host).CoreWebView2.ProcessFailed += (_, args) =>
            {
                var expected = browserExit ? CoreWebView2ProcessFailedKind.BrowserProcessExited
                    : CoreWebView2ProcessFailedKind.RenderProcessExited;
                if (args.ProcessFailedKind != expected) return;
                failedDuringPreparation = Field<bool>(host, "_reloadInProgress");
                Log($"preparation race {terminating}/{browserExit}: {expected}, preparation active={failedDuringPreparation}");
            };
            Task<bool>? quit = terminating ? host.PrepareForTerminationAsync() : null;
            var preparation = (Task?)quit ?? host.ReloadWidgetsAsync();
            WpfTestHost.PumpUntil(() => SafeBool(View(list), "window.__consumedEdit === 'ABC'"),
                TimeSpan.FromSeconds(10), "real destructive List collection to return ABC");
            Assert.False(preparation.IsCompleted, "Failure must overlap pending preparation.");
            Assert.False(Field<TaskCompletionSource>(list, "_writesCheckpoint").Task.IsCompleted,
                "Fixture must withhold the checkpoint until after failure injection.");
            Log($"preparation race {terminating}/{browserExit}: host AB, consumed ABC, checkpoint pending");
            if (browserExit)
            {
                using var process = Process.GetProcessById((int)browserId);
                process.Kill();
            }
            else
            {
                var crash = View(host).CoreWebView2.CallDevToolsProtocolMethodAsync("Page.crash", "{}");
                _ = crash.ContinueWith(task => _ = task.Exception, TaskContinuationOptions.OnlyOnFaulted);
            }
            WpfTestHost.PumpUntil(() => failedDuringPreparation, TimeSpan.FromSeconds(15), "actual host failure during preparation");
            Complete(preparation);
            if (quit is not null) Assert.False(quit.Result, "Interrupted quit preparation must not report success.");
            WpfTestHost.PumpUntil(() => host.IsAvailable && Panels(host).Count == 1
                && Field<WidgetPanelInventory>(host.Coordinator, "_lastInventory").HostInstanceId != oldInstance,
                TimeSpan.FromSeconds(30), "replacement host after interrupted preparation");
            WaitForState(host, "ABC");
            var restored = Panels(host).Single();
            WaitForListText(View(restored), "ABC");
            Capture($"preparation-race-{(terminating ? "quit" : "reload")}-{(browserExit ? "browser" : "renderer")}.png", View(restored));
            Log($"preparation race {terminating}/{browserExit}: recovered ABC in host and rendered List");
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
            // Like App: return from WebMessageReceived before awaiting its
            // host operation, rather than re-entering WebView2's event loop.
            var launcher = new LauncherWindow(type => _ = host.AddWidgetAsync(type), () => { });
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

    private static void AssertLauncherAddsWidget(WidgetHostController host, LauncherWindow launcher, string captureName)
    {
        WaitForLauncher(launcher);
        WpfTestHost.PumpUntil(() => host.IsAvailable, TimeSpan.FromSeconds(30), "host after renderer recovery");
        // The actual add action closes the launcher; capture it while visible.
        Capture(captureName, View(launcher));
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

    private static void WaitForListText(WebView2 view, string text)
        => WpfTestHost.PumpUntil(() => SafeBool(view,
            $"[...document.querySelectorAll('textarea')].some(t => t.value === {JsonSerializer.Serialize(text)}) || [...document.querySelectorAll('div')].some(d => d.childElementCount === 0 && d.textContent === {JsonSerializer.Serialize(text)})"),
            TimeSpan.FromSeconds(15), $"rendered List text {text}");

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
