using System.ComponentModel;
using System.Text.Json;
using System.Windows;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace ClassroomWidgets;

public sealed class LauncherWindow
{
    private readonly Window _window;
    private readonly WebView2 _webView;
    private readonly Action<int> _addWidget;
    private bool _initializing;
    private bool _initialized;
    private bool _ready;

    public LauncherWindow(Action<int> addWidget)
    {
        _addWidget = addWidget;
        _webView = new WebView2();
        _window = new Window
        {
            Title = "Add Widget — Classroom Widgets",
            Width = 850,
            Height = 580,
            MinWidth = 700,
            MinHeight = 540,
            WindowStartupLocation = WindowStartupLocation.CenterScreen,
            Background = System.Windows.Media.Brushes.White,
            Content = _webView
        };
        _window.Closing += OnClosing;
    }

    public void Show()
    {
        ShowWindow();
        if (_ready) return;
        if (!_initializing) _ = InitializeAsync();
    }

    public void Hide()
    {
        _window.Hide();
    }

    private async Task InitializeAsync()
    {
        _initializing = true;
        try
        {
            if (!_initialized)
            {
                await DashboardWebView.InitializeAsync(_webView, string.Empty);
                var initializedCore = _webView.CoreWebView2;
                initializedCore.WebMessageReceived += OnWebMessageReceived;
                initializedCore.NavigationCompleted += OnNavigationCompleted;
                _initialized = true;
            }
            var core = _webView.CoreWebView2;
            core.Navigate(DashboardWebView.BuildUrl(new Dictionary<string, string>
            {
                ["surface"] = "widget-launcher"
            }));
        }
        catch (Exception error) when (error is WebView2RuntimeNotFoundException or System.Runtime.InteropServices.COMException)
        {
            DashboardLog.Error($"Unable to open widget launcher: {error.Message}");
            _initializing = false;
        }
    }

    private void OnNavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs args)
    {
        _initializing = false;
        if (!args.IsSuccess)
        {
            DashboardLog.Error($"Widget launcher navigation failed: {args.WebErrorStatus}");
            return;
        }
        _ready = true;
    }

    private void ShowWindow()
    {
        if (_window.WindowState == WindowState.Minimized) _window.WindowState = WindowState.Normal;
        _window.Show();
        _window.Activate();
    }

    private void OnClosing(object? sender, CancelEventArgs args)
    {
        if (App.IsShuttingDown) return;
        args.Cancel = true;
        Hide();
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
            if (body.ValueKind != JsonValueKind.Object
                || !body.TryGetProperty("handler", out var handler) || handler.ValueKind != JsonValueKind.String || handler.GetString() != "classroomDashboard"
                || !body.TryGetProperty("schemaVersion", out var schemaVersion) || schemaVersion.ValueKind != JsonValueKind.Number || !schemaVersion.TryGetInt32(out var version) || version != 1
                || !body.TryGetProperty("type", out var type) || type.ValueKind != JsonValueKind.String) return;

            if (type.GetString() == "desktop-launcher-close")
            {
                Hide();
                return;
            }
            if (type.GetString() == "desktop-launcher-add-widget"
                && body.TryGetProperty("widgetType", out var widgetType)
                && widgetType.ValueKind == JsonValueKind.Number
                && widgetType.TryGetInt32(out var value))
            {
                _addWidget(value);
            }
        }
    }
}
