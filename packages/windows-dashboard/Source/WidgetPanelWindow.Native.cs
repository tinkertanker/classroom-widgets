using System.Runtime.InteropServices;
using System.Windows;

namespace ClassroomWidgets;

/// <summary>Win32 interop: composited transparency and aspect-locked resizing.</summary>
public partial class WidgetPanelWindow
{
    /// <summary>
    /// WPF's AllowsTransparency breaks WebView2, so unpainted pixels are made
    /// see-through by DWM instead via a fully transparent accent policy.
    /// </summary>
    private static void EnableCompositedTransparency(IntPtr handle)
    {
        if (handle == IntPtr.Zero) return;
        var policy = new NativeMethods.ACCENT_POLICY
        {
            AccentState = NativeMethods.ACCENT_ENABLE_TRANSPARENTGRADIENT,
            AccentFlags = NativeMethods.ACCENT_FLAG_USE_GRADIENT_COLOR,
            GradientColor = 0
        };
        var size = Marshal.SizeOf<NativeMethods.ACCENT_POLICY>();
        var buffer = Marshal.AllocHGlobal(size);
        try
        {
            Marshal.StructureToPtr(policy, buffer, false);
            var data = new NativeMethods.WINDOWCOMPOSITIONATTRIBDATA
            {
                Attribute = NativeMethods.WCA_ACCENT_POLICY,
                Data = buffer,
                SizeOfData = size
            };
            NativeMethods.SetWindowCompositionAttribute(handle, ref data);
        }
        finally
        {
            Marshal.FreeHGlobal(buffer);
        }
    }

    /// <summary>
    /// Keeps interactive resizes on the descriptor's content aspect ratio
    /// (chrome height excluded), matching the NSWindow contentAspectRatio
    /// behaviour of the macOS shell.
    /// </summary>
    private IntPtr WindowProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (msg != NativeMethods.WM_SIZING || _descriptor.AspectRatio is not { } ratio || ratio <= 0) return IntPtr.Zero;
        if (PresentationSource.FromVisual(this)?.CompositionTarget is not { } target) return IntPtr.Zero;

        var scale = target.TransformToDevice.M22;
        var chrome = ChromeHeight * scale;
        var rect = Marshal.PtrToStructure<NativeMethods.RECT>(lParam);
        var width = (double)(rect.Right - rect.Left);
        var height = rect.Bottom - rect.Top - chrome;
        var edge = wParam.ToInt32();

        var drivesWidth = edge is NativeMethods.WMSZ_LEFT or NativeMethods.WMSZ_RIGHT;
        var drivesHeight = edge is NativeMethods.WMSZ_TOP or NativeMethods.WMSZ_BOTTOM;
        if (drivesWidth || (!drivesHeight && width / Math.Max(height, 1) > ratio))
        {
            height = width / ratio;
        }
        else
        {
            width = height * ratio;
        }

        var totalHeight = (int)Math.Round(height + chrome);
        var totalWidth = (int)Math.Round(width);
        if (edge is NativeMethods.WMSZ_LEFT or NativeMethods.WMSZ_TOPLEFT or NativeMethods.WMSZ_BOTTOMLEFT) rect.Left = rect.Right - totalWidth;
        else rect.Right = rect.Left + totalWidth;
        if (edge is NativeMethods.WMSZ_TOP or NativeMethods.WMSZ_TOPLEFT or NativeMethods.WMSZ_TOPRIGHT) rect.Top = rect.Bottom - totalHeight;
        else rect.Bottom = rect.Top + totalHeight;

        Marshal.StructureToPtr(rect, lParam, false);
        handled = true;
        return (IntPtr)1;
    }

    private static class NativeMethods
    {
        public const int WM_SIZING = 0x0214;
        public const int WCA_ACCENT_POLICY = 19;
        public const int ACCENT_ENABLE_TRANSPARENTGRADIENT = 2;
        public const int ACCENT_FLAG_USE_GRADIENT_COLOR = 2;

        [StructLayout(LayoutKind.Sequential)]
        public struct ACCENT_POLICY
        {
            public int AccentState;
            public int AccentFlags;
            public uint GradientColor;
            public int AnimationId;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct WINDOWCOMPOSITIONATTRIBDATA
        {
            public int Attribute;
            public IntPtr Data;
            public int SizeOfData;
        }

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool SetWindowCompositionAttribute(IntPtr hWnd, ref WINDOWCOMPOSITIONATTRIBDATA data);
        public const int WMSZ_LEFT = 1;
        public const int WMSZ_RIGHT = 2;
        public const int WMSZ_TOP = 3;
        public const int WMSZ_TOPLEFT = 4;
        public const int WMSZ_TOPRIGHT = 5;
        public const int WMSZ_BOTTOM = 6;
        public const int WMSZ_BOTTOMLEFT = 7;
        public const int WMSZ_BOTTOMRIGHT = 8;

        [StructLayout(LayoutKind.Sequential)]
        public struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct POINT
        {
            public int X;
            public int Y;
        }

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool GetCursorPos(out POINT point);

    }
}
