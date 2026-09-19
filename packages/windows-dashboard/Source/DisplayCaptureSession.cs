using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;

namespace ClassroomWidgets;

public sealed class DisplayCaptureSession : IDisposable
{
    private const uint Srccopy = 0x00CC0020;
    private const uint Captureblt = 0x40000000;
    private readonly Rect _sourceBounds;
    private readonly Func<bool>? _canCapture;
    private readonly DispatcherTimer _timer;
    private readonly EventHandler _tickHandler;
    private WriteableBitmap? _bitmap;
    private bool _failed;

    public ImageSource? Image => _bitmap;
    public event Action<Exception>? Failed;
    public event Action? FrameReady;

    public DisplayCaptureSession(Rect sourceBounds, Func<bool>? canCapture = null)
    {
        _sourceBounds = sourceBounds;
        _canCapture = canCapture;
        _timer = new DispatcherTimer(DispatcherPriority.Background)
        {
            Interval = TimeSpan.FromMilliseconds(66)
        };
        _tickHandler = (_, _) => CaptureFrame();
        _timer.Tick += _tickHandler;
    }

    public void Start()
    {
        _failed = false;
        _timer.Start();
        CaptureFrame();
    }

    public void Stop() => _timer.Stop();

    private void CaptureFrame()
    {
        if (_failed || (_canCapture is not null && !_canCapture())) return;
        var width = Math.Max(1, (int)Math.Round(_sourceBounds.Width));
        var height = Math.Max(1, (int)Math.Round(_sourceBounds.Height));
        var screenDc = NativeMethods.GetDC(IntPtr.Zero);
        var memoryDc = IntPtr.Zero;
        var bitmap = IntPtr.Zero;
        var oldObject = IntPtr.Zero;
        try
        {
            if (screenDc == IntPtr.Zero) throw new InvalidOperationException("Unable to acquire the screen device context.");
            memoryDc = NativeMethods.CreateCompatibleDC(screenDc);
            bitmap = NativeMethods.CreateCompatibleBitmap(screenDc, width, height);
            if (memoryDc == IntPtr.Zero || bitmap == IntPtr.Zero) throw new InvalidOperationException("Unable to create the capture bitmap.");
            oldObject = NativeMethods.SelectObject(memoryDc, bitmap);
            if (!NativeMethods.BitBlt(memoryDc, 0, 0, width, height, screenDc,
                    (int)Math.Round(_sourceBounds.X), (int)Math.Round(_sourceBounds.Y), Srccopy | Captureblt))
            {
                throw new InvalidOperationException("Unable to copy the source display.");
            }

            var pixels = new byte[width * height * 4];
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
            var handle = GCHandle.Alloc(pixels, GCHandleType.Pinned);
            try
            {
                if (NativeMethods.GetDIBits(screenDc, bitmap, 0, (uint)height, handle.AddrOfPinnedObject(), ref info, 0) == 0)
                {
                    throw new InvalidOperationException("Unable to read the capture bitmap.");
                }
            }
            finally
            {
                handle.Free();
            }

            if (_bitmap is null || _bitmap.PixelWidth != width || _bitmap.PixelHeight != height)
            {
                _bitmap = new WriteableBitmap(width, height, 96, 96, PixelFormats.Bgra32, null);
            }
            _bitmap.WritePixels(new Int32Rect(0, 0, width, height), pixels, width * 4, 0);
            FrameReady?.Invoke();
        }
        catch (Exception error)
        {
            _failed = true;
            _timer.Stop();
            Failed?.Invoke(error);
        }
        finally
        {
            if (oldObject != IntPtr.Zero && memoryDc != IntPtr.Zero) NativeMethods.SelectObject(memoryDc, oldObject);
            if (bitmap != IntPtr.Zero) NativeMethods.DeleteObject(bitmap);
            if (memoryDc != IntPtr.Zero) NativeMethods.DeleteDC(memoryDc);
            if (screenDc != IntPtr.Zero) NativeMethods.ReleaseDC(IntPtr.Zero, screenDc);
        }
    }

    public void Dispose()
    {
        _timer.Stop();
        _timer.Tick -= _tickHandler;
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
        public static extern IntPtr CreateCompatibleBitmap(IntPtr hDc, int width, int height);

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
        public static extern int GetDIBits(IntPtr hDc, IntPtr bitmap, uint startScan, uint scanLines, IntPtr bits, ref BITMAPINFO bitmapInfo, uint usage);
    }
}
