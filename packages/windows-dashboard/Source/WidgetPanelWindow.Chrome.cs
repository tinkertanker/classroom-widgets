using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media.Animation;

namespace ClassroomWidgets;

/// <summary>The chrome strip: hover reveal, its buttons and menus.</summary>
public partial class WidgetPanelWindow
{
    private void UpdateChromeForPointer()
    {
        if (!IsVisible) return;
        var inside = false;
        if (NativeMethods.GetCursorPos(out var point))
        {
            var source = PresentationSource.FromVisual(this);
            if (source?.CompositionTarget is { } target)
            {
                var dip = target.TransformFromDevice.Transform(new Point(point.X, point.Y));
                inside = CurrentFrame.Contains(dip);
            }
        }
        if (inside || AddMenu.IsOpen || ArrangeMenu.IsOpen || VolumeMenu.IsOpen)
        {
            _pointerLeftAt = DateTime.MinValue;
            SetChromeVisible(true);
            return;
        }
        if (_pointerLeftAt == DateTime.MinValue) _pointerLeftAt = DateTime.UtcNow;
        if (_chromeVisible && DateTime.UtcNow - _pointerLeftAt > TimeSpan.FromMilliseconds(1200)) SetChromeVisible(false);
    }

    private void SetChromeVisible(bool visible)
    {
        if (_chromeVisible == visible) return;
        _chromeVisible = visible;
        ChromeBar.BeginAnimation(OpacityProperty, new DoubleAnimation(visible ? 1 : 0, TimeSpan.FromMilliseconds(160)));
        ApplyWebPresentation();
    }

    private void ChromeBar_MouseLeftButtonDown(object sender, MouseButtonEventArgs args)
    {
        if (args.ButtonState != MouseButtonState.Pressed) return;
        Activate();
        DragMove();
    }

    private void CloseButton_Click(object sender, RoutedEventArgs args)
    {
        HidePanel();
        RemovalRequested?.Invoke(WidgetId);
    }

    private void AddButton_Click(object sender, RoutedEventArgs args) => OpenMenu(AddButton, AddMenu);

    private void ArrangeButton_Click(object sender, RoutedEventArgs args) => OpenMenu(ArrangeButton, ArrangeMenu);

    private void ArrangeMenu_Opened(object sender, RoutedEventArgs args)
    {
        ArrangeMenu.Items.Clear();
        if (HasMultipleVisiblePanels())
        {
            foreach (var (label, layout) in new[]
            {
                ("Free placement", WidgetPanelLayout.Freeform),
                ("Arrange in a row", WidgetPanelLayout.Row),
                ("Arrange in a column", WidgetPanelLayout.Column)
            })
            {
                var item = new MenuItem { Header = label, Tag = layout.ToString() };
                item.Click += ArrangeMenuItem_Click;
                ArrangeMenu.Items.Add(item);
            }
        }
        AddSnapItems();
    }

    private void VolumeButton_Click(object sender, RoutedEventArgs args) => OpenMenu(VolumeButton, VolumeMenu);

    private void VolumeMenu_Opened(object sender, RoutedEventArgs args)
    {
        PopulateVolumeMenu();
    }

    private void PopulateVolumeMenu()
    {
        VolumeMenu.Items.Clear();
        foreach (var (label, volume) in DashboardAudioSettings.Presets)
        {
            var item = new MenuItem
            {
                Header = label,
                IsCheckable = true,
                IsChecked = _settings.OutputVolume == volume,
                Tag = volume
            };
            item.Click += OutputVolumeMenuItem_Click;
            VolumeMenu.Items.Add(item);
        }
    }

    private void OutputVolumeMenuItem_Click(object sender, RoutedEventArgs args)
    {
        if (sender is not MenuItem { Tag: double volume }) return;
        _settings.OutputVolume = volume;
        _settings.NotifyChanged();
    }

    private void UpdateVolumeButton()
    {
        VolumeButton.Content = _settings.OutputVolume == 0 ? "\uE74F" : "\uE767";
        var label = $"Output volume: {DashboardAudioSettings.Label(_settings.OutputVolume)}";
        VolumeButton.ToolTip = label;
        System.Windows.Automation.AutomationProperties.SetName(VolumeButton, label);
    }

    /// <summary>Position presets for this widget alone, below the layouts that move every widget.</summary>
    private void AddSnapItems()
    {
        if (ArrangeMenu.Items.Count > 0) ArrangeMenu.Items.Add(new Separator());
        ArrangeMenu.Items.Add(new MenuItem { Header = "Move this widget", IsEnabled = false });
        for (var index = 0; index < WindowSnapGeometry.Groups.Length; index++)
        {
            if (index > 0) ArrangeMenu.Items.Add(new Separator());
            foreach (var preset in WindowSnapGeometry.Groups[index])
            {
                var item = new MenuItem { Header = WindowSnapGeometry.Title(preset) };
                item.Click += (_, _) => SnapRequested?.Invoke(preset);
                ArrangeMenu.Items.Add(item);
            }
        }
    }

    private void ArrangeMenuItem_Click(object sender, RoutedEventArgs args)
    {
        if (sender is MenuItem { Tag: string tag } && Enum.TryParse<WidgetPanelLayout>(tag, out var layout))
        {
            LayoutRequested?.Invoke(layout);
        }
    }

    private static void OpenMenu(Button anchor, ContextMenu menu)
    {
        menu.PlacementTarget = anchor;
        menu.Placement = PlacementMode.Bottom;
        menu.IsOpen = true;
    }
}
