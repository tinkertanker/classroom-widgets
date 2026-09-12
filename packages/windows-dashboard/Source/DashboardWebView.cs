using System.Diagnostics;
using System.IO;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace ClassroomWidgets;

/// <summary>
/// Shared WebView2 environment plus the wiring every surface needs: the
/// bundled teacher build mapped onto a fixed virtual origin, navigation locked
/// to that origin, and the platform flags the web app reads at start-up.
/// </summary>
public static class DashboardWebView
{
    public const string VirtualHost = "app.classroomwidgets";
    public static readonly string Origin = $"https://{VirtualHost}";

    private static Task<CoreWebView2Environment>? _environment;

    public static Task<CoreWebView2Environment> Environment => _environment ??= CreateEnvironment();

    private static Task<CoreWebView2Environment> CreateEnvironment()
    {
        var userDataFolder = Path.Combine(DashboardSettings.DataDirectory, "WebView2");
        Directory.CreateDirectory(userDataFolder);
        var arguments = "--autoplay-policy=no-user-gesture-required";
        var debugPort = System.Environment.GetEnvironmentVariable("CLASSROOM_WIDGETS_DEBUG_PORT");
        if (int.TryParse(debugPort, out var port) && port > 0) arguments += $" --remote-debugging-port={port}";
        var options = new CoreWebView2EnvironmentOptions { AdditionalBrowserArguments = arguments };
        return CoreWebView2Environment.CreateAsync(userDataFolder: userDataFolder, options: options);
    }

    public static string BuildUrl(IEnumerable<KeyValuePair<string, string>> query)
    {
        var pairs = query.Select(pair => $"{Uri.EscapeDataString(pair.Key)}={Uri.EscapeDataString(pair.Value)}");
        return $"{Origin}/index.html?{string.Join('&', pairs)}";
    }

    public static async Task InitializeAsync(WebView2 webView, string startupScript)
    {
        await webView.EnsureCoreWebView2Async(await Environment);
        var core = webView.CoreWebView2;
        core.SetVirtualHostNameToFolderMapping(VirtualHost, WebRootResolver.Resolve(), CoreWebView2HostResourceAccessKind.Allow);

        var settings = core.Settings;
        settings.AreDefaultContextMenusEnabled = false;
        settings.AreDevToolsEnabled = Debugger.IsAttached || System.Environment.GetEnvironmentVariable("CLASSROOM_WIDGETS_DEVTOOLS") == "1";
        settings.IsStatusBarEnabled = false;
        settings.IsZoomControlEnabled = false;
        settings.AreBrowserAcceleratorKeysEnabled = false;
        settings.IsPasswordAutosaveEnabled = false;
        settings.IsGeneralAutofillEnabled = false;

        var version = App.AppVersion;
        var versionJson = JsonSerializer.Serialize(version);
        await core.AddScriptToExecuteOnDocumentCreatedAsync(
            "window.__CLASSROOM_WIDGETS_WINDOWS__ = true; "
            + $"window.__CLASSROOM_WIDGETS_WINDOWS_VERSION__ = {versionJson}; "
            + RouteRewriteScript
            + startupScript);

        core.NavigationStarting += (_, args) =>
        {
            if (IsAllowed(args.Uri)) return;
            args.Cancel = true;
            OpenExternally(args.Uri);
        };
        core.NewWindowRequested += (_, args) =>
        {
            args.Handled = true;
            if (!IsAllowed(args.Uri)) OpenExternally(args.Uri);
        };
    }

    // The virtual host serves the SPA entry from /index.html, but the React
    // router only matches "/"; rewrite the path before the app boots.
    private const string RouteRewriteScript =
        "if (location.pathname === '/index.html') history.replaceState(history.state, '', '/' + location.search + location.hash); ";

    public static bool IsAllowed(string uri)
        => uri.StartsWith(Origin + "/", StringComparison.OrdinalIgnoreCase)
            || uri.Equals(Origin, StringComparison.OrdinalIgnoreCase)
            || uri.StartsWith("about:", StringComparison.OrdinalIgnoreCase);

    private static void OpenExternally(string uri)
    {
        if (!Uri.TryCreate(uri, UriKind.Absolute, out var parsed)) return;
        if (parsed.Scheme != Uri.UriSchemeHttp && parsed.Scheme != Uri.UriSchemeHttps) return;
        try
        {
            Process.Start(new ProcessStartInfo(parsed.AbsoluteUri) { UseShellExecute = true });
        }
        catch (Exception error) when (error is System.ComponentModel.Win32Exception or InvalidOperationException)
        {
            DashboardLog.Warn($"Unable to open external link: {error.Message}");
        }
    }

    /// <summary>
    /// Runs a script and returns its JSON-encoded result, or null when the
    /// script throws or the web view is not ready.
    /// </summary>
    public static async Task<JsonElement?> EvaluateAsync(WebView2 webView, string script)
    {
        if (webView.CoreWebView2 is null) return null;
        try
        {
            var raw = await webView.CoreWebView2.ExecuteScriptAsync(script);
            using var document = JsonDocument.Parse(raw);
            return document.RootElement.Clone();
        }
        catch (Exception error) when (error is JsonException or InvalidOperationException or System.Runtime.InteropServices.COMException)
        {
            DashboardLog.Error($"Script failed: {error.Message}");
            return null;
        }
    }

    public static async Task<bool> EvaluateBoolAsync(WebView2 webView, string script)
    {
        var result = await EvaluateAsync(webView, script);
        return result is { ValueKind: JsonValueKind.True };
    }
}
