using System.Windows;

namespace ClassroomWidgets;

public enum MoveDirection
{
    Previous,
    Next
}

/// <summary>
/// The single-action "Move Widget to Previous/Next Display" shortcuts. Their
/// sentinel widget types never collide with a real option or the Display
/// sentinel.
/// </summary>
public static class MoveWidgetShortcutLogic
{
    public const int PreviousWidgetType = int.MinValue + 1;
    public const int NextWidgetType = int.MinValue + 2;
    public const string DefaultPreviousShortcut = "Ctrl+Alt+Shift+Left";
    public const string DefaultNextShortcut = "Ctrl+Alt+Shift+Right";

    public static bool IsMoveWidgetType(int widgetType) =>
        widgetType is PreviousWidgetType or NextWidgetType;

    public static string DefaultShortcut(int widgetType) =>
        widgetType == PreviousWidgetType ? DefaultPreviousShortcut : DefaultNextShortcut;
}

/// <summary>
/// Pure geometry for "Move to Next Display": work areas are ordered by origin
/// (x, then y) and wrap around; the panel keeps its size and its offset from
/// the source work area's origin, clamped into the target work area.
/// </summary>
public static class MoveToNextDisplayGeometry
{
    public static Rect? NextDisplayFrame(Rect frame, IReadOnlyList<Rect> workAreas, MoveDirection direction = MoveDirection.Next)
    {
        if (workAreas.Count < 2) return null;
        var sorted = workAreas.OrderBy(area => area.X).ThenBy(area => area.Y).ToList();
        var sourceIndex = -1;
        var best = 0.0;
        for (var index = 0; index < sorted.Count; index++)
        {
            var overlap = Rect.Intersect(sorted[index], frame);
            var size = overlap.IsEmpty ? 0 : overlap.Width * overlap.Height;
            if (size > best)
            {
                best = size;
                sourceIndex = index;
            }
        }
        if (sourceIndex < 0) return null;

        var source = sorted[sourceIndex];
        var step = direction == MoveDirection.Next ? 1 : -1;
        var target = sorted[(sourceIndex + step + sorted.Count) % sorted.Count];
        return ScreenGeometry.Clamp(new Rect(
            target.X + frame.X - source.X,
            target.Y + frame.Y - source.Y,
            frame.Width,
            frame.Height), target);
    }
}
