using System.IO;
using System.Windows;
using System.Windows.Threading;

namespace ClassroomWidgets;

public partial class SettingsWindow : Window
{
    private readonly DashboardSettings _settings;
    private readonly DispatcherTimer _opacityCommit;
    private bool _loading = true;

    public SettingsWindow(DashboardSettings settings)
    {
        _settings = settings;
        InitializeComponent();

        _opacityCommit = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(250) };
        _opacityCommit.Tick += (_, _) =>
        {
            _opacityCommit.Stop();
            _settings.NotifyChanged();
        };

        AlwaysOnTopCheck.IsChecked = _settings.AlwaysOnTop;
        LaunchAtLoginCheck.IsChecked = DashboardSettings.LaunchAtLoginEnabled;
        OpacitySlider.Value = Math.Clamp(_settings.BackgroundOpacity, OpacitySlider.Minimum, OpacitySlider.Maximum);
        UpdateOpacityLabel();
        VersionLabel.Text = $"Classroom Widgets for Windows v{App.AppVersion}";
        _loading = false;
    }

    private void AlwaysOnTopCheck_Changed(object sender, RoutedEventArgs args)
    {
        if (_loading) return;
        _settings.AlwaysOnTop = AlwaysOnTopCheck.IsChecked == true;
        _settings.NotifyChanged();
    }

    private void LaunchAtLoginCheck_Changed(object sender, RoutedEventArgs args)
    {
        if (_loading) return;
        try
        {
            DashboardSettings.LaunchAtLoginEnabled = LaunchAtLoginCheck.IsChecked == true;
        }
        catch (Exception error) when (error is System.Security.SecurityException or UnauthorizedAccessException or IOException)
        {
            DashboardLog.Warn($"Unable to update launch at login: {error.Message}");
            _loading = true;
            LaunchAtLoginCheck.IsChecked = DashboardSettings.LaunchAtLoginEnabled;
            _loading = false;
        }
    }

    private void OpacitySlider_ValueChanged(object sender, RoutedPropertyChangedEventArgs<double> args)
    {
        if (_loading) return;
        _settings.BackgroundOpacity = Math.Round(args.NewValue, 2);
        UpdateOpacityLabel();
        _opacityCommit.Stop();
        _opacityCommit.Start();
    }

    private void ResetPositionsButton_Click(object sender, RoutedEventArgs args)
    {
        _settings.PanelFrames.Clear();
        _settings.NotifyChanged();
    }

    private void UpdateOpacityLabel()
    {
        OpacityLabel.Text = $"{Math.Round(OpacitySlider.Value * 100)}%";
    }
}
