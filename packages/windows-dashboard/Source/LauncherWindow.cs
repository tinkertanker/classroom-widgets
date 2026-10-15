using System.ComponentModel;
using System.Text.Json;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Threading;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace ClassroomWidgets;

public sealed class LauncherWindow
{
    private readonly Window _window;
    private WebView2 _webView;
    private readonly Action<int> _addWidget;
    private readonly Action _openDisplayPreview;
    private bool _initializing;
    private bool _initialized;
    private bool _ready;
    private bool _replaceWebView;
    private Window? _staging;

    public LauncherWindow(Action<int> addWidget, Action openDisplayPreview)
    {
        _addWidget = addWidget;
        _openDisplayPreview = openDisplayPreview;
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
        if (PerfLog.Enabled) _window.ContentRendered += (_, _) => PerfLog.Mark("launcher.rendered");
    }

    /// <summary>
    /// Starts loading the launcher page while the widget host is still
    /// loading, so a launcher requested at startup opens already painted. The
    /// web view loads in a <see cref="WebViewStaging"/> window until
    /// <see cref="Show"/> moves it into the launcher.
    /// </summary>
    public void Preload()
    {
        if (_initialized || _initializing || _staging is not null) return;
        // Creating the launcher's native window now also leaves less for Show.
        new WindowInteropHelper(_window).EnsureHandle();
        var staging = WebViewStaging.CreateWindow(_window.Title, _window.Width, _window.Height);
        new WindowInteropHelper(staging).EnsureHandle();
        if (!WebViewStaging.SameDpi(staging, _window))
        {
            staging.Close();
            return;
        }
        _window.Content = null;
        staging.Content = _webView;
        _staging = staging;
        staging.Show();
        _ = InitializeAsync();
    }

    public void Show()
    {
        PerfLog.Mark("launcher.show");
        AdoptPreloadedWebView();
        ShowWindow();
        if (_ready) return;
        if (!_initializing) _ = InitializeAsync();
    }

    private void AdoptPreloadedWebView()
    {
        if (_staging is not { } staging) return;
        _staging = null;
        staging.Content = null;
        _window.Content = _webView;
        // Closed once the launcher has re-parented the web view's native window.
        _window.Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(staging.Close));
    }

    public void Hide()
    {
        _window.Hide();
    }

    private async Task InitializeAsync()
    {
        _initializing = true;
        _ready = false;
        try
        {
            if (_replaceWebView)
            {
                var closed = _webView;
                _webView = new WebView2();
                (_staging ?? _window).Content = _webView;
                closed.Dispose();
                _replaceWebView = false;
                _initialized = false;
            }
            if (!_initialized)
            {
                PerfLog.Mark("launcher.init");
                await DashboardWebView.InitializeAsync(_webView, string.Empty);
                PerfLog.Mark("launcher.controller.ready");
                var initializedCore = _webView.CoreWebView2;
                initializedCore.WebMessageReceived += OnWebMessageReceived;
                initializedCore.NavigationCompleted += OnNavigationCompleted;
                initializedCore.ProcessFailed += OnProcessFailed;
                _initialized = true;
            }
            var core = _webView.CoreWebView2;
            PerfLog.Mark("launcher.navigate");
            core.Navigate(DashboardWebView.BuildUrl(new Dictionary<string, string>
            {
                ["surface"] = "widget-launcher"
            }));
        }
        catch (Exception error) when (error is WebView2RuntimeNotFoundException or InvalidOperationException or System.Runtime.InteropServices.COMException)
        {
            DashboardLog.Error($"Unable to open widget launcher: {error.Message}");
            _initializing = false;
        }
    }

    private void OnProcessFailed(object? sender, CoreWebView2ProcessFailedEventArgs args)
    {
        if (args.ProcessFailedKind is not (CoreWebView2ProcessFailedKind.BrowserProcessExited
            or CoreWebView2ProcessFailedKind.RenderProcessExited or CoreWebView2ProcessFailedKind.RenderProcessUnresponsive)) return;
        DashboardLog.Error($"Widget launcher process failed ({args.ProcessFailedKind}); reloading");
        _ready = false;
        _initializing = false;
        _replaceWebView |= args.ProcessFailedKind == CoreWebView2ProcessFailedKind.BrowserProcessExited;
        _window.Dispatcher.BeginInvoke(new Action(() =>
        {
            if (!_initializing) _ = InitializeAsync();
        }));
    }

    private void OnNavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs args)
    {
        _initializing = false;
        PerfLog.Mark("launcher.navcompleted");
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
                PerfLog.Mark("launcher.add-widget", widgetType: value);
                _addWidget(value);
                return;
            }
            if (type.GetString() == "desktop-launcher-open-display-preview")
            {
                _openDisplayPreview();
            }
        }
    }
}
