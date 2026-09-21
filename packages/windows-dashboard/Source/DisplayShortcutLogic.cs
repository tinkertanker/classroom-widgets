namespace ClassroomWidgets;

public static class DisplayShortcutLogic
{
    public const int WidgetType = int.MinValue;
    public const string DefaultShortcut = "Ctrl+Alt+Shift+0";

    public static bool IsDuplicate(string? shortcut, IEnumerable<string?> assignments)
        => !string.IsNullOrWhiteSpace(shortcut)
            && assignments.Any(existing => string.Equals(existing, shortcut, StringComparison.OrdinalIgnoreCase));
}
