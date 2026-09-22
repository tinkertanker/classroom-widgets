using System.Windows;

namespace ClassroomWidgets;

/// <summary>
/// The single-action "Move Widget to Next Display" shortcut. Its sentinel
/// widget type never collides with a real option or the Display sentinel.
/// </summary>
public static class MoveWidgetShortcutLogic
{
    public const int WidgetType = int.MinValue + 1;
    public const string DefaultShortcut = "Ctrl+Alt+Shift+M";
}

/// <summary>
/// Pure geometry for "Move to Next Display": work areas are ordered by origin
/// (x, then y) and wrap around; the panel keeps its size and its offset from
/// the source work area's origin, clamped into the target work area.
/// </summary>
public static class MoveToNextDisplayGeometry
{
    public static Rect? NextDisplayFrame(Rect frame, IReadOnlyList<Rect> workAreas)
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
        var target = sorted[(sourceIndex + 1) % sorted.Count];
        return ScreenGeometry.Clamp(new Rect(
            target.X + frame.X - source.X,
            target.Y + frame.Y - source.Y,
            frame.Width,
            frame.Height), target);
    }
}
