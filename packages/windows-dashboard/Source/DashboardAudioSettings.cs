using System.Globalization;

namespace ClassroomWidgets;

public static class DashboardAudioSettings
{
    public static string Script(DashboardSettings settings)
    {
        var volume = Math.Clamp(settings.OutputVolume, 0, 1)
            .ToString(CultureInfo.InvariantCulture);
        return $"window.__CLASSROOM_WIDGETS_AUDIO_VOLUME__ = {volume}; window.classroomAudio?.setVolume({volume});";
    }
}
