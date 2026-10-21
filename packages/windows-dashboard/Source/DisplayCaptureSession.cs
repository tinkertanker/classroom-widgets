using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;

namespace ClassroomWidgets;

/// <summary>
/// Copies a source display into a WPF bitmap on the UI thread, at most about 15 times a
/// second (the 66 ms timer re-arms after each frame, so slow frames lower the rate).
/// The memory DC, screen-compatible bitmap and pixel buffer are kept until the output size
/// changes. When the preview is at most half the source size, GDI scales the frame down as it
/// copies (COLORONCOLOR), so the pixels read back, copied into WPF and uploaded are
/// preview-sized. GDI still reads the whole source rectangle, which is the bulk of the cost
/// on large sources; moving capture off the UI thread is the next step (#211 phase 2).
/// </summary>
public sealed class DisplayCaptureSession : IDisposable
{
    private const uint Srccopy = 0x00CC0020;
    private const uint Captureblt = 0x40000000;
    private const int ColorOnColor = 3;
    // Measured on Windows (#211): HALFTONE costs as much as an unscaled copy of the source,
    // while COLORONCOLOR is cheaper. Its point sampling is comparable to, if somewhat harsher
    // than, the bilinear downscale WPF applied to full-size frames before.
    private const int StretchMode = ColorOnColor;
    // Above this scale, keep the unscaled copy: the preview shows nearly every source pixel.
    private const double MaxStretchScale = 0.5;
    // While the preview is being resized, keep the current surface until the new size has
    // held for this many frames; Stretch=Uniform covers the difference meanwhile.
    private const int ResizeSettleFrames = 3;
    // A display mode change can fail a frame or two; rebuild the surface and retry, and only
    // give up after this many failures in a row (about 200 ms). Longer outages, such as the
    // lock screen, still stop the preview, as before.
    private const int MaxConsecutiveFailures = 3;
    private readonly Rect _sourceBounds;
    private readonly Func<bool>? _canCapture;
    private readonly Func<Size>? _targetPixelSize;
    private readonly DispatcherTimer _timer;
    private readonly EventHandler _tickHandler;
    private WriteableBitmap? _bitmap;
    private IntPtr _memoryDc;
    private IntPtr _surface;
    private IntPtr _pixels;
    private NativeMethods.BITMAPINFO _bitmapInfo;
    private int _width;
    private int _height;
    private (int Width, int Height) _pendingSize;
    private int _pendingFrames;
    private int _consecutiveFailures;
    private bool _failed;
    private bool _disposed;

    public ImageSource? Image => _bitmap;
    public event Action<Exception>? Failed;
    public event Action? FrameReady;

