using System.Text.Json;
using System.Windows;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace ClassroomWidgets;

/// <summary>
/// Owns the authoritative React/Zustand widget store inside an off-screen
/// WebView2 without presenting it. Visible widgets are created only by the
/// <see cref="WidgetPanelCoordinator"/> in response to host inventories.
/// </summary>
public sealed class WidgetHostController
{
    private readonly Window _hostWindow;
    private WebView2 _webView;
    private readonly DashboardSettings _settings;
    private readonly WidgetPanelCoordinator _coordinator;
    private readonly HostWriteTracker _hostWrites = new();
    private IReadOnlyList<WidgetPanelStateChange>? _pendingRecoveryChanges;
    private Task<(IReadOnlyList<WidgetPanelStateChange> Changes, bool Prepared)>? _panelPreparation;
    private int _hostFailureGeneration;
    private int _recoveryReplayGeneration = -1;
    private bool _reloadInProgress;
    private bool _recoveryInProgress;
    private bool _hostFailurePending;
    private bool _browserReplacementPending;
    private bool _initialized;

    public IReadOnlyList<CompactWidgetOption> WidgetOptions { get; private set; } = Array.Empty<CompactWidgetOption>();
    public bool IsAvailable { get; private set; }
    public event Action? WidgetOptionsChanged;
    public event Action? OpenSettingsRequested;

    public WidgetPanelCoordinator Coordinator => _coordinator;

    public WidgetHostController(DashboardSettings settings)
    {
        _settings = settings;
        _coordinator = new WidgetPanelCoordinator(settings);
        _coordinator.PanelStateChanged += change => _ = ApplyPanelStateChangeAsync(change);
        _coordinator.RandomiserListChanged += change => _ = ApplyRandomiserListChangeAsync(change);
        _coordinator.WidgetCreationRequested += widgetType => _ = AddWidgetAsync(widgetType);
        _coordinator.WidgetRemovalRequested += widgetId => _ = RemoveWidgetAsync(widgetId);
        _coordinator.OpenSettingsRequested += () => OpenSettingsRequested?.Invoke();

        _webView = new WebView2();
        _hostWindow = new Window
        {
            Title = "Classroom Widgets Host",
            Width = 1280,
            Height = 800,
            Left = -32000,
            Top = -32000,
            ShowInTaskbar = false,
            ShowActivated = false,
            WindowStyle = WindowStyle.None,
            ResizeMode = ResizeMode.NoResize,
            Content = _webView
        };
        _hostWindow.Closing += (_, args) => args.Cancel = !App.IsShuttingDown;
    }

