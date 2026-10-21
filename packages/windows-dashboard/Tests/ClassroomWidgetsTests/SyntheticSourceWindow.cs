using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;

namespace ClassroomWidgetsTests;

/// <summary>
/// Borderless, topmost window filled with four asymmetric solid colours, used as
/// non-sensitive desktop content for real GDI capture tests. <paramref name="bounds"/> is in
/// physical pixels (the capture rectangle) and is converted to WPF units once the HWND exists.
/// </summary>
internal sealed class SyntheticSourceWindow : Window
{
    public static readonly Color TopLeft = Color.FromRgb(200, 30, 60);
    public static readonly Color TopRight = Color.FromRgb(40, 190, 70);
    public static readonly Color BottomLeft = Color.FromRgb(50, 80, 220);
    public static readonly Color BottomRight = Color.FromRgb(230, 200, 20);

    private readonly Rect _physicalBounds;
    private bool _contentRendered;

    public SyntheticSourceWindow(Rect bounds)
    {
        _physicalBounds = bounds;
        ContentRendered += (_, _) => _contentRendered = true;
        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.NoResize;
        AllowsTransparency = false;
        ShowInTaskbar = false;
        Topmost = true;
        ShowActivated = false;
        Left = bounds.Left;
        Top = bounds.Top;
        Width = bounds.Width;
        Height = bounds.Height;
        SourceInitialized += (_, _) =>
        {
            var fromDevice = PresentationSource.FromVisual(this)!.CompositionTarget!.TransformFromDevice;
            var origin = fromDevice.Transform(bounds.TopLeft);
            var size = fromDevice.Transform(new Vector(bounds.Width, bounds.Height));
            Left = origin.X;
            Top = origin.Y;
            Width = size.X;
            Height = size.Y;
        };
        var grid = new Grid();
        grid.RowDefinitions.Add(new RowDefinition());
        grid.RowDefinitions.Add(new RowDefinition());
        grid.ColumnDefinitions.Add(new ColumnDefinition());
        grid.ColumnDefinitions.Add(new ColumnDefinition());
        grid.Children.Add(Cell(TopLeft, 0, 0));
        grid.Children.Add(Cell(TopRight, 0, 1));
        grid.Children.Add(Cell(BottomLeft, 1, 0));
        grid.Children.Add(Cell(BottomRight, 1, 1));
        Content = grid;
    }

    /// <summary>
    /// Shows the fixture and pumps the calling STA dispatcher until Windows reports the fixture
    /// at its expected physical bounds, as the window under the centre of each colour cell, and
    /// the screen shows each cell's colour there (read with GetPixel, not the capture code under
    /// test). A fixed delay was not enough on cold CI runners (#237): the capture then saw the
    /// desktop instead. On timeout this throws with what is at each point instead.
    /// </summary>
    public void ShowAndWaitUntilOnScreen(TimeSpan? timeout = null)
    {
        Show();
        var handle = new WindowInteropHelper(this).Handle;
        var points = SamplePoints();
        var started = DateTime.UtcNow;
        var deadline = started + (timeout ?? TimeSpan.FromSeconds(5));
        while (true)
        {
            WpfTestHost.DoEvents();
            if (_contentRendered)
            {
                DwmFlush();
                if (HasExpectedBounds(handle)
                    && points.All(point => RootAt(point) == handle)
                    && points.Select((point, index) => ColourMatches(ScreenColourAt(point), Expected[index])).All(match => match))
                {
                    Console.WriteLine($"Synthetic source on screen after {(DateTime.UtcNow - started).TotalMilliseconds:F0} ms at {_physicalBounds}.");
                    return;
                }
            }
            if (DateTime.UtcNow > deadline) throw new TimeoutException(Diagnostics(handle, points));
            Thread.Sleep(15);
        }
    }

    private static readonly Color[] Expected = [TopLeft, TopRight, BottomLeft, BottomRight];

    private bool HasExpectedBounds(IntPtr handle)
    {
        if (!GetWindowRect(handle, out var rect)) return false;
        return Math.Abs(rect.Left - _physicalBounds.Left) <= 1 && Math.Abs(rect.Top - _physicalBounds.Top) <= 1
            && Math.Abs(rect.Right - _physicalBounds.Right) <= 1 && Math.Abs(rect.Bottom - _physicalBounds.Bottom) <= 1;
    }

