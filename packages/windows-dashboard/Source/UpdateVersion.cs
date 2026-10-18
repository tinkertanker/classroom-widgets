namespace ClassroomWidgets;

public static class UpdateVersion
{
    public static bool TryParse(string value, out Version version) =>
        Version.TryParse(value.TrimStart('v'), out version!);
}