    public async Task StartAsync()
    {
        _hostWindow.Show();
        try
        {
            await InitializeWebViewAsync();
        }
        catch (Exception error) when (error is WebView2RuntimeNotFoundException or System.Runtime.InteropServices.COMException)
        {
            DashboardLog.Error($"WebView2 unavailable: {error.Message}");
            MessageBox.Show(
                "Classroom Widgets needs the Microsoft Edge WebView2 Runtime. Install it from https://developer.microsoft.com/microsoft-edge/webview2/ and launch the app again.",
                "Classroom Widgets",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
            Application.Current.Shutdown();
            return;
        }

        LoadHost();
    }

    private async Task InitializeWebViewAsync()
    {
        await DashboardWebView.InitializeAsync(_webView, DashboardAudioSettings.Script(_settings));
        var core = _webView.CoreWebView2;
        core.WebMessageReceived += OnWebMessageReceived;
        core.ProcessFailed += OnProcessFailed;
        core.NavigationCompleted += (_, args) =>
        {
            if (!args.IsSuccess)
            {
                DashboardLog.Error($"Widget host navigation failed: {args.WebErrorStatus}");
                return;
            }
            // Republish after every (re)load so the host store sees the same
            // shortener preferences as the visible panels, mirroring the
            // macOS didFinish navigation behaviour.
            _ = core.ExecuteScriptAsync(DashboardShortenerSettings.Script(_settings));
            _ = core.ExecuteScriptAsync(DashboardAudioSettings.Script(_settings));
        };
        _initialized = true;
    }

    public void ApplySettings()
    {
        _coordinator.ApplyPresentationSettings(_settings.BackgroundOpacity, _settings.AlwaysOnTop);
        if (_initialized)
        {
            _ = _webView.CoreWebView2.ExecuteScriptAsync(
                $"window.classroomDashboard?.setBackgroundOpacity?.({_settings.BackgroundOpacity.ToString(System.Globalization.CultureInfo.InvariantCulture)})");
            _ = _webView.CoreWebView2.ExecuteScriptAsync(DashboardShortenerSettings.Script(_settings));
            _ = _webView.CoreWebView2.ExecuteScriptAsync(DashboardAudioSettings.Script(_settings));
        }
    }

    public async Task AddWidgetAsync(int widgetType)
    {
        if (!_initialized || !IsAvailable) return;
        var applied = await DashboardWebView.EvaluateBoolAsync(_webView,
            $"(() => {{ const host = window.classroomPanelHost; return host?.addWidget ? host.addWidget({widgetType}) : false; }})()");
        if (!applied) DashboardLog.Warn($"Host refused to add widget type {widgetType}");
    }

    public async Task ShowWidgetAsync(int widgetType)
    {
        if (!_initialized || !IsAvailable) return;
        await DashboardWebView.EvaluateBoolAsync(_webView,
            $"(() => {{ const host = window.classroomPanelHost; return host?.showWidget ? host.showWidget({widgetType}) : false; }})()");
    }

    public async Task DismissWidgetAsync(int widgetType)
    {
        if (!_initialized || !IsAvailable) return;
        await DashboardWebView.EvaluateBoolAsync(_webView,
            $"(() => {{ const host = window.classroomPanelHost; return host?.dismissWidget ? host.dismissWidget({widgetType}) : false; }})()");
    }

    public async Task ToggleWidgetAsync(int widgetType)
    {
        if (!_initialized || !IsAvailable) return;
        await DashboardWebView.EvaluateBoolAsync(_webView,
            $"(() => {{ const host = window.classroomPanelHost; return host?.toggleWidget ? host.toggleWidget({widgetType}) : false; }})()");
    }

    public void MoveSelectedWidget(MoveDirection direction) => _coordinator.MoveSelectedPanel(direction);

    public async Task ReloadWidgetsAsync()
    {
        if (_hostFailurePending)
        {
            if (!_reloadInProgress) await RecoverFromHostFailureAsync();
            return;
        }
        if (_reloadInProgress || !_initialized) return;
        IsAvailable = false;
        _reloadInProgress = true;
        _panelPreparation = _coordinator.PrepareForDeactivationAsync();
        var (changes, prepared) = await _panelPreparation;
        if (_hostFailurePending) return; // Recovery owns this collection now.
        // Collection consumes each healthy panel's queued edit even when
        // another panel misses its checkpoint. Preserve those edits first.
        var applied = await ApplyFinalPanelStateChangesAsync(changes);
        if (_hostFailurePending) return;
        if (!prepared || !applied)
        {
            ResumeAfterFailedDeactivation();
            return;
        }
        _coordinator.Deactivate();
        _panelPreparation = null;
        _hostWrites.Reset();
        LoadHost();
    }

    /// <summary>
    /// Flushes any pending panel writes into the host store so the web app can
    /// persist them before the process exits. Returns false when a write could
    /// not be confirmed within the time budget.
    /// </summary>
    public async Task<bool> PrepareForTerminationAsync()
    {
        _coordinator.FlushPersistedFrames();
        if (_hostFailurePending) return false;
        if (!_initialized || _reloadInProgress) return !_initialized;
        IsAvailable = false;
        _reloadInProgress = true;

        var preparation = _panelPreparation = _coordinator.PrepareForDeactivationAsync();
        if (await Task.WhenAny(preparation, Task.Delay(2000)) != preparation)
        {
            ResumeAfterFailedDeactivation();
            return false;
        }
        var (changes, prepared) = preparation.Result;
        if (_hostFailurePending) return false;

        for (var attempt = 0; attempt <= 20; attempt++)
        {
            var apply = ApplyFinalPanelStateChangesAsync(changes);
            var completed = await Task.WhenAny(apply, Task.Delay(1000));
            if (_hostFailurePending) return false;
            if (completed == apply && apply.Result)
            {
                if (!prepared)
                {
                    ResumeAfterFailedDeactivation();
                    return false;
                }
                _coordinator.Deactivate();
                _panelPreparation = null;
                return true;
            }
            if (!prepared) break;
            await Task.Delay(150);
        }
        ResumeAfterFailedDeactivation();
        return false;
    }

    private void ResumeAfterFailedDeactivation()
    {
        if (_hostFailurePending) return;
        _hostWrites.AcknowledgeFailure();
        _panelPreparation = null;
        _reloadInProgress = false;
        _coordinator.Deactivate();
        _coordinator.Activate();
        IsAvailable = true;
    }

    private void LoadHost()
    {
        IsAvailable = false;
        var url = DashboardWebView.BuildUrl(new Dictionary<string, string>
        {
            ["dashboard"] = "1",
            ["visible"] = "0",
            ["mode"] = "compact",
            ["backgroundOpacity"] = _settings.BackgroundOpacity.ToString(System.Globalization.CultureInfo.InvariantCulture)
        });
        _webView.CoreWebView2.Navigate(url);
    }

    private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs args)
    {
        if (!DashboardWebView.IsAllowed(args.Source)) return;
        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(args.WebMessageAsJson);
        }
        catch (JsonException)
        {
            return;
        }

