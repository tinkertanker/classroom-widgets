namespace ClassroomWidgets;

public static class UpdateVersion
{
    public static bool IsNewer(string candidate, string current) =>
        TryParse(candidate, out var available) && Version.TryParse(current, out var installed) && available > installed;

    public static bool TryParse(string value, out Version version) =>
        Version.TryParse(value.TrimStart('v'), out version!);
}
