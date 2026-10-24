using System.Windows;

namespace ClassroomWidgets;

/// <summary>Where a window's position menu can put it on its current monitor (Display and widget panels).</summary>
public enum WindowSnapPreset
{
    LeftHalf,
    RightHalf,
    TopHalf,
    BottomHalf,
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
    Centre,
    Fill
}

public static class WindowSnapGeometry
{
    private enum Span { Start, End, Full }

    /// <summary>Menu groups, separated in the layout menu.</summary>
    public static readonly WindowSnapPreset[][] Groups =
    {
        new[] { WindowSnapPreset.LeftHalf, WindowSnapPreset.RightHalf, WindowSnapPreset.TopHalf, WindowSnapPreset.BottomHalf },
        new[] { WindowSnapPreset.TopLeft, WindowSnapPreset.TopRight, WindowSnapPreset.BottomLeft, WindowSnapPreset.BottomRight },
        new[] { WindowSnapPreset.Centre, WindowSnapPreset.Fill }
    };

    public static string Title(WindowSnapPreset preset) => preset switch
    {
        WindowSnapPreset.LeftHalf => "Left Half",
        WindowSnapPreset.RightHalf => "Right Half",
        WindowSnapPreset.TopHalf => "Top Half",
        WindowSnapPreset.BottomHalf => "Bottom Half",
        WindowSnapPreset.TopLeft => "Top Left",
        WindowSnapPreset.TopRight => "Top Right",
        WindowSnapPreset.BottomLeft => "Bottom Left",
        WindowSnapPreset.BottomRight => "Bottom Right",
        WindowSnapPreset.Centre => "Centre",
        _ => "Fill Screen"
    };

    private static (Span Horizontal, Span Vertical) Spans(WindowSnapPreset preset) => preset switch
    {
        WindowSnapPreset.LeftHalf => (Span.Start, Span.Full),
        WindowSnapPreset.RightHalf => (Span.End, Span.Full),
        WindowSnapPreset.TopHalf => (Span.Full, Span.Start),
        WindowSnapPreset.BottomHalf => (Span.Full, Span.End),
        WindowSnapPreset.TopLeft => (Span.Start, Span.Start),
        WindowSnapPreset.TopRight => (Span.End, Span.Start),
        WindowSnapPreset.BottomLeft => (Span.Start, Span.End),
        WindowSnapPreset.BottomRight => (Span.End, Span.End),
        _ => (Span.Full, Span.Full)
    };

    private static (double Start, double Length) Region(Span span, double start, double length, double gap)
    {
        if (span == Span.Full) return (start, length);
        var half = Math.Max((length - gap) / 2, 1);
        return span == Span.Start ? (start, half) : (start + length - half, half);
    }

    private static double Place(Span span, double start, double length, double size) => span switch
    {
        Span.Start => start,
        Span.End => start + length - size,
        _ => start + (length - size) / 2
    };

    /// <summary>
    /// Window frame (DIPs, y down) for <paramref name="preset"/> on <paramref name="workArea"/>.
    /// The preview keeps the source aspect when one is given, so a half is the largest preview
    /// that fits the half, pushed to its edge. Null when the input cannot produce a usable frame.
    /// </summary>
    public static Rect? Frame(
        WindowSnapPreset preset,
        Rect workArea,
        double? aspect,
        Size chrome,
        Size minimumFrame,
        Size? maximumFrame,
        Rect currentFrame,
        double margin)
    {
        if (!double.IsFinite(workArea.X) || !double.IsFinite(workArea.Y) || !double.IsFinite(workArea.Width)
            || !double.IsFinite(workArea.Height) || workArea.Width <= 0 || workArea.Height <= 0) return null;
        var gap = double.IsFinite(margin) ? Math.Max(margin, 0) : 0;
        var area = workArea.Width > gap * 2 && workArea.Height > gap * 2
            ? new Rect(workArea.X + gap, workArea.Y + gap, workArea.Width - gap * 2, workArea.Height - gap * 2)
            : workArea;
        var (horizontal, vertical) = Spans(preset);
        var (rx, rw) = Region(horizontal, area.X, area.Width, gap);
        var (ry, rh) = Region(vertical, area.Y, area.Height, gap);
        var chromeWidth = double.IsFinite(chrome.Width) ? Math.Max(chrome.Width, 0) : 0;
        var chromeHeight = double.IsFinite(chrome.Height) ? Math.Max(chrome.Height, 0) : 0;
        var minWidth = double.IsFinite(minimumFrame.Width) ? Math.Max(minimumFrame.Width, 1) : 1;
        var minHeight = double.IsFinite(minimumFrame.Height) ? Math.Max(minimumFrame.Height, 1) : 1;
        // The minimum wins if the two conflict.
        var maxWidth = maximumFrame is { Width: > 0 } maxSize && double.IsFinite(maxSize.Width) ? maxSize.Width : double.PositiveInfinity;
        var maxHeight = maximumFrame is { Height: > 0 } maxSize2 && double.IsFinite(maxSize2.Height) ? maxSize2.Height : double.PositiveInfinity;
        double? validAspect = aspect is { } value && double.IsFinite(value) && value > 0 ? value : null;

        double width;
        double height;
        if (preset == WindowSnapPreset.Centre)
        {
            if (!double.IsFinite(currentFrame.Width) || !double.IsFinite(currentFrame.Height)
                || currentFrame.Width <= 0 || currentFrame.Height <= 0) return null;
            width = Math.Max(Math.Min(currentFrame.Width, maxWidth), minWidth);
            height = Math.Max(Math.Min(currentFrame.Height, maxHeight), minHeight);
        }
        else if (validAspect is { } ratio)
        {
            var scale = Math.Min(Math.Max(rw - chromeWidth, 1) / ratio, Math.Max(rh - chromeHeight, 1));
            scale = Math.Min(scale, Math.Min((maxWidth - chromeWidth) / ratio, maxHeight - chromeHeight));
            // Grow, keeping the aspect, until the window meets its minimum size.
            scale = Math.Max(scale, Math.Max((minWidth - chromeWidth) / ratio, minHeight - chromeHeight));
            width = ratio * scale + chromeWidth;
            height = scale + chromeHeight;
        }
        else
        {
            width = Math.Max(Math.Min(rw, maxWidth), minWidth);
            height = Math.Max(Math.Min(rh, maxHeight), minHeight);
        }
        // Never larger than the work area, even if that breaks the aspect on a tiny screen.
        width = Math.Min(width, area.Width);
        height = Math.Min(height, area.Height);
        var x = Place(horizontal, rx, rw, width);
        var y = Place(vertical, ry, rh, height);
        return new Rect(
            Math.Max(Math.Min(x, area.Right - width), area.X),
            Math.Max(Math.Min(y, area.Bottom - height), area.Y),
            width,
            height);
    }
}