        using (document)
        {
            var body = document.RootElement;
            if (body.ValueKind != JsonValueKind.Object) return;
            if (!body.TryGetProperty("handler", out var handler) || handler.GetString() != "classroomDashboard") return;
            if (!body.TryGetProperty("type", out var type) || type.GetString() != "widget-panels-changed") return;

            var inventory = WidgetPanelInventory.FromMessage(body);
            if (inventory is null)
            {
                DashboardLog.Warn("Ignoring malformed widget inventory");
                return;
            }
            ReconcileWidgetPanels(inventory);
        }
    }

    private void OnProcessFailed(object? sender, CoreWebView2ProcessFailedEventArgs args)
    {
        if (args.ProcessFailedKind is not (CoreWebView2ProcessFailedKind.BrowserProcessExited or CoreWebView2ProcessFailedKind.RenderProcessExited or CoreWebView2ProcessFailedKind.RenderProcessUnresponsive))
        {
            return;
        }
        DashboardLog.Error($"Widget host process failed ({args.ProcessFailedKind}); reloading");
        IsAvailable = false;
        _hostFailurePending = true;
        _hostFailureGeneration++;
        if (args.ProcessFailedKind == CoreWebView2ProcessFailedKind.BrowserProcessExited)
        {
            _initialized = false;
            // A browser exit can arrive while renderer recovery is awaiting
            // panel checkpoints. The active recovery must replace that control.
            _browserReplacementPending = true;
        }
        // Finish WebView2's failure callback before disposing its closed control.
        _hostWindow.Dispatcher.BeginInvoke(new Action(() => _ = RecoverFromHostFailureAsync()));
    }

    /// <summary>
    /// Panels outlive a crashed host, so their unsent edits are collected first
    /// and replayed once the replacement host publishes its inventory.
    /// </summary>
    private async Task RecoverFromHostFailureAsync()
    {
        if (_recoveryInProgress) return;
        _recoveryInProgress = true;
        _reloadInProgress = true;
        var hostLoaded = false;
        try
        {
            for (var attempt = 0; attempt < 3; attempt++)
            {
                try
                {
                    if (_pendingRecoveryChanges is null)
                    {
                        // Reload/quit may already have consumed the panels' edits.
                        // Await that same collection before closing their WebViews.
                        _panelPreparation ??= _coordinator.PrepareForDeactivationAsync();
                        var (changes, _) = await _panelPreparation;
                        _pendingRecoveryChanges = changes;
                        _panelPreparation = null;
                    }
                    _hostWrites.Reset();
                    _coordinator.Deactivate();
                    if (_browserReplacementPending)
                    {
                        _browserReplacementPending = false;
                        var closed = _webView;
                        _webView = new WebView2();
                        _hostWindow.Content = _webView;
                        closed.Dispose();
                        await InitializeWebViewAsync();
                    }
                    LoadHost();
                    hostLoaded = true;
                    return;
                }
                catch (Exception error) when (error is not OutOfMemoryException)
                {
                    // SDK errors can surface as .NET exceptions, not just COM.
                    // Preserve replacement ownership and collected edits.
                    _initialized = false;
                    _browserReplacementPending = true;
                    DashboardLog.Error($"Unable to recover widget host: {error.Message}");
                }
                if (attempt < 2) await Task.Delay(1000);
            }
            _reloadInProgress = false;
            DashboardLog.Warn("Automatic widget host recovery stopped after 3 attempts; use Reload Widgets to retry");
        }
        finally
        {
            _recoveryInProgress = false;
            if (hostLoaded && _browserReplacementPending)
                _ = _hostWindow.Dispatcher.BeginInvoke(new Action(() => _ = RecoverFromHostFailureAsync()));
        }
    }

    private void ReconcileWidgetPanels(WidgetPanelInventory inventory)
    {
        if (!_coordinator.Reconcile(inventory)) return;
        IsAvailable = true;
        if (inventory.Options is not null && !inventory.Options.SequenceEqual(WidgetOptions))
        {
            WidgetOptions = inventory.Options;
            _coordinator.SetWidgetCreationOptions(inventory.Options);
            WidgetOptionsChanged?.Invoke();
        }
        if (_pendingRecoveryChanges is { } recovery)
        {
            // Keep the buffer reachable if another failure interrupts replay;
            // inventories from the replay itself must not start a second one.
            if (_recoveryReplayGeneration != _hostFailureGeneration)
            {
                _recoveryReplayGeneration = _hostFailureGeneration;
                var widgetIds = inventory.Widgets.Select(widget => widget.Id).ToHashSet();
                _ = FinishRecoveryAsync(recovery.Where(change => widgetIds.Contains(change.WidgetId)).ToList(), _hostFailureGeneration);
            }
            return;
        }
        _reloadInProgress = false;
        _hostFailurePending = false;
        _coordinator.Activate();
    }

    private async Task FinishRecoveryAsync(IReadOnlyList<WidgetPanelStateChange> changes, int generation)
    {
        for (var attempt = 0; attempt <= 20; attempt++)
        {
            if (generation != _hostFailureGeneration) return;
            var applied = await ApplyFinalPanelStateChangesAsync(changes);
            if (generation != _hostFailureGeneration) return;
            if (applied) break;
            await Task.Delay(150);
        }
        if (generation != _hostFailureGeneration) return;
        _pendingRecoveryChanges = null;
        _reloadInProgress = false;
        _hostFailurePending = false;
        _coordinator.Activate();
    }

    private async Task<bool> ApplyPanelStateChangeAsync(WidgetPanelStateChange change)
    {
        if (!_initialized) return false;
        var payload = change.Payload.GetRawText();
        return await DashboardWebView.EvaluateBoolAsync(_webView,
            $"(() => {{ const host = window.classroomPanelHost; return host?.applyStateChange ? host.applyStateChange({payload}) : false; }})()");
    }

    private async Task ApplyRandomiserListChangeAsync(JsonElement change)
    {
        if (!_initialized) return;
        var generation = _hostWrites.Begin();
        var applied = false;
        try
        {
            applied = await DashboardWebView.EvaluateBoolAsync(_webView,
                $"(() => {{ const host = window.classroomPanelHost; return host?.applyRandomiserListChange ? host.applyRandomiserListChange({change.GetRawText()}) : false; }})()");
        }
        finally
        {
            _hostWrites.Finish(applied, generation);
        }
        if (!applied) DashboardLog.Warn("Host refused Randomiser collection change; the next deactivation attempt will be refused");
    }

    private async Task RemoveWidgetAsync(string widgetId)
    {
        if (!_initialized) return;
        var idJson = JsonSerializer.Serialize(widgetId);
        await DashboardWebView.EvaluateBoolAsync(_webView,
            $"(() => {{ const host = window.classroomPanelHost; return host?.removeWidget ? host.removeWidget({idJson}) : false; }})()");
    }

    private async Task<bool> ApplyFinalPanelStateChangesAsync(IReadOnlyList<WidgetPanelStateChange> changes)
    {
        var allApplied = true;
        foreach (var change in changes)
        {
            allApplied &= await ApplyPanelStateChangeAsync(change);
        }
        return allApplied && await _hostWrites.WaitAsync();
    }
}
