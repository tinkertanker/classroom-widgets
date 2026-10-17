using System.Runtime.InteropServices;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;

namespace ClassroomWidgets;

/// <summary>The panel's web view: loading it, its bridge messages and the scripts pushed into it.</summary>
public partial class WidgetPanelWindow
{
    /// <summary>
    /// Publishes the native link-shortener settings into this panel's web
    /// view. Values are JSON-serialized by <see cref="DashboardShortenerSettings"/>
    /// so credentials can never break out of the assignment.
    /// </summary>
    private void ApplyShortenerSettings()
    {
        if (!_webReady) return;
        _ = WebView.CoreWebView2.ExecuteScriptAsync(DashboardShortenerSettings.Script(_settings));
    }

    private void ApplyAudioSettings()
    {
        if (!_webReady) return;
        _ = WebView.CoreWebView2.ExecuteScriptAsync(DashboardAudioSettings.Script(_settings));
    }

    /// <summary>
    /// Asks the panel for any unsent state and waits for its writes checkpoint
    /// so nothing typed moments before a reload is lost.
    /// </summary>
    public async Task<(WidgetPanelStateChange? Change, bool Prepared)> TakePendingStateAsync()
    {
        if (!_webReady) return (null, true);
        _writesCheckpoint = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var scriptTask = DashboardWebView.EvaluateAsync(WebView, DesktopHostScripts.WidgetPanelTakePendingState);
        await Task.WhenAny(Task.WhenAll(scriptTask, _writesCheckpoint.Task), Task.Delay(900));
        var checkpoint = _writesCheckpoint;
        _writesCheckpoint = null;
        var prepared = checkpoint.Task.IsCompletedSuccessfully;
        // The script destructively consumes queued state. A missing checkpoint
        // still refuses preparation, but cannot discard a valid returned edit.
        if (!scriptTask.IsCompletedSuccessfully) return (null, false);

        var result = scriptTask.Result;
        if (result is null) return (null, false);
        if (result.Value.ValueKind == JsonValueKind.Null) return (null, prepared);
        var payload = result.Value;
        if (payload.ValueKind != JsonValueKind.Object
            || !payload.TryGetProperty("schemaVersion", out var schema) || !schema.TryGetInt32(out var schemaVersion) || schemaVersion != 1
            || !payload.TryGetProperty("widgetId", out var widgetId) || widgetId.GetString() != WidgetId
            || !payload.TryGetProperty("baseRevision", out var baseRevision) || baseRevision.ValueKind != JsonValueKind.Number
            || !payload.TryGetProperty("state", out _))
        {
            return (null, false);
        }

        using var flushed = JsonDocument.Parse(payload.GetRawText());
        var withFlush = new Dictionary<string, JsonElement>();
        foreach (var property in flushed.RootElement.EnumerateObject()) withFlush[property.Name] = property.Value.Clone();
        withFlush["flush"] = JsonSerializer.SerializeToElement(true);
        return (new WidgetPanelStateChange(WidgetId, JsonSerializer.SerializeToElement(withFlush)), prepared);
    }

    private async Task InitializeWebViewAsync()
    {
        if (_webReady || _closingPermanently) return;
        PerfMark("panel.init");
        try
        {
            await DashboardWebView.InitializeAsync(
                WebView,
                DashboardAudioSettings.Script(_settings));
        }
        catch (Exception error) when (error is WebView2RuntimeNotFoundException or COMException)
        {
            DashboardLog.Error($"Unable to start widget panel: {error.Message}");
            return;
        }
        if (_closingPermanently) return;
        PerfMark("panel.controller.ready");
        _webReady = true;
        WebView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
        WebView.CoreWebView2.NavigationCompleted += (_, args) =>
        {
            PerfMark("panel.navcompleted");
            // Mirror the macOS didFinish navigation behaviour: republish the
            // native shortener settings before the reloaded panel state.
            if (args.IsSuccess)
            {
                ApplyShortenerSettings();
                ApplyAudioSettings();
            }
            ApplyWebPresentation();
        };
        WebView.CoreWebView2.ProcessFailed += (_, args) =>
        {
            if (args.ProcessFailedKind is CoreWebView2ProcessFailedKind.RenderProcessExited or CoreWebView2ProcessFailedKind.RenderProcessUnresponsive)
            {
                DashboardLog.Error($"Widget panel {WidgetId} render process failed; reloading");
                LoadWidget();
            }
        };
        LoadWidget();
    }

