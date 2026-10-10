using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;

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
        if (NextWorkAreas(frame, workAreas, direction) is not { } areas) return null;
        return ScreenGeometry.Clamp(new Rect(
            areas.Target.X + frame.X - areas.Source.X,
            areas.Target.Y + frame.Y - areas.Source.Y,
            frame.Width,
            frame.Height), areas.Target);
    }

    internal static (Rect Source, Rect Target)? NextWorkAreas(Rect frame, IReadOnlyList<Rect> workAreas, MoveDirection direction)
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
        return (source, target);
    }
}

/// <summary>Moves only the shortcut target in physical desktop coordinates, retaining its DIP size.</summary>
internal static class WindowDisplayMovement
{
    public static bool Move(Window window, MoveDirection direction)
    {
        if (window.WindowState != WindowState.Normal) return false;
        var handle = new WindowInteropHelper(window).Handle;
        if (handle == IntPtr.Zero || !GetWindowRect(handle, out var bounds)) return false;
        var frame = new Rect(bounds.Left, bounds.Top, bounds.Right - bounds.Left, bounds.Bottom - bounds.Top);
        var screens = System.Windows.Forms.Screen.AllScreens;
        var workAreas = screens.Select(screen => new Rect(screen.WorkingArea.X, screen.WorkingArea.Y,
            screen.WorkingArea.Width, screen.WorkingArea.Height)).ToList();
        if (MoveToNextDisplayGeometry.NextWorkAreas(frame, workAreas, direction) is not { } areas) return false;
        var targetScreen = screens[workAreas.IndexOf(areas.Target)];
        // Only sizes are converted with the target DPI. Absolute monitor origins
        // and the source offset stay in the one physical desktop coordinate space.
        var scale = areas.Target.Width / ScreenGeometry.WorkAreaInDips(targetScreen).Width;
        var moved = ScreenGeometry.Clamp(new Rect(
            areas.Target.X + frame.X - areas.Source.X,
            areas.Target.Y + frame.Y - areas.Source.Y,
            window.ActualWidth * scale,
            window.ActualHeight * scale), areas.Target);
        const uint flags = 0x0004 | 0x0010; // SWP_NOZORDER | SWP_NOACTIVATE
        bool Place() => SetWindowPos(handle, IntPtr.Zero, (int)Math.Round(moved.X), (int)Math.Round(moved.Y),
            (int)Math.Round(moved.Width), (int)Math.Round(moved.Height), flags);
        if (!Place()) return false;
        // WM_DPICHANGED can apply its suggested rectangle during the first move.
        // Reapply the physical frame after WPF has adopted the destination DPI.
        if (!Place()) return false;
        // WM_MOVE can precede the new DPI transform. An identical second
        // placement sends no move notification, leaving Left/Top in the old
        // units even though ActualWidth/Height use the new DPI. Synchronize
        // only this shortcut's result before CurrentFrame is persisted.
        if (PresentationSource.FromVisual(window)?.CompositionTarget is { } target)
        {
            var position = target.TransformFromDevice.Transform(new Point(Math.Round(moved.X), Math.Round(moved.Y)));
            window.Left = position.X;
            window.Top = position.Y;
        }
        return true;
    }

    [StructLayout(LayoutKind.Sequential)] private struct RECT { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr window, out RECT bounds);
    [DllImport("user32.dll")] private static extern bool SetWindowPos(IntPtr window, IntPtr insertAfter,
        int x, int y, int width, int height, uint flags);
}
