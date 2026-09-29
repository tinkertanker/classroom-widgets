using System.Globalization;
using System.Text.Json;
using ClassroomWidgets;
using Xunit;

namespace ClassroomWidgetsTests;

public class DashboardAudioSettingsTests
{
    [Fact]
    public void PreferencesFromEarlierVersionsDefaultToFullVolume()
    {
        const string legacyJson = """{ "BackgroundOpacity": 0.4 }""";

        var settings = JsonSerializer.Deserialize<DashboardSettings>(legacyJson);

        Assert.NotNull(settings);
        Assert.Equal(1, settings.OutputVolume);
    }

    [Theory]
    [InlineData(-1, 0)]
    [InlineData(0.35, 0.35)]
    [InlineData(4, 1)]
    public void ScriptClampsAndPublishesNativePreference(double input, double expected)
    {
        var settings = new DashboardSettings { OutputVolume = input };

        var script = DashboardAudioSettings.Script(settings);
        var expectedText = expected.ToString(CultureInfo.InvariantCulture);

        Assert.Contains($"window.__CLASSROOM_WIDGETS_AUDIO_VOLUME__ = {expectedText};", script);
        Assert.Contains($"window.classroomAudio?.setVolume({expectedText});", script);
    }
}
