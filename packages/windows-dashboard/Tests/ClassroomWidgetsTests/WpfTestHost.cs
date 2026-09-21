using System.IO;
using System.Runtime.ExceptionServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;

namespace ClassroomWidgetsTests;

/// <summary>Runs WPF code on a dedicated STA thread and pumps its dispatcher.</summary>
internal static class WpfTestHost
{
    private static readonly string? EvidenceDirectory =
        Environment.GetEnvironmentVariable("CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR");

    public static void Run(Action body)
    {
        Exception? failure = null;
        var thread = new Thread(() =>
        {
            try
            {
                body();
            }
            catch (Exception error)
            {
                failure = error;
            }
            finally
            {
                Dispatcher.CurrentDispatcher.InvokeShutdown();
            }
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.IsBackground = true;
        thread.Start();
        thread.Join();
        if (failure is not null) ExceptionDispatchInfo.Capture(failure).Throw();
    }

    public static void PumpFor(TimeSpan duration)
    {
        var deadline = DateTime.UtcNow + duration;
        while (DateTime.UtcNow < deadline)
        {
            DoEvents();
            Thread.Sleep(10);
        }
    }

    public static void PumpUntil(Func<bool> condition, TimeSpan timeout, string what)
    {
        var deadline = DateTime.UtcNow + timeout;
        while (!condition())
        {
            if (DateTime.UtcNow > deadline) throw new TimeoutException($"Timed out waiting for {what}.");
            DoEvents();
            Thread.Sleep(10);
        }
    }

    public static void DoEvents()
    {
        var frame = new DispatcherFrame();
        Dispatcher.CurrentDispatcher.BeginInvoke(DispatcherPriority.ContextIdle, new Action(() => frame.Continue = false));
        Dispatcher.PushFrame(frame);
    }

    /// <summary>Draws the image through a WPF Image element over a black background, 1:1, and returns BGRA pixels.</summary>
    public static byte[] RenderOverBlack(ImageSource image, int width, int height)
    {
        var element = new Image
        {
            Source = image,
            Stretch = Stretch.None,
            SnapsToDevicePixels = true
        };
        RenderOptions.SetBitmapScalingMode(element, BitmapScalingMode.NearestNeighbor);
        var surface = new Grid { Background = Brushes.Black, Width = width, Height = height };
        surface.Children.Add(element);
        surface.Measure(new Size(width, height));
        surface.Arrange(new Rect(0, 0, width, height));
        surface.UpdateLayout();
        var target = new RenderTargetBitmap(width, height, 96, 96, PixelFormats.Pbgra32);
        target.Render(surface);
        var pixels = new byte[width * height * 4];
        target.CopyPixels(pixels, width * 4, 0);
        return pixels;
    }

    public static (byte R, byte G, byte B, byte A) PixelAt(byte[] bgra, int width, int x, int y)
    {
        var offset = (y * width + x) * 4;
        return (bgra[offset + 2], bgra[offset + 1], bgra[offset], bgra[offset + 3]);
    }

    public static void SaveEvidence(string name, BitmapSource image)
    {
        if (string.IsNullOrEmpty(EvidenceDirectory)) return;
        Directory.CreateDirectory(EvidenceDirectory);
        var encoder = new PngBitmapEncoder();
        encoder.Frames.Add(BitmapFrame.Create(image));
        using var stream = File.Create(Path.Combine(EvidenceDirectory, name));
        encoder.Save(stream);
    }

    public static void SaveEvidence(string name, byte[] bgra, int width, int height)
        => SaveEvidence(name, BitmapSource.Create(width, height, 96, 96, PixelFormats.Pbgra32, null, bgra, width * 4));
}
