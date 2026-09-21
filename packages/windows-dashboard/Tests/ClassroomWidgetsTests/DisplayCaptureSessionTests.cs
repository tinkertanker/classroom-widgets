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
            source.Show();
            WpfTestHost.PumpFor(TimeSpan.FromMilliseconds(500));
            try
            {
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

    private static void AssertColour(Color expected, (byte R, byte G, byte B, byte A) actual)
    {
        Assert.Equal(255, actual.A);
        Assert.InRange(actual.R, Math.Max(0, expected.R - 3), Math.Min(255, expected.R + 3));
        Assert.InRange(actual.G, Math.Max(0, expected.G - 3), Math.Min(255, expected.G + 3));
        Assert.InRange(actual.B, Math.Max(0, expected.B - 3), Math.Min(255, expected.B + 3));
    }
}
