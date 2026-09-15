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
    private bool _ready;
    private bool _showWhenReady;

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
        _showWhenReady = true;
        if (_ready)
        {
            ShowReadyWindow();
            return;
        }
        if (!_initializing) _ = InitializeAsync();
    }

    public void Hide()
    {
        _showWhenReady = false;
        _window.Hide();
    }

    private async Task InitializeAsync()
    {
        _initializing = true;
        try
        {
            await DashboardWebView.InitializeAsync(_webView, string.Empty);
            var core = _webView.CoreWebView2;
            core.WebMessageReceived += OnWebMessageReceived;
            core.NavigationCompleted += (_, args) =>
            {
                if (!args.IsSuccess)
                {
                    DashboardLog.Error($"Widget launcher navigation failed: {args.WebErrorStatus}");
                    return;
                }
                _ready = true;
                if (_showWhenReady) ShowReadyWindow();
            };
            core.Navigate(DashboardWebView.BuildUrl(new Dictionary<string, string>
            {
                ["surface"] = "widget-launcher"
            }));
        }
        catch (Exception error) when (error is WebView2RuntimeNotFoundException or System.Runtime.InteropServices.COMException)
        {
            DashboardLog.Error($"Unable to open widget launcher: {error.Message}");
        }
        finally
        {
            _initializing = false;
        }
    }

    private void ShowReadyWindow()
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
                || !body.TryGetProperty("handler", out var handler) || handler.GetString() != "classroomDashboard"
                || !body.TryGetProperty("schemaVersion", out var schemaVersion) || !schemaVersion.TryGetInt32(out var version) || version != 1
                || !body.TryGetProperty("type", out var type)) return;

            if (type.GetString() == "desktop-launcher-close")
            {
                Hide();
                return;
            }
            if (type.GetString() == "desktop-launcher-add-widget"
                && body.TryGetProperty("widgetType", out var widgetType)
                && widgetType.TryGetInt32(out var value))
            {
                _addWidget(value);
            }
        }
    }
}
