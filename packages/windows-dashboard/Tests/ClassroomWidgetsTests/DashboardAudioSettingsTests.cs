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
}
