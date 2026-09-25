namespace ClassroomWidgets;

/// <summary>
/// Shared layout for the native add-widget menus (tray and panel "+"):
/// Display leads the first group, then the widgets in the order the teacher
/// app sent them, with a separator wherever the menu group changes.
/// </summary>
public static class CompactWidgetMenu
{
    public const string DisplayTitle = "Display";

    // U+1F5A5 DESKTOP COMPUTER with the emoji variation selector.
    public const string DisplayEmoji = "\U0001F5A5\uFE0F";

    public static string DisplayLabel { get; } = Label(DisplayEmoji, DisplayTitle);

    public static string Label(CompactWidgetOption option) => Label(option.Emoji, option.Title);

    public static string Label(string? emoji, string title) =>
        string.IsNullOrEmpty(emoji) ? title : $"{emoji}  {title}";

    /// <summary>
    /// The widget entries that follow Display. The first widget shares
    /// Display's group, so it never has a separator before it.
    /// </summary>
    public static IEnumerable<(CompactWidgetOption Option, bool SeparatorBefore)> Entries(IReadOnlyList<CompactWidgetOption> options)
    {
        for (var index = 0; index < options.Count; index++)
        {
            yield return (options[index], index > 0 && options[index].MenuGroup != options[index - 1].MenuGroup);
        }
    }
}
