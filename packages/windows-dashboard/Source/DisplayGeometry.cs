using System.Windows;

namespace ClassroomWidgets;

public static class DisplayGeometry
{
    public static Rect? AspectFit(Size content, Rect bounds)
    {
        if (!Positive(content) || !Positive(bounds.Size) || !Finite(bounds)) return null;
        var scale = Math.Min(bounds.Width / content.Width, bounds.Height / content.Height);
        var width = content.Width * scale;
        var height = content.Height * scale;
        return new Rect(bounds.X + (bounds.Width - width) / 2, bounds.Y + (bounds.Height - height) / 2, width, height);
    }

    public static Point? MapPreviewPointToSource(Point point, Rect imageRect, Rect sourceBounds)
    {
        if (!Finite(point) || !Positive(imageRect.Size) || !Finite(imageRect) || !Positive(sourceBounds.Size) || !Finite(sourceBounds)) return null;
        var u = (point.X - imageRect.X) / imageRect.Width;
        var v = (point.Y - imageRect.Y) / imageRect.Height;
        if (u < 0 || u >= 1 || v < 0 || v >= 1) return null;
        var x = Math.Min(sourceBounds.X + u * sourceBounds.Width, sourceBounds.Right - 1);
        var y = Math.Min(sourceBounds.Y + v * sourceBounds.Height, sourceBounds.Bottom - 1);
        return double.IsFinite(x) && double.IsFinite(y) ? new Point(x, y) : null;
    }

    public static Size AspectNormalizedWindowSize(
        double aspect,
        Size proposedPreview,
        double chromeHeight,
        Size minimumPreview,
        Size maximum)
    {
        var chrome = double.IsFinite(chromeHeight) ? Math.Max(chromeHeight, 0) : 0;
        var fallback = new Size(proposedPreview.Width, proposedPreview.Height + chrome);
        if (!double.IsFinite(aspect) || aspect <= 0 || !Positive(proposedPreview)) return fallback;

        var minimum = new Size(
            Math.Max(double.IsFinite(minimumPreview.Width) ? minimumPreview.Width : 1, 1),
            Math.Max(double.IsFinite(minimumPreview.Height) ? minimumPreview.Height : 1, 1));
        var scale = Math.Min(proposedPreview.Width / aspect, proposedPreview.Height);
        var width = aspect * scale;
        var height = scale;
        if (width < minimum.Width || height < minimum.Height)
        {
            var minimumScale = Math.Max(minimum.Width / aspect, minimum.Height);
            width = aspect * minimumScale;
            height = minimumScale;
        }
        if (Positive(maximum))
        {
            var maximumPreviewHeight = Math.Max(maximum.Height - chrome, 1);
            var screenScale = Math.Min(1, Math.Min(maximum.Width / width, maximumPreviewHeight / height));
            if (screenScale < 1)
            {
                var scaledWidth = width * screenScale;
                var scaledHeight = height * screenScale;
                if (scaledWidth >= minimum.Width && scaledHeight >= minimum.Height)
                {
                    width = scaledWidth;
                    height = scaledHeight;
                }
                else
                {
                    width = Math.Max(minimum.Width, Math.Min(width, maximum.Width));
                    height = Math.Max(minimum.Height, Math.Min(height, maximumPreviewHeight));
                }
            }
        }
        return new Size(width, height + chrome);
    }

    public static bool Intersects(Rect a, Rect b)
        => Finite(a) && Finite(b) && Math.Min(a.Right, b.Right) > Math.Max(a.Left, b.Left)
            && Math.Min(a.Bottom, b.Bottom) > Math.Max(a.Top, b.Top);

    public static Rect Clamp(Rect rect, Rect bounds)
    {
        if (!Finite(rect) || !Finite(bounds)) return rect;
        var width = Math.Min(Math.Max(rect.Width, 0), Math.Max(bounds.Width, 0));
        var height = Math.Min(Math.Max(rect.Height, 0), Math.Max(bounds.Height, 0));
        var x = Math.Min(Math.Max(rect.X, bounds.X), bounds.Right - width);
        var y = Math.Min(Math.Max(rect.Y, bounds.Y), bounds.Bottom - height);
        return new Rect(x, y, width, height);
    }

    public static string DescribePosition(Rect bounds)
    {
        if (bounds.X < 0) return "left";
        if (bounds.Y < 0) return "above";
        if (bounds.X > 0) return "right";
        if (bounds.Y > 0) return "below";
        return "main";
    }

    private static bool Positive(Size size)
        => double.IsFinite(size.Width) && double.IsFinite(size.Height) && size.Width > 0 && size.Height > 0;

    private static bool Finite(Point point) => double.IsFinite(point.X) && double.IsFinite(point.Y);

    private static bool Finite(Rect rect)
        => double.IsFinite(rect.X) && double.IsFinite(rect.Y) && double.IsFinite(rect.Width) && double.IsFinite(rect.Height);
}
