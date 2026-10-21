using System.IO;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using ClassroomWidgets;
using Xunit;

namespace ClassroomWidgetsTests;

public sealed class DisplayCaptureSessionTests
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(10);

    // GDI's 32-bit BI_RGB layout is B, G, R, then an unused byte that GDI is free to leave at zero.
    [Fact]
    public void PresentFrameRendersOpaquePixelsInGdiChannelOrderWhenHighByteIsZero()
    {
        WpfTestHost.Run(() =>
        {
            const int width = 3;
            const int height = 2;
            byte[] pixels =
            {
                // row 0 (top): B, G, R, unused
                10, 20, 200, 0, 30, 200, 40, 0, 200, 50, 60, 0,
                // row 1 (bottom)
                0, 0, 255, 0, 255, 255, 255, 0, 90, 160, 30, 0x7F
            };

            var bitmap = DisplayCaptureSession.PresentFrame(null, pixels, width, height);
            var rendered = WpfTestHost.RenderOverBlack(bitmap, width, height);
            WpfTestHost.SaveEvidence("154-fixture-rendered.png", rendered, width, height);

            Assert.Equal(((byte)200, (byte)20, (byte)10, (byte)255), WpfTestHost.PixelAt(rendered, width, 0, 0));
            Assert.Equal(((byte)40, (byte)200, (byte)30, (byte)255), WpfTestHost.PixelAt(rendered, width, 1, 0));
            Assert.Equal(((byte)60, (byte)50, (byte)200, (byte)255), WpfTestHost.PixelAt(rendered, width, 2, 0));
            Assert.Equal(((byte)255, (byte)0, (byte)0, (byte)255), WpfTestHost.PixelAt(rendered, width, 0, 1));
            Assert.Equal(((byte)255, (byte)255, (byte)255, (byte)255), WpfTestHost.PixelAt(rendered, width, 1, 1));
            Assert.Equal(((byte)30, (byte)160, (byte)90, (byte)255), WpfTestHost.PixelAt(rendered, width, 2, 1));

            // Reusing the bitmap for a same-size frame must keep the same instance and format.
            Assert.Same(bitmap, DisplayCaptureSession.PresentFrame(bitmap, pixels, width, height));
        });
    }

    [Fact]
    public void LiveCaptureOfSyntheticContentRendersCorrectColoursAndOrientation()
    {
        WpfTestHost.Run(() =>
        {
            var region = new Rect(0, 0, 400, 300);
            var source = new SyntheticSourceWindow(region);
            try
            {
                source.ShowAndWaitUntilOnScreen();
                using var session = new DisplayCaptureSession(region);
                var frames = 0;
                Exception? failure = null;
                session.FrameReady += () => frames++;
                session.Failed += error => failure = error;
                session.Start();
                WpfTestHost.PumpUntil(() => frames >= 2 || failure is not null, Timeout, "a captured frame");
                Assert.Null(failure);

                var image = Assert.IsType<WriteableBitmap>(session.Image);
                Assert.Equal(400, image.PixelWidth);
                Assert.Equal(300, image.PixelHeight);
                var rendered = WpfTestHost.RenderOverBlack(image, 400, 300);
                WpfTestHost.SaveEvidence("154-live-capture-rendered.png", rendered, 400, 300);

                AssertColour(SyntheticSourceWindow.TopLeft, WpfTestHost.PixelAt(rendered, 400, 100, 75));
                AssertColour(SyntheticSourceWindow.TopRight, WpfTestHost.PixelAt(rendered, 400, 300, 75));
                AssertColour(SyntheticSourceWindow.BottomLeft, WpfTestHost.PixelAt(rendered, 400, 100, 225));
                AssertColour(SyntheticSourceWindow.BottomRight, WpfTestHost.PixelAt(rendered, 400, 300, 225));
            }
            finally
            {
                source.Close();
            }
        });
    }

    // Capturing at preview size (#211) can go wrong by: drawing the scaled frame with the
    // wrong channel order or upside down; keeping a stale buffer or bitmap after the preview
    // is resized (wrong size, stride mismatch or an exception); upscaling past the source;
    // capturing a full-size frame, or failing, while the preview has no size yet; scaling
    // with GDI's default stretch mode, which ANDs pixels together so detail goes dark; and
    // leaking the reused memory DC or bitmap on resize or dispose.
    [Fact]
    public void ScaledCaptureFollowsPreviewSizeAndKeepsColoursAndOrientation()
    {
        WpfTestHost.Run(() =>
        {
            var region = new Rect(0, 0, 400, 300);
            var source = new SyntheticSourceWindow(region);
            try
            {
                source.ShowAndWaitUntilOnScreen();
                var target = new Size(200, 200);
                using var session = new DisplayCaptureSession(region, targetPixelSize: () => target);
                Exception? failure = null;
                session.Failed += error => failure = error;
                session.Start();

                AssertScaledFrame(session, () => failure, 200, 150, "scaled-200");
                target = new Size(120, 120);
                AssertScaledFrame(session, () => failure, 120, 90, "scaled-120");

                // No preview size yet (before layout): skip frames, keep the last one, no failure.
                target = Size.Empty;
                var skipped = 0;
                void CountSkipped() => skipped++;
                session.FrameReady += CountSkipped;
                WpfTestHost.PumpFor(TimeSpan.FromMilliseconds(400));
                session.FrameReady -= CountSkipped;
                Assert.Null(failure);
                Assert.Equal(0, skipped);
                var kept = Assert.IsType<WriteableBitmap>(session.Image);
                Assert.Equal((120, 90), (kept.PixelWidth, kept.PixelHeight));

                // Larger than the source: capture at source size, never upscale.
                target = new Size(1000, 1000);
                AssertScaledFrame(session, () => failure, 400, 300, "unscaled");
            }
            finally
            {
                source.Close();
            }
        });
    }

    [Fact]
    public void ScaledCaptureKeepsSampledColoursIntact()
    {
        WpfTestHost.Run(() =>
        {
            var region = new Rect(0, 0, 200, 100);
            var source = StripeWindow(region);
            source.Show();
            WpfTestHost.PumpFor(TimeSpan.FromMilliseconds(500));
            try
            {
                using var session = new DisplayCaptureSession(region, targetPixelSize: () => new Size(100, 50));
                Exception? failure = null;
                session.Failed += error => failure = error;
                session.Start();
                AssertFrameSize(session, () => failure, 100, 50);
                var rendered = WpfTestHost.RenderOverBlack(session.Image!, 100, 50);
                WpfTestHost.SaveEvidence("211-stripes-100x50.png", rendered, 100, 50);
                // One-pixel red and blue columns at 2:1. Sampling or averaging keeps red, blue
                // or purple; ANDing pixels (GDI's default mode) gives black, ORing gives magenta.
                for (var x = 10; x < 90; x += 10)
                {
                    var (r, g, b, _) = WpfTestHost.PixelAt(rendered, 100, x, 25);
                    Assert.InRange(g, 0, 10);
                    Assert.InRange(r + b, 200, 310);
                }
            }
            finally
            {
                source.Close();
            }
        });
    }

    /// <summary>A topmost window of one-pixel red and blue columns at <paramref name="bounds"/> (physical pixels).</summary>
    private static Window StripeWindow(Rect bounds)
    {
        var image = new System.Windows.Controls.Image { Stretch = Stretch.None, SnapsToDevicePixels = true };
        RenderOptions.SetBitmapScalingMode(image, BitmapScalingMode.NearestNeighbor);
        var window = new Window
        {
            WindowStyle = WindowStyle.None,
            ResizeMode = ResizeMode.NoResize,
            ShowInTaskbar = false,
            Topmost = true,
            ShowActivated = false,
            UseLayoutRounding = true,
            Background = Brushes.Black,
            Content = image,
        };
        window.SourceInitialized += (_, _) =>
        {
            var fromDevice = PresentationSource.FromVisual(window)!.CompositionTarget!.TransformFromDevice;
            var origin = fromDevice.Transform(bounds.TopLeft);
            var size = fromDevice.Transform(new Vector(bounds.Width, bounds.Height));
            window.Left = origin.X;
            window.Top = origin.Y;
            window.Width = size.X;
            window.Height = size.Y;
            // A bitmap at the monitor's DPI draws one bitmap pixel per screen pixel.
            var dpi = 96 / fromDevice.M11;
            var width = (int)bounds.Width;
            var height = (int)bounds.Height;
            var pixels = new byte[width * height * 4];
            for (var y = 0; y < height; y++)
            {
                for (var x = 0; x < width; x++)
                {
                    var offset = (y * width + x) * 4;
                    // Bgr32: B, G, R, unused.
                    pixels[offset] = (byte)(x % 2 == 0 ? 0 : 255);
                    pixels[offset + 2] = (byte)(x % 2 == 0 ? 255 : 0);
                }
            }
            image.Source = BitmapSource.Create(width, height, dpi, dpi, PixelFormats.Bgr32, null, pixels, width * 4);
        };
        return window;
    }

    // Retrying failed frames (#211) can go wrong by: a brief failure (a display mode change)
    // stopping the preview for good; a persistent failure being retried forever without ever
    // reaching Failed; and a FrameReady handler's exception being treated as a capture
    // failure and retried, or leaving the session claiming to be live while frozen.
    [Fact]
    public void BriefCaptureFailuresAreRetriedAndPersistentOnesReported()
    {
        // Failures are logged; keep them out of the developer's real log.
        var realDataDirectory = DashboardSettings.DataDirectory;
        var testDataDirectory = Path.Combine(Path.GetTempPath(), "ClassroomWidgetsTests", Guid.NewGuid().ToString("N"));
        DashboardSettings.UseDataDirectory(testDataDirectory);
        try
        {
            WpfTestHost.Run(RetryScenarios);
        }
        finally
        {
            DashboardSettings.UseDataDirectory(realDataDirectory);
            if (Directory.Exists(testDataDirectory)) Directory.Delete(testDataDirectory, recursive: true);
        }
    }

    private static void RetryScenarios()
    {
        {
            var region = new Rect(0, 0, 400, 300);
            // Two failures, a good frame, then two more: a good frame resets the count.
            var throwsLeft = 2;
            using (var brief = new DisplayCaptureSession(region, targetPixelSize: () =>
                   {
                       if (throwsLeft > 0)
                       {
                           throwsLeft--;
                           throw new InvalidOperationException("simulated mode change");
                       }
                       return new Size(200, 150);
                   }))
            {
                Exception? failure = null;
                var frames = 0;
                brief.Failed += error => failure = error;
                brief.FrameReady += () => frames++;
                brief.Start();
                WpfTestHost.PumpUntil(() => frames >= 1 || failure is not null, Timeout, "a frame after two failed ones");
                throwsLeft = 2;
                var before = frames;
                WpfTestHost.PumpUntil(() => frames > before || failure is not null, Timeout, "a frame after two more failed ones");
                Assert.Null(failure);
                Assert.Equal(0, throwsLeft);
            }

            var attempts = 0;
            using (var broken = new DisplayCaptureSession(region, targetPixelSize: () =>
                   {
                       attempts++;
                       throw new InvalidOperationException("simulated persistent failure");
                   }))
            {
                var failures = new List<Exception>();
                var frames = 0;
                broken.Failed += failures.Add;
                broken.FrameReady += () => frames++;
                broken.Start();
                WpfTestHost.PumpUntil(() => failures.Count > 0, Timeout, "Failed after repeated failures");
                WpfTestHost.PumpFor(TimeSpan.FromMilliseconds(400));
                Assert.Single(failures);
                Assert.Equal("simulated persistent failure", failures[0].Message);
                Assert.Equal(3, attempts);
                Assert.Equal(0, frames);
            }

            using (var session = new DisplayCaptureSession(region, targetPixelSize: () => new Size(200, 150)))
            {
                var failures = new List<Exception>();
                var calls = 0;
                session.Failed += failures.Add;
                session.FrameReady += () =>
                {
                    calls++;
                    throw new InvalidOperationException("handler bug");
                };
                session.Start();
                WpfTestHost.PumpFor(TimeSpan.FromMilliseconds(400));
                Assert.Equal(1, calls);
                Assert.Single(failures);
                Assert.Equal("handler bug", failures[0].Message);
            }
        }
    }

    [Fact]
    public void CaptureReleasesGdiObjectsAcrossResizesAndDispose()
    {
        WpfTestHost.Run(() =>
        {
            var region = new Rect(0, 0, 400, 300);
            Size[] sizes = { new(200, 150), new(120, 90), new(180, 135) };
            void RunSession()
            {
                var target = sizes[0];
                using var session = new DisplayCaptureSession(region, targetPixelSize: () => target);
                Exception? failure = null;
                session.Failed += error => failure = error;
                session.Start();
                foreach (var size in sizes)
                {
                    target = size;
                    AssertFrameSize(session, () => failure, (int)size.Width, (int)size.Height);
                }
            }

            RunSession();
            var baseline = GdiObjects();
            for (var cycle = 0; cycle < 5; cycle++) RunSession();
            var after = GdiObjects();
            WpfTestHost.SaveEvidenceText("211-gdi-objects.txt", $"baseline={baseline} after5sessions={after} (3 sizes each){Environment.NewLine}");
            // Leaking the DC and bitmap per session or per resize would add 10 to 30 objects.
            Assert.InRange(after, 0, baseline + 4);
        });
    }

    private static void AssertFrameSize(DisplayCaptureSession session, Func<Exception?> failure, int width, int height)
    {
        WpfTestHost.PumpUntil(
            () => failure() is not null || session.Image is WriteableBitmap { PixelWidth: var w, PixelHeight: var h } && w == width && h == height,
            Timeout, $"a {width}x{height} frame");
        Assert.Null(failure());
        // Let one more frame land at this size so the pixels are not from the resize frame only.
        var frames = 0;
        void Count() => frames++;
        session.FrameReady += Count;
        WpfTestHost.PumpUntil(() => frames >= 1 || failure() is not null, Timeout, "a second frame");
        session.FrameReady -= Count;
        Assert.Null(failure());
        var image = Assert.IsType<WriteableBitmap>(session.Image);
        Assert.Equal((width, height), (image.PixelWidth, image.PixelHeight));
    }

    private static void AssertScaledFrame(DisplayCaptureSession session, Func<Exception?> failure, int width, int height, string name)
    {
        AssertFrameSize(session, failure, width, height);
        var rendered = WpfTestHost.RenderOverBlack(session.Image!, width, height);
        WpfTestHost.SaveEvidence($"211-{name}-{width}x{height}.png", rendered, width, height);
        AssertColour(SyntheticSourceWindow.TopLeft, WpfTestHost.PixelAt(rendered, width, width / 4, height / 4));
        AssertColour(SyntheticSourceWindow.TopRight, WpfTestHost.PixelAt(rendered, width, width * 3 / 4, height / 4));
        AssertColour(SyntheticSourceWindow.BottomLeft, WpfTestHost.PixelAt(rendered, width, width / 4, height * 3 / 4));
        AssertColour(SyntheticSourceWindow.BottomRight, WpfTestHost.PixelAt(rendered, width, width * 3 / 4, height * 3 / 4));
    }

    private static int GdiObjects()
    {
        // Let WPF finish releasing anything it holds before counting.
        WpfTestHost.DoEvents();
        GC.Collect();
        GC.WaitForPendingFinalizers();
        using var process = System.Diagnostics.Process.GetCurrentProcess();
        return (int)GetGuiResources(process.Handle, 0);
    }

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern uint GetGuiResources(IntPtr process, uint flags);

    private static void AssertColour(Color expected, (byte R, byte G, byte B, byte A) actual)
    {
        Assert.Equal(255, actual.A);
        Assert.InRange(actual.R, Math.Max(0, expected.R - 3), Math.Min(255, expected.R + 3));
        Assert.InRange(actual.G, Math.Max(0, expected.G - 3), Math.Min(255, expected.G + 3));
        Assert.InRange(actual.B, Math.Max(0, expected.B - 3), Math.Min(255, expected.B + 3));
    }
}
