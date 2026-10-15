using System.Text.Json;
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

    private static JsonElement ParsePayload(string script)
    {
        Assert.StartsWith(ScriptPrefix, script);
        Assert.EndsWith(ScriptSuffix, script);
        var json = script[ScriptPrefix.Length..^ScriptSuffix.Length];
        return JsonDocument.Parse(json).RootElement;
    }
}
