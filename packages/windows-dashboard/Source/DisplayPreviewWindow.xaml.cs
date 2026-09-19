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
    public event Action<Point, Rect>? PreviewClicked;
    public event Action? FrameChanged;

    public double ChromeHeightDip => Math.Max(42, ActualHeight - PreviewImage.ActualHeight);

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
        PowerButton.Content = powerOn ? "⏻" : "⏻";
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

    public void ShowMenu(ContextMenu menu)
    {
        menu.PlacementTarget = PowerButton;
        menu.Placement = System.Windows.Controls.Primitives.PlacementMode.Top;
        menu.IsOpen = true;
    }

    private void PowerButton_Click(object sender, RoutedEventArgs args) => PowerToggleRequested?.Invoke();

    private void MenuButton_Click(object sender, RoutedEventArgs args) => MenuRequested?.Invoke();

    private void PreviewImage_MouseLeftButtonDown(object sender, System.Windows.Input.MouseButtonEventArgs args)
    {
        var point = args.GetPosition(PreviewImage);
        var source = PreviewImage.Source;
        if (source is null || source.Width <= 0 || source.Height <= 0) return;
        var imageRect = DisplayGeometry.AspectFit(
            new Size(source.Width, source.Height),
            new Rect(0, 0, PreviewImage.ActualWidth, PreviewImage.ActualHeight));
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
    }
}
