using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;

namespace ClassroomWidgets;

/// <summary>
/// Copies a source display into a WPF bitmap about 15 times a second on the UI thread.
/// The memory DC and DIB section are kept until the output size changes, and a source
/// larger than the preview is scaled down by GDI (HALFTONE) as it is copied, so the work
/// per frame follows the preview's size rather than the source monitor's.
/// </summary>
public sealed class DisplayCaptureSession : IDisposable
{
    private const uint Srccopy = 0x00CC0020;
    private const uint Captureblt = 0x40000000;
    private const int Halftone = 4;
    private readonly Rect _sourceBounds;
    private readonly Func<bool>? _canCapture;
    private readonly Func<Size>? _targetPixelSize;
    private readonly DispatcherTimer _timer;
    private readonly EventHandler _tickHandler;
    private WriteableBitmap? _bitmap;
    private IntPtr _memoryDc;
    private IntPtr _dib;
    private IntPtr _defaultBitmap;
    private IntPtr _bits;
    private int _width;
    private int _height;
    private bool _failed;
    private bool _disposed;

    public ImageSource? Image => _bitmap;
    public event Action<Exception>? Failed;
    public event Action? FrameReady;

    /// <param name="sourceBounds">The source display, in physical pixels.</param>
    /// <param name="canCapture">Skips a frame when it returns false.</param>
    /// <param name="targetPixelSize">
    /// The preview's size in physical pixels, read every frame. Without it, or while it is
    /// empty, frames are captured at the source size.
    /// </param>
    public DisplayCaptureSession(Rect sourceBounds, Func<bool>? canCapture = null, Func<Size>? targetPixelSize = null)
    {
        _sourceBounds = sourceBounds;
        _canCapture = canCapture;
        _targetPixelSize = targetPixelSize;
        _timer = new DispatcherTimer(DispatcherPriority.Background)
        {
            Interval = TimeSpan.FromMilliseconds(66)
        };
        _tickHandler = (_, _) => CaptureFrame();
        _timer.Tick += _tickHandler;
    }

    public void Start()
    {
        if (_disposed) return;
        _failed = false;
        _timer.Start();
        CaptureFrame();
    }

    private void CaptureFrame()
    {
        if (_disposed || _failed || (_canCapture is not null && !_canCapture())) return;
        var sourceWidth = Math.Max(1, (int)Math.Round(_sourceBounds.Width));
        var sourceHeight = Math.Max(1, (int)Math.Round(_sourceBounds.Height));
        var (width, height) = DisplayGeometry.CaptureSize(
            new Size(sourceWidth, sourceHeight),
            _targetPixelSize?.Invoke() ?? Size.Empty);
        var screenDc = IntPtr.Zero;
        try
        {
            EnsureSurface(width, height);
            screenDc = NativeMethods.GetDC(IntPtr.Zero);
            if (screenDc == IntPtr.Zero) throw new InvalidOperationException("Unable to acquire the screen device context.");
            var sourceX = (int)Math.Round(_sourceBounds.X);
            var sourceY = (int)Math.Round(_sourceBounds.Y);
            var copied = width == sourceWidth && height == sourceHeight
                ? NativeMethods.BitBlt(_memoryDc, 0, 0, width, height, screenDc, sourceX, sourceY, Srccopy | Captureblt)
                : NativeMethods.StretchBlt(_memoryDc, 0, 0, width, height, screenDc, sourceX, sourceY, sourceWidth, sourceHeight, Srccopy | Captureblt);
            if (!copied) throw new InvalidOperationException("Unable to copy the source display.");
            // The DIB's bits are read directly below, so GDI must have finished drawing.
            NativeMethods.GdiFlush();

            _bitmap = PresentFrame(_bitmap, _bits, width, height);
            FrameReady?.Invoke();
        }
        catch (Exception error)
        {
            _failed = true;
            _timer.Stop();
            ReleaseSurface();
            Failed?.Invoke(error);
        }
        finally
        {
            if (screenDc != IntPtr.Zero) NativeMethods.ReleaseDC(IntPtr.Zero, screenDc);
        }
    }

