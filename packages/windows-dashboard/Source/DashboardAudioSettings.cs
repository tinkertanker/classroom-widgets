using System.Globalization;

namespace ClassroomWidgets;

public static class DashboardAudioSettings
{
    public static readonly (string Label, double Volume)[] Presets = DesktopHostScripts.OutputVolumePresets;

    public static string Label(double volume)
        => Presets.FirstOrDefault(preset => preset.Volume == volume).Label ?? "Custom";

    public static string Script(DashboardSettings settings)
    {
        var volume = Math.Clamp(settings.OutputVolume, 0, 1)
            .ToString(CultureInfo.InvariantCulture);
        return DesktopHostScripts.AudioVolume(volume);
    }
}
