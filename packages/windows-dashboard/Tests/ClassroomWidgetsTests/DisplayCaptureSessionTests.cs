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
    // capturing a full-size frame, or failing, while the preview has no size yet; and leaking the reused memory DC, bitmap or pixel buffer on resize or dispose.
    [Fact]
    public void ScaledCaptureFollowsPreviewSizeAndKeepsColoursAndOrientation()
    {
        WpfTestHost.Run(() =>
        {
            var region = new Rect(0, 0, 400, 300);
            var source = new SyntheticSourceWindow(region);
            source.Show();
            WpfTestHost.PumpFor(TimeSpan.FromMilliseconds(500));
            try
            {
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
            for (var cycle = 0; cycle < 15; cycle++) RunSession();
            var after = GdiObjects();
            WpfTestHost.SaveEvidenceText("211-gdi-objects.txt", $"baseline={baseline} after15sessions={after} (3 sizes each){Environment.NewLine}");
            // Leaking the DC and DIB per session or per resize would add 30 to 90 objects.
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
