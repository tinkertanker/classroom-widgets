using System.Text.Json;

namespace ClassroomWidgets;

/// <summary>
/// Native link-shortener preferences published into every web view, mirroring
/// the macOS <c>DashboardShortenerSettings</c>. The native settings store is
/// authoritative; the compact web views have ephemeral storage.
/// </summary>
public static class DashboardShortenerSettings
{
    public const string DefaultProvider = "tinyurl";
    public const string ShortioProvider = "shortio";

    private static readonly string[] SupportedProviders = { "tinyurl", "spoo", "shortio" };

    /// <summary>Keeps the published provider within the supported set.</summary>
    public static string NormalizeProvider(string? provider)
        => SupportedProviders.Contains(provider) ? provider! : DefaultProvider;

    /// <summary>
    /// JavaScript that assigns the shortener settings onto <c>window</c> and
    /// notifies the web app. Values are JSON-serialized so a key or domain
    /// containing quotes, markup, or newlines can never break out of the
    /// assignment.
    /// </summary>
    public static string Script(DashboardSettings settings)
    {
        var payload = JsonSerializer.Serialize(new Dictionary<string, string>
        {
            ["provider"] = NormalizeProvider(settings.LinkShortenerProvider),
            ["shortioApiKey"] = settings.LinkShortenerPublicApiKey ?? "",
            ["shortioDomain"] = settings.LinkShortenerDomain ?? ""
        });
        return $"window.classroomShortenerSettings = {payload}; "
            + "window.dispatchEvent(new Event('classroom-shortener-settings-changed'));";
    }
}
