using System.Text.Json;
using System.Text.Json.Serialization;
using ClassroomWidgets;
using Xunit;

namespace ClassroomWidgetsTests;

/// <summary>
/// Windows parity for the macOS DashboardShortenerSettingsTests: native
/// preferences must publish safely escaped settings into every web view.
/// </summary>
public class DashboardShortenerSettingsTests
{
    private const string ScriptPrefix = "window.classroomShortenerSettings = ";
    private const string ScriptSuffix = "; window.dispatchEvent(new Event('classroom-shortener-settings-changed'));";

    // Same options DashboardSettings.Save uses, so the roundtrip matches disk.
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    [Fact]
    public void ScriptPublishesEscapedShortioSettingsWithoutInterpolation()
    {
        var settings = new DashboardSettings
        {
            LinkShortenerProvider = "shortio",
            LinkShortenerPublicApiKey = "pk_test\"\\\n</script>",
            LinkShortenerDomain = "go.school.edu"
        };
        var script = DashboardShortenerSettings.Script(settings);
        var payload = ParsePayload(script);

        Assert.Equal("shortio", payload.GetProperty("provider").GetString());
        Assert.Equal("pk_test\"\\\n</script>", payload.GetProperty("shortioApiKey").GetString());
        Assert.Equal("go.school.edu", payload.GetProperty("shortioDomain").GetString());

        // The credential must only ever appear escaped: raw quotes or markup
        // from the key must never be spliced into the script verbatim.
        Assert.DoesNotContain("= \"pk_test", script);
        Assert.DoesNotContain("</script>", script);
    }

    [Fact]
    public void ScriptNormalizesUnsupportedProviders()
    {
        var settings = new DashboardSettings { LinkShortenerProvider = "bitly" };
        Assert.Equal("tinyurl", DashboardShortenerSettings.NormalizeProvider(settings.LinkShortenerProvider));
        Assert.Equal("tinyurl", ParsePayload(DashboardShortenerSettings.Script(settings)).GetProperty("provider").GetString());

        foreach (var provider in new[] { "tinyurl", "spoo", "shortio" })
        {
            Assert.Equal(provider, DashboardShortenerSettings.NormalizeProvider(provider));
        }
        Assert.Equal("tinyurl", DashboardShortenerSettings.NormalizeProvider(null));
    }

    [Fact]
    public void PreferencesFromEarlierVersionsKeepTheirValuesAndGainShortenerDefaults()
    {
        // A settings.json written before this feature: none of the existing
        // preferences may move, and the shortener falls back to TinyURL.
        const string legacyJson = """
            {
              "BackgroundOpacity": 0.4,
              "AlwaysOnTop": false,
              "PanelFrames": {
                "qr": { "Left": 10, "Top": 20, "Width": 320, "Height": 260 }
              }
            }
            """;

        var settings = JsonSerializer.Deserialize<DashboardSettings>(legacyJson, JsonOptions);

        Assert.NotNull(settings);
        Assert.Equal(0.4, settings.BackgroundOpacity);
        Assert.False(settings.AlwaysOnTop);
        Assert.Equal(320, settings.PanelFrames["qr"].Width);
        Assert.Equal("tinyurl", settings.LinkShortenerProvider);
        Assert.Equal("", settings.LinkShortenerPublicApiKey);
        Assert.Equal("", settings.LinkShortenerDomain);
    }

    private static JsonElement ParsePayload(string script)
    {
        Assert.StartsWith(ScriptPrefix, script);
        Assert.EndsWith(ScriptSuffix, script);
        var json = script[ScriptPrefix.Length..^ScriptSuffix.Length];
        return JsonDocument.Parse(json).RootElement;
    }
}
