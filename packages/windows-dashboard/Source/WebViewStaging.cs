using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;

namespace ClassroomWidgets;

/// <summary>
/// WPF creates a web view's native window only once its window is shown, so a
/// web view prepared ahead of time loads in an off-screen staging window and
/// later moves into the window that uses it. WebView2 may not notice a DPI
/// change caused by that move, so a web view only moves between windows on
/// monitors with the same DPI.
/// </summary>
internal static class WebViewStaging
{
    public static Window CreateWindow(string title, double width, double height) => new()
    {
        Title = title,
        Width = width,
        Height = height,
        Left = -32000,
        Top = -32000,
        ShowInTaskbar = false,
        ShowActivated = false,
        WindowStyle = WindowStyle.None,
        ResizeMode = ResizeMode.NoResize
    };

    /// <summary>Whether both windows' native windows exist and share a DPI.</summary>
    public static bool SameDpi(Window staging, Window target)
    {
        var stagingHandle = new WindowInteropHelper(staging).Handle;
        var targetHandle = new WindowInteropHelper(target).Handle;
        return stagingHandle != IntPtr.Zero && targetHandle != IntPtr.Zero
            && GetDpiForWindow(stagingHandle) == GetDpiForWindow(targetHandle);
    }

    [DllImport("user32.dll")]
    private static extern uint GetDpiForWindow(IntPtr window);
}
