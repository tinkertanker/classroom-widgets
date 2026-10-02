using System.Globalization;

namespace ClassroomWidgets;

public static class DashboardAudioSettings
{
    public static readonly (string Label, double Volume)[] Presets =
    [
        ("Mute", 0), ("1 ■□□□", 0.1), ("2 ■■□□", 0.25), ("3 ■■■□", 0.5), ("4 ■■■■", 1)
    ];

    public static string Label(double volume)
        => Presets.FirstOrDefault(preset => preset.Volume == volume).Label ?? "Custom";

    public static string Script(DashboardSettings settings)
    {
        var volume = Math.Clamp(settings.OutputVolume, 0, 1)
            .ToString(CultureInfo.InvariantCulture);
        return $"window.__CLASSROOM_WIDGETS_AUDIO_VOLUME__ = {volume}; window.classroomAudio?.setVolume({volume});";
    }
}