    /// <param name="sourceBounds">The source display, in physical pixels.</param>
    /// <param name="canCapture">
    /// Skips a frame when it returns false, and frees the capture surface until it returns true.
    /// </param>
    /// <param name="targetPixelSize">
    /// The preview's image area in physical pixels, read every frame. Without it, frames are
    /// captured at the source size. While it is under one pixel in either direction, or not
    /// finite, frames are skipped.
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
        _consecutiveFailures = 0;
        _timer.Start();
        CaptureFrame();
    }

    private void CaptureFrame()
    {
        if (_disposed || _failed) return;
        var screenDc = IntPtr.Zero;
        var previous = IntPtr.Zero;
        var presented = false;
        try
        {
            if (_canCapture is not null && !_canCapture())
            {
                // Hidden or minimised: free the surface (up to ~70 MB at 4K) until it is back.
                ReleaseSurface();
                return;
            }
            var sourceWidth = Math.Max(1, (int)Math.Round(_sourceBounds.Width));
            var sourceHeight = Math.Max(1, (int)Math.Round(_sourceBounds.Height));
            if (OutputSize(sourceWidth, sourceHeight) is not { } size) return;
            var (width, height) = size;
            screenDc = NativeMethods.GetDC(IntPtr.Zero);
            if (screenDc == IntPtr.Zero) throw new InvalidOperationException("Unable to acquire the screen device context.");
            EnsureSurface(screenDc, width, height);
            previous = NativeMethods.SelectObject(_memoryDc, _surface);
            if (previous == IntPtr.Zero) throw new InvalidOperationException("Unable to select the capture bitmap.");
            var sourceX = (int)Math.Round(_sourceBounds.X);
            var sourceY = (int)Math.Round(_sourceBounds.Y);
            var copied = width == sourceWidth && height == sourceHeight
                ? NativeMethods.BitBlt(_memoryDc, 0, 0, width, height, screenDc, sourceX, sourceY, Srccopy | Captureblt)
                : NativeMethods.StretchBlt(_memoryDc, 0, 0, width, height, screenDc, sourceX, sourceY, sourceWidth, sourceHeight, Srccopy | Captureblt);
            if (!copied)
            {
                throw new InvalidOperationException($"Unable to copy the source display (error {Marshal.GetLastWin32Error()}).");
            }
            // GetDIBits needs the bitmap deselected.
            NativeMethods.SelectObject(_memoryDc, previous);
            previous = IntPtr.Zero;
            if (NativeMethods.GetDIBits(screenDc, _surface, 0, (uint)height, _pixels, ref _bitmapInfo, 0) == 0)
            {
                throw new InvalidOperationException("Unable to read the capture bitmap.");
            }

            _bitmap = PresentFrame(_bitmap, _pixels, width, height);
            presented = true;
        }
        catch (Exception error)
        {
            if (previous != IntPtr.Zero)
            {
                NativeMethods.SelectObject(_memoryDc, previous);
                previous = IntPtr.Zero;
            }
            ReleaseSurface();
            if (++_consecutiveFailures < MaxConsecutiveFailures)
            {
                DashboardLog.Warn($"Display capture frame failed ({_consecutiveFailures} in a row), retrying: {error.Message}");
                return;
            }
            _failed = true;
            _timer.Stop();
            Failed?.Invoke(error);
        }
        finally
        {
            if (previous != IntPtr.Zero) NativeMethods.SelectObject(_memoryDc, previous);
            if (screenDc != IntPtr.Zero) NativeMethods.ReleaseDC(IntPtr.Zero, screenDc);
        }
        if (!presented) return;
        _consecutiveFailures = 0;
        // Outside the try: a handler's exception is the handler's bug, not a capture failure.
        FrameReady?.Invoke();
    }

    /// <summary>The size to capture this frame at, or null to skip the frame.</summary>
    private (int Width, int Height)? OutputSize(int sourceWidth, int sourceHeight)
    {
        var desired = (sourceWidth, sourceHeight);
        if (_targetPixelSize is not null)
        {
            if (DisplayGeometry.CaptureSize(new Size(sourceWidth, sourceHeight), _targetPixelSize()) is not { } fitted) return null;
            if (fitted.Width <= sourceWidth * MaxStretchScale && fitted.Height <= sourceHeight * MaxStretchScale)
            {
                desired = fitted;
            }
        }
        if (_surface == IntPtr.Zero || desired == (_width, _height))
        {
            _pendingFrames = 0;
            return desired;
        }
        if (desired == _pendingSize)
        {
            _pendingFrames++;
        }
        else
        {
            _pendingSize = desired;
            _pendingFrames = 1;
        }
        if (_pendingFrames < ResizeSettleFrames) return (_width, _height);
        _pendingFrames = 0;
        return desired;
    }

    /// <summary>Keeps one memory DC, a screen-compatible bitmap and a 32-bit pixel buffer of the output size.</summary>
    private void EnsureSurface(IntPtr screenDc, int width, int height)
    {
        if (_surface != IntPtr.Zero && _width == width && _height == height) return;
        ReleaseSurface();
        try
        {
            _memoryDc = NativeMethods.CreateCompatibleDC(screenDc);
            _surface = NativeMethods.CreateCompatibleBitmap(screenDc, width, height);
            if (_memoryDc == IntPtr.Zero || _surface == IntPtr.Zero) throw new InvalidOperationException("Unable to create the capture bitmap.");
            _pixels = Marshal.AllocHGlobal(checked(width * height * 4));
            NativeMethods.SetStretchBltMode(_memoryDc, StretchMode);
        }
        catch
        {
            ReleaseSurface();
            throw;
        }
        _bitmapInfo = new NativeMethods.BITMAPINFO
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
        _width = width;
        _height = height;
    }

    private void ReleaseSurface()
    {
        if (_surface != IntPtr.Zero) NativeMethods.DeleteObject(_surface);
        if (_memoryDc != IntPtr.Zero) NativeMethods.DeleteDC(_memoryDc);
        if (_pixels != IntPtr.Zero) Marshal.FreeHGlobal(_pixels);
        _surface = IntPtr.Zero;
        _memoryDc = IntPtr.Zero;
        _pixels = IntPtr.Zero;
        _width = 0;
        _height = 0;
    }

    /// <summary>Writes a top-down 32-bit BI_RGB GDI frame (B, G, R, unused) into a WPF bitmap.</summary>
    internal static WriteableBitmap PresentFrame(WriteableBitmap? bitmap, byte[] pixels, int width, int height)
    {
        if (pixels.Length < width * height * 4) throw new ArgumentException("The frame is smaller than its size.", nameof(pixels));
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

        [DllImport("gdi32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool BitBlt(IntPtr destination, int x, int y, int width, int height, IntPtr source, int sourceX, int sourceY, uint rasterOperation);

        [DllImport("gdi32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool StretchBlt(IntPtr destination, int x, int y, int width, int height, IntPtr source, int sourceX, int sourceY, int sourceWidth, int sourceHeight, uint rasterOperation);

        [DllImport("gdi32.dll")]
        public static extern IntPtr CreateCompatibleBitmap(IntPtr hDc, int width, int height);

        [DllImport("gdi32.dll")]
        public static extern int GetDIBits(IntPtr hDc, IntPtr bitmap, uint startScan, uint scanLines, IntPtr bits, ref BITMAPINFO bitmapInfo, uint usage);

        [DllImport("gdi32.dll")]
        public static extern int SetStretchBltMode(IntPtr hDc, int mode);

    }
}
