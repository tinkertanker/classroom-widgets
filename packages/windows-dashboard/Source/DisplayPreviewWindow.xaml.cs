using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;

namespace ClassroomWidgets;

public partial class DisplayPreviewWindow : Window
{
    public event Action? PowerToggleRequested;
    public event Action? MenuRequested;
    public event Action? LayoutMenuRequested;
    public event Action<Point, Rect>? PreviewClicked;
    public event Action? FrameChanged;

    public double ChromeHeightDip => Math.Max(42, ActualHeight - PreviewSurface.ActualHeight);

    public double ChromeWidthDip => Math.Max(0, ActualWidth - PreviewSurface.ActualWidth);

    public Size PreviewSizeDip => new(PreviewSurface.ActualWidth, PreviewSurface.ActualHeight);

    /// <summary>The preview area in physical pixels, or empty before the window has a monitor.</summary>
    public Size PreviewSizePixels
    {
        get
        {
            if (PresentationSource.FromVisual(this)?.CompositionTarget is not { } target) return Size.Empty;
            var size = target.TransformToDevice.Transform(new Vector(PreviewSurface.ActualWidth, PreviewSurface.ActualHeight));
            return new Size(Math.Max(0, Math.Round(size.X)), Math.Max(0, Math.Round(size.Y)));
        }
    }

    public DisplayPreviewWindow(Rect initialBounds)
    {
        InitializeComponent();
        Left = initialBounds.X;
        Top = initialBounds.Y;
        Width = initialBounds.Width;
        Height = initialBounds.Height;
        LocationChanged += (_, _) => FrameChanged?.Invoke();
        SizeChanged += (_, _) => FrameChanged?.Invoke();
    }

    public void SetState(string status, bool powerOn, bool powerEnabled)
    {
        StatusText.Text = status;
        PowerButton.IsEnabled = powerEnabled;
        PowerButton.Foreground = powerOn ? Brushes.LimeGreen : Brushes.White;
        PowerButton.ToolTip = powerOn ? "Turn preview off" : "Turn preview on";
    }

    public void SetImage(ImageSource? image) => PreviewImage.Source = image;

    public Rect GetPhysicalBounds()
    {
        var handle = new WindowInteropHelper(this).Handle;
        if (handle == IntPtr.Zero || !NativeMethods.GetWindowRect(handle, out var rect))
        {
            return new Rect(Left, Top, ActualWidth, ActualHeight);
        }
        return new Rect(rect.Left, rect.Top, rect.Right - rect.Left, rect.Bottom - rect.Top);
    }

    public void SetClientSize(Size dipSize)
    {
        Width = Math.Max(MinWidth, dipSize.Width);
        Height = Math.Max(MinHeight, dipSize.Height);
    }

    /// <summary>Physical pixels per DIP on the window's current monitor.</summary>
    public double DeviceScale
        => PresentationSource.FromVisual(this)?.CompositionTarget is { } target ? target.TransformToDevice.M11 : 1;

    /// <summary>
    /// Moves and resizes in one native call, in physical pixels, so the window never passes
    /// through an intermediate frame (such as the new origin at the old size) that could
    /// reach the source display.
    /// </summary>
    public bool SetPhysicalBounds(Rect bounds)
    {
        var handle = new WindowInteropHelper(this).Handle;
        if (handle == IntPtr.Zero) return false;
        // Round the edges, not the size, so an edge snapped to the work area stays on it.
        var left = (int)Math.Round(bounds.Left);
        var top = (int)Math.Round(bounds.Top);
        var right = (int)Math.Round(bounds.Right);
        var bottom = (int)Math.Round(bounds.Bottom);
        const uint flags = 0x0004 | 0x0010; // SWP_NOZORDER | SWP_NOACTIVATE
        // WM_MOVE/WM_SIZE update Left/Top/Width/Height; setting them again here could round
        // differently at fractional scaling and nudge the window by a pixel.
        return NativeMethods.SetWindowPos(handle, IntPtr.Zero, left, top, right - left, bottom - top, flags);
    }

    public void ShowMenu(ContextMenu menu, UIElement? placementTarget = null)
    {
        menu.PlacementTarget = placementTarget ?? MenuButton;
        menu.Placement = System.Windows.Controls.Primitives.PlacementMode.Top;
        menu.IsOpen = true;
    }

    private void PowerButton_Click(object sender, RoutedEventArgs args) => PowerToggleRequested?.Invoke();

    private void MenuButton_Click(object sender, RoutedEventArgs args) => MenuRequested?.Invoke();

    private void LayoutButton_Click(object sender, RoutedEventArgs args) => LayoutMenuRequested?.Invoke();

    private void PreviewImage_MouseLeftButtonDown(object sender, System.Windows.Input.MouseButtonEventArgs args)
    {
        var point = args.GetPosition(PreviewSurface);
        var source = PreviewImage.Source;
        if (source is null)
        {
            PreviewClicked?.Invoke(point, Rect.Empty);
            return;
        }
        if (source.Width <= 0 || source.Height <= 0) return;
        var imageRect = DisplayGeometry.AspectFit(
            new Size(source.Width, source.Height),
            new Rect(0, 0, PreviewSurface.ActualWidth, PreviewSurface.ActualHeight));
        if (imageRect is { } rect) PreviewClicked?.Invoke(point, rect);
    }

    private static class NativeMethods
    {
        [StructLayout(LayoutKind.Sequential)]
        public struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool GetWindowRect(IntPtr handle, out RECT rect);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool SetWindowPos(IntPtr window, IntPtr insertAfter, int x, int y, int width, int height, uint flags);
    }
}