    /// <summary>Keeps one memory DC and a top-down 32-bit DIB section of the output size.</summary>
    private void EnsureSurface(int width, int height)
    {
        if (_memoryDc != IntPtr.Zero && _width == width && _height == height) return;
        ReleaseSurface();
        _memoryDc = NativeMethods.CreateCompatibleDC(IntPtr.Zero);
        if (_memoryDc == IntPtr.Zero) throw new InvalidOperationException("Unable to create the capture device context.");
        var info = new NativeMethods.BITMAPINFO
        {
            Header = new NativeMethods.BITMAPINFOHEADER
            {
                Size = (uint)Marshal.SizeOf<NativeMethods.BITMAPINFOHEADER>(),
                Width = width,
                Height = -height,
                Planes = 1,
                BitCount = 32,
                Compression = 0
            },
            Colors = new NativeMethods.RGBQUAD[1]
        };
        _dib = NativeMethods.CreateDIBSection(_memoryDc, ref info, 0, out _bits, IntPtr.Zero, 0);
        if (_dib == IntPtr.Zero || _bits == IntPtr.Zero)
        {
            ReleaseSurface();
            throw new InvalidOperationException("Unable to create the capture bitmap.");
        }
        _defaultBitmap = NativeMethods.SelectObject(_memoryDc, _dib);
        // HALFTONE averages the source pixels each output pixel covers, so text stays legible;
        // it needs the brush origin reset after the mode is set.
        NativeMethods.SetStretchBltMode(_memoryDc, Halftone);
        NativeMethods.SetBrushOrgEx(_memoryDc, 0, 0, IntPtr.Zero);
        _width = width;
        _height = height;
    }

    private void ReleaseSurface()
    {
        if (_memoryDc != IntPtr.Zero && _defaultBitmap != IntPtr.Zero) NativeMethods.SelectObject(_memoryDc, _defaultBitmap);
        if (_dib != IntPtr.Zero) NativeMethods.DeleteObject(_dib);
        if (_memoryDc != IntPtr.Zero) NativeMethods.DeleteDC(_memoryDc);
        _memoryDc = IntPtr.Zero;
        _dib = IntPtr.Zero;
        _defaultBitmap = IntPtr.Zero;
        _bits = IntPtr.Zero;
        _width = 0;
        _height = 0;
    }

    /// <summary>Writes a top-down 32-bit BI_RGB GDI frame (B, G, R, unused) into a WPF bitmap.</summary>
    internal static WriteableBitmap PresentFrame(WriteableBitmap? bitmap, byte[] pixels, int width, int height)
    {
        var handle = GCHandle.Alloc(pixels, GCHandleType.Pinned);
        try
        {
            return PresentFrame(bitmap, handle.AddrOfPinnedObject(), width, height);
        }
        finally
        {
            handle.Free();
        }
    }

    private static WriteableBitmap PresentFrame(WriteableBitmap? bitmap, IntPtr pixels, int width, int height)
    {
        if (bitmap is null || bitmap.PixelWidth != width || bitmap.PixelHeight != height)
        {
            bitmap = new WriteableBitmap(width, height, 96, 96, PixelFormats.Bgr32, null);
        }
        bitmap.WritePixels(new Int32Rect(0, 0, width, height), pixels, width * height * 4, width * 4);
        return bitmap;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _timer.Stop();
        _timer.Tick -= _tickHandler;
        ReleaseSurface();
        _bitmap = null;
    }

    private static class NativeMethods
    {
        [StructLayout(LayoutKind.Sequential)]
        public struct BITMAPINFOHEADER
        {
            public uint Size;
            public int Width;
            public int Height;
            public ushort Planes;
            public ushort BitCount;
            public uint Compression;
            public uint SizeImage;
            public int XPelsPerMeter;
            public int YPelsPerMeter;
            public uint ClrUsed;
            public uint ClrImportant;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct RGBQUAD
        {
            public byte Blue;
            public byte Green;
            public byte Red;
            public byte Reserved;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct BITMAPINFO
        {
            public BITMAPINFOHEADER Header;
            [MarshalAs(UnmanagedType.ByValArray, SizeConst = 1)]
            public RGBQUAD[] Colors;
        }

        [DllImport("user32.dll")]
        public static extern IntPtr GetDC(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDc);

        [DllImport("gdi32.dll")]
        public static extern IntPtr CreateCompatibleDC(IntPtr hDc);

        [DllImport("gdi32.dll")]
        public static extern IntPtr SelectObject(IntPtr hDc, IntPtr objectHandle);

        [DllImport("gdi32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool DeleteObject(IntPtr objectHandle);

        [DllImport("gdi32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool DeleteDC(IntPtr hDc);

        [DllImport("gdi32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool BitBlt(IntPtr destination, int x, int y, int width, int height, IntPtr source, int sourceX, int sourceY, uint rasterOperation);

        [DllImport("gdi32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool StretchBlt(IntPtr destination, int x, int y, int width, int height, IntPtr source, int sourceX, int sourceY, int sourceWidth, int sourceHeight, uint rasterOperation);

        [DllImport("gdi32.dll")]
        public static extern int SetStretchBltMode(IntPtr hDc, int mode);

        [DllImport("gdi32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool SetBrushOrgEx(IntPtr hDc, int x, int y, IntPtr previous);

        [DllImport("gdi32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool GdiFlush();

        [DllImport("gdi32.dll")]
        public static extern IntPtr CreateDIBSection(IntPtr hDc, ref BITMAPINFO bitmapInfo, uint usage, out IntPtr bits, IntPtr section, uint offset);
    }
}
