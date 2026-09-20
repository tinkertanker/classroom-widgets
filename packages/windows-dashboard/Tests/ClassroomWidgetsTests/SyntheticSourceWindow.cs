using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace ClassroomWidgetsTests;

/// <summary>
/// Borderless, topmost window filled with four asymmetric solid colours, used as
/// non-sensitive desktop content for real GDI capture tests.
/// </summary>
internal sealed class SyntheticSourceWindow : Window
{
    public static readonly Color TopLeft = Color.FromRgb(200, 30, 60);
    public static readonly Color TopRight = Color.FromRgb(40, 190, 70);
    public static readonly Color BottomLeft = Color.FromRgb(50, 80, 220);
    public static readonly Color BottomRight = Color.FromRgb(230, 200, 20);

    public SyntheticSourceWindow(Rect bounds)
    {
        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.NoResize;
        AllowsTransparency = false;
        ShowInTaskbar = false;
        Topmost = true;
        ShowActivated = false;
        Left = bounds.Left;
        Top = bounds.Top;
        Width = bounds.Width;
        Height = bounds.Height;
        var grid = new Grid();
        grid.RowDefinitions.Add(new RowDefinition());
        grid.RowDefinitions.Add(new RowDefinition());
        grid.ColumnDefinitions.Add(new ColumnDefinition());
        grid.ColumnDefinitions.Add(new ColumnDefinition());
        grid.Children.Add(Cell(TopLeft, 0, 0));
        grid.Children.Add(Cell(TopRight, 0, 1));
        grid.Children.Add(Cell(BottomLeft, 1, 0));
        grid.Children.Add(Cell(BottomRight, 1, 1));
        Content = grid;
    }

    private static Border Cell(Color color, int row, int column)
    {
        var cell = new Border { Background = new SolidColorBrush(color) };
        Grid.SetRow(cell, row);
        Grid.SetColumn(cell, column);
        return cell;
    }
}
