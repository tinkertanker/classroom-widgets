using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;

namespace ClassroomWidgets;

/// <summary>
/// Captures on one worker, awaiting presentation before starting another frame. There is
/// one reusable pixel buffer and at most one pending frame, even if the dispatcher stalls.
/// Only preview-state reads, WPF presentation and events run on the creating dispatcher.
/// The 66 ms delay follows each frame, so slow capture/presentation lowers the rate.
/// The memory DC, screen-compatible bitmap and pixel buffer are kept until the output size
/// changes. When the preview is at most half the source size, GDI scales the frame down as it
/// copies (COLORONCOLOR), so the pixels read back, copied into WPF and uploaded are
/// preview-sized. Disposal cancels queued presentation immediately; the worker releases its
/// native resources after any in-flight GDI call, without blocking the dispatcher.
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
    private readonly Dispatcher _dispatcher;
    private readonly CancellationTokenSource _stop = new();
    private Task? _worker;
    private WriteableBitmap? _bitmap;
    // Native resources and resize hysteresis belong exclusively to the worker. It keeps
    // the buffer unchanged while the dispatcher consumes it.
    private IntPtr _memoryDc;
    private IntPtr _surface;
    private IntPtr _pixels;
    private NativeMethods.BITMAPINFO _bitmapInfo;
    private int _width;
    private int _height;
    private (int Width, int Height) _pendingSize;
    private int _pendingFrames;
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
        _dispatcher = Dispatcher.CurrentDispatcher;
    }

    /// <summary>Starts asynchronous capture. Repeated starts while running do not enqueue work.</summary>
    public void Start()
    {
        _dispatcher.VerifyAccess();
        if (_disposed || _worker is { IsCompleted: false }) return;
        _worker = Task.Run(CaptureLoopAsync);
    }

    private async Task CaptureLoopAsync()
    {
        var token = _stop.Token;
        var consecutiveFailures = 0;
        var sourceWidth = Math.Max(1, (int)Math.Round(_sourceBounds.Width));
        var sourceHeight = Math.Max(1, (int)Math.Round(_sourceBounds.Height));
        try
        {
            while (!token.IsCancellationRequested)
            {
                var inFrameHandler = false;
                try
                {
                    // These callbacks may read WPF controls. Snapshot them before doing
                    // native work; no WPF object is accessed by the capture worker.
                    var target = await _dispatcher.InvokeAsync(() =>
                        _canCapture?.Invoke() == false ? (Size?)null : _targetPixelSize?.Invoke() ?? _sourceBounds.Size,
                        DispatcherPriority.Background, token).Task.ConfigureAwait(false);
                    token.ThrowIfCancellationRequested();
                    if (target is null)
                    {
                        ReleaseSurface();
                    }
                    else if (OutputSize(sourceWidth, sourceHeight, target.Value) is { } size)
                    {
                        CaptureFrame(sourceWidth, sourceHeight, size.Width, size.Height);
                        var presented = await _dispatcher.InvokeAsync(() =>
                        {
                            // Visibility may have changed while GDI was busy. Never publish
                            // a late frame from a disposed/replaced or hidden session.
                            if (_canCapture?.Invoke() == false) return false;
                            token.ThrowIfCancellationRequested();
                            _bitmap = PresentFrame(_bitmap, _pixels, size.Width, size.Height);
                            inFrameHandler = true;
                            FrameReady?.Invoke();
                            inFrameHandler = false;
                            return true;
                        }, DispatcherPriority.Background, token).Task.ConfigureAwait(false);
                        if (presented) consecutiveFailures = 0;
                    }
                }
                catch (OperationCanceledException) when (token.IsCancellationRequested || _dispatcher.HasShutdownStarted)
                {
                    break;
                }
                catch (Exception error)
                {
                    ReleaseSurface();
                    if (inFrameHandler || ++consecutiveFailures >= MaxConsecutiveFailures)
                    {
                        DashboardLog.Error($"Display capture stopped: {error}");
                        await _dispatcher.InvokeAsync(() => Failed?.Invoke(error),
                            DispatcherPriority.Background, token).Task.ConfigureAwait(false);
                        return;
                    }
                    DashboardLog.Warn($"Display capture frame failed ({consecutiveFailures} in a row), retrying: {error.Message}");
                }
                await Task.Delay(66, token).ConfigureAwait(false);
            }
        }
        catch (OperationCanceledException) when (token.IsCancellationRequested || _dispatcher.HasShutdownStarted)
        {
        }
        catch (Exception error)
        {
            // A Failed subscriber must not leave an unobserved worker exception.
            DashboardLog.Error($"Display capture failure handler failed: {error}");
        }
        finally
        {
            ReleaseSurface();
        }
    }

    private void CaptureFrame(int sourceWidth, int sourceHeight, int width, int height)
    {
        var screenDc = IntPtr.Zero;
        var previous = IntPtr.Zero;
        try
        {
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
        }
        finally
        {
            if (previous != IntPtr.Zero) NativeMethods.SelectObject(_memoryDc, previous);
            if (screenDc != IntPtr.Zero) NativeMethods.ReleaseDC(IntPtr.Zero, screenDc);
        }
    }

    /// <summary>The size to capture this frame at, or null to skip the frame.</summary>
    private (int Width, int Height)? OutputSize(int sourceWidth, int sourceHeight, Size target)
    {
        var desired = (sourceWidth, sourceHeight);
        if (DisplayGeometry.CaptureSize(new Size(sourceWidth, sourceHeight), target) is not { } fitted) return null;
        if (fitted.Width <= sourceWidth * MaxStretchScale && fitted.Height <= sourceHeight * MaxStretchScale)
        {
            desired = fitted;
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
        _dispatcher.VerifyAccess();
        if (_disposed) return;
        _disposed = true;
        _stop.Cancel();
        // The worker owns native resources, including while presentation is queued. Do not
        // free its buffer here or wait for GDI on the dispatcher. Its finally releases it
        // even if the dispatcher shuts down before the pending operation can run.
        _ = (_worker ?? Task.CompletedTask).ContinueWith(_ => _stop.Dispose(), TaskScheduler.Default);
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