    private static Color ScreenColourAt(POINT point)
    {
        var screen = GetDC(IntPtr.Zero);
        try
        {
            var value = GetPixel(screen, point.X, point.Y);
            return Color.FromRgb((byte)(value & 0xFF), (byte)((value >> 8) & 0xFF), (byte)((value >> 16) & 0xFF));
        }
        finally
        {
            ReleaseDC(IntPtr.Zero, screen);
        }
    }

    private static bool ColourMatches(Color actual, Color expected)
        => Math.Abs(actual.R - expected.R) <= 3 && Math.Abs(actual.G - expected.G) <= 3 && Math.Abs(actual.B - expected.B) <= 3;

    private POINT[] SamplePoints()
    {
        var left = (int)_physicalBounds.Left;
        var top = (int)_physicalBounds.Top;
        var width = (int)_physicalBounds.Width;
        var height = (int)_physicalBounds.Height;
        return
        [
            new POINT(left + width / 4, top + height / 4),
            new POINT(left + width * 3 / 4, top + height / 4),
            new POINT(left + width / 4, top + height * 3 / 4),
            new POINT(left + width * 3 / 4, top + height * 3 / 4),
        ];
    }

    private static IntPtr RootAt(POINT point)
    {
        var hit = WindowFromPoint(point);
        return hit == IntPtr.Zero ? IntPtr.Zero : GetAncestor(hit, 2 /* GA_ROOT */);
    }

    private string Diagnostics(IntPtr handle, POINT[] points)
    {
        var report = new StringBuilder();
        GetWindowRect(handle, out var rect);
        report.AppendLine($"Synthetic source window was not on screen in time (#237). ContentRendered={_contentRendered}.");
        report.AppendLine($"Fixture: {Describe(handle)}, visible={IsWindowVisible(handle)}, rect=({rect.Left},{rect.Top})-({rect.Right},{rect.Bottom}), expected physical bounds={_physicalBounds}.");
        for (var index = 0; index < points.Length; index++)
        {
            var point = points[index];
            report.AppendLine($"At ({point.X},{point.Y}): screen colour {ScreenColourAt(point)} (expected {Expected[index]}), {Describe(RootAt(point))}");
        }
        return report.ToString();
    }

    private static string Describe(IntPtr window)
    {
        if (window == IntPtr.Zero) return "no window";
        var className = new StringBuilder(256);
        GetClassName(window, className, className.Capacity);
        var title = new StringBuilder(256);
        GetWindowText(window, title, title.Capacity);
        GetWindowThreadProcessId(window, out var processId);
        string processName;
        try { processName = Process.GetProcessById((int)processId).ProcessName; }
        catch (Exception error) when (error is ArgumentException or InvalidOperationException) { processName = "exited"; }
        var topmost = (GetWindowLong(window, -20 /* GWL_EXSTYLE */) & 0x8) != 0;
        DwmGetWindowAttribute(window, 14 /* DWMWA_CLOAKED */, out var cloaked, sizeof(int));
        return $"HWND=0x{window.ToInt64():X}, class=\"{className}\", title=\"{title}\", process={processName} ({processId}), topmost={topmost}, cloaked={cloaked}";
    }

    [StructLayout(LayoutKind.Sequential)]
    private readonly record struct POINT(int X, int Y);

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT
    {
        public int Left, Top, Right, Bottom;
    }

    [DllImport("user32.dll")]
    private static extern IntPtr WindowFromPoint(POINT point);

    [DllImport("user32.dll")]
    private static extern IntPtr GetAncestor(IntPtr window, uint flags);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetWindowRect(IntPtr window, out RECT rect);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindowVisible(IntPtr window);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetClassName(IntPtr window, StringBuilder name, int capacity);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr window, StringBuilder text, int capacity);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongW")]
    private static extern int GetWindowLong(IntPtr window, int index);

    [DllImport("dwmapi.dll")]
    private static extern int DwmGetWindowAttribute(IntPtr window, int attribute, out int value, int size);

    [DllImport("dwmapi.dll")]
    private static extern int DwmFlush();

    [DllImport("user32.dll")]
    private static extern IntPtr GetDC(IntPtr window);

    [DllImport("user32.dll")]
    private static extern int ReleaseDC(IntPtr window, IntPtr deviceContext);

    [DllImport("gdi32.dll")]
    private static extern uint GetPixel(IntPtr deviceContext, int x, int y);

    private static Border Cell(Color color, int row, int column)
    {
        var cell = new Border { Background = new SolidColorBrush(color) };
        Grid.SetRow(cell, row);
        Grid.SetColumn(cell, column);
        return cell;
    }
}