    private void LoadWidget()
    {
        _panelReady = false;
        _lastPushedRevision = null;
        _lastPushedStateRevision = null;
        PerfMark("panel.navigate");
        WebView.CoreWebView2.Navigate(DashboardWebView.BuildUrl(new Dictionary<string, string>
        {
            ["surface"] = "widget-panel",
            ["widgetId"] = WidgetId,
            ["backgroundOpacity"] = OpacityText
        }));
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
            if (!body.TryGetProperty("handler", out var handler) || handler.GetString() != "classroomWidgetPanel") return;
            if (!body.TryGetProperty("type", out var typeValue) || typeValue.ValueKind != JsonValueKind.String) return;
            if (body.TryGetProperty("widgetId", out var requested) && requested.ValueKind == JsonValueKind.String && requested.GetString() != WidgetId) return;

            switch (typeValue.GetString())
            {
                case "open-settings":
                    OpenSettingsRequested?.Invoke();
                    break;
                case "panel-ready":
                    PerfMark("panel.ready");
                    _panelReady = true;
                    PushSnapshot(force: true);
                    break;
                case "panel-state-change":
                    if (!body.TryGetProperty("baseRevision", out var revision) || revision.ValueKind != JsonValueKind.Number) return;
                    if (!body.TryGetProperty("state", out _)) return;
                    PanelStateChanged?.Invoke(new WidgetPanelStateChange(WidgetId, StripFlush(body)));
                    break;
                case "randomiser-list-save":
                    if (!body.TryGetProperty("name", out var name) || string.IsNullOrWhiteSpace(name.GetString())) return;
                    if (!body.TryGetProperty("choices", out var choices) || choices.ValueKind != JsonValueKind.Array || choices.GetArrayLength() > 10_000) return;
                    RandomiserListChanged?.Invoke(body.Clone());
                    break;
                case "randomiser-list-delete":
                    if (!body.TryGetProperty("id", out var id) || string.IsNullOrEmpty(id.GetString())) return;
                    RandomiserListChanged?.Invoke(body.Clone());
                    break;
                case "panel-content-ready":
                    PerfMark("panel.content-ready");
                    break;
                case "panel-writes-checkpoint":
                    _writesCheckpoint?.TrySetResult();
                    break;
            }
        }
    }

    private static JsonElement StripFlush(JsonElement body)
    {
        var payload = new Dictionary<string, JsonElement>();
        foreach (var property in body.EnumerateObject())
        {
            if (property.Name is "flush" or "handler") continue;
            payload[property.Name] = property.Value.Clone();
        }
        return JsonSerializer.SerializeToElement(payload);
    }

    private void PushSnapshot(bool force = false)
    {
        if (!_webReady || !_panelReady) return;
        if (!force && _descriptor.Revision == _lastPushedRevision && _descriptor.StateRevision == _lastPushedStateRevision) return;
        _lastPushedRevision = _descriptor.Revision;
        _lastPushedStateRevision = _descriptor.StateRevision;
        if (force) PerfMark("panel.snapshot");
        var snapshot = _descriptor.SnapshotPayload.GetRawText();
        // Publish the native shortener settings ahead of the snapshot in the
        // same script so widgets read current preferences on their first
        // render, the way the macOS panel does.
        _ = DashboardWebView.EvaluateBoolAsync(WebView,
            DashboardShortenerSettings.Script(_settings)
            + DashboardAudioSettings.Script(_settings)
            + DesktopHostScripts.WidgetPanelReceiveSnapshot(snapshot));
    }

    private void ApplyWebPresentation()
    {
        if (!_webReady) return;
        _ = WebView.CoreWebView2.ExecuteScriptAsync(
            DesktopHostScripts.WidgetPanelChromeVisible(JsonSerializer.Serialize(_chromeVisible ? "true" : "false"))
            + DesktopHostScripts.WidgetPanelBackgroundOpacity(JsonSerializer.Serialize(OpacityText)));
    }

    private string OpacityText => _backgroundOpacity.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture);
}
