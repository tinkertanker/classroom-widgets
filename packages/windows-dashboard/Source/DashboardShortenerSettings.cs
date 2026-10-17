using System.Text.Json;

namespace ClassroomWidgets;

/// <summary>
/// Native link-shortener preferences published into every web view, mirroring
/// the macOS <c>DashboardShortenerSettings</c>. The native settings store is
/// authoritative; the compact web views have ephemeral storage.
/// </summary>
public static class DashboardShortenerSettings
{
    public const string DefaultProvider = DesktopHostScripts.DefaultShortenerProvider;
    public const string ShortioProvider = "shortio";

    /// <summary>Keeps the published provider within the supported set.</summary>
    public static string NormalizeProvider(string? provider)
        => DesktopHostScripts.NormalizeShortenerProvider(provider);

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
        return DesktopHostScripts.ShortenerSettings(payload);
    }
}
