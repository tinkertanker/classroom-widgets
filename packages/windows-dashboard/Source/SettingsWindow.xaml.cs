using System.IO;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;

namespace ClassroomWidgets;

public partial class SettingsWindow : Window
{
    private readonly DashboardSettings _settings;
    private readonly WidgetHostController _host;
    private readonly WidgetShortcutManager _shortcuts;
    private readonly DispatcherTimer _opacityCommit;
    private readonly Dictionary<int, (TextBox Capture, TextBlock Status)> _shortcutControls = new();
    private bool _loading = true;

    public SettingsWindow(DashboardSettings settings, WidgetHostController host, WidgetShortcutManager shortcuts)
    {
        _settings = settings;
        _host = host;
        _shortcuts = shortcuts;
        InitializeComponent();
        Height = Math.Min(Height, SystemParameters.WorkArea.Height - 40);

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
        BuildShortcutRows();
        _host.WidgetOptionsChanged += OnWidgetOptionsChanged;
        _shortcuts.StatusChanged += OnShortcutStatusChanged;
        Closed += (_, _) =>
        {
            _host.WidgetOptionsChanged -= OnWidgetOptionsChanged;
            _shortcuts.StatusChanged -= OnShortcutStatusChanged;
            _shortcuts.Resume();
        };
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

    private void OnWidgetOptionsChanged()
    {
        if (!Dispatcher.CheckAccess()) { Dispatcher.Invoke(BuildShortcutRows); return; }
        BuildShortcutRows();
    }

    private void OnShortcutStatusChanged()
    {
        if (!Dispatcher.CheckAccess()) { Dispatcher.Invoke(UpdateShortcutStatuses); return; }
        UpdateShortcutStatuses();
    }

    private void BuildShortcutRows()
    {
        ShortcutRows.Children.Clear();
        _shortcutControls.Clear();
        ShortcutLoadingLabel.Visibility = _host.WidgetOptions.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
        foreach (var option in _host.WidgetOptions)
        {
            var row = new Grid { Margin = new Thickness(0, 0, 0, 12) };
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(150) });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            var title = new TextBlock { Text = option.Title, VerticalAlignment = VerticalAlignment.Center, TextTrimming = TextTrimming.CharacterEllipsis, Margin = new Thickness(0, 0, 10, 0) };
            var capture = new TextBox
            {
                Text = _settings.WidgetShortcuts.GetValueOrDefault(option.WidgetType) ?? "",
                IsReadOnly = true,
                Padding = new Thickness(7, 5, 7, 5),
                VerticalContentAlignment = VerticalAlignment.Center,
                Margin = new Thickness(0, 0, 6, 0)
            };
            AutomationProperties.SetName(capture, $"Launch shortcut for {option.Title}");
            capture.GotKeyboardFocus += (_, _) =>
            {
                _shortcuts.Suspend();
                capture.Text = "Press shortcut…";
                capture.SelectAll();
            };
            capture.LostKeyboardFocus += (_, _) =>
            {
                capture.Text = _settings.WidgetShortcuts.GetValueOrDefault(option.WidgetType) ?? "";
                _shortcuts.Resume();
            };
            capture.PreviewKeyDown += (_, args) => CaptureShortcut(option.WidgetType, capture, args);

            var clear = new Button { Content = "Clear", Padding = new Thickness(8, 4, 8, 4), Margin = new Thickness(0, 0, 6, 0) };
            AutomationProperties.SetName(clear, $"Clear shortcut for {option.Title}");
            clear.Click += (_, _) => SetShortcut(option.WidgetType, null);
            var reset = new Button { Content = "Reset", Padding = new Thickness(8, 4, 8, 4), IsEnabled = _settings.WidgetShortcutDefaults.ContainsKey(option.WidgetType) };
            AutomationProperties.SetName(reset, $"Reset shortcut for {option.Title}");
            reset.Click += (_, _) => SetShortcut(option.WidgetType, _settings.WidgetShortcutDefaults.GetValueOrDefault(option.WidgetType));

            Grid.SetColumn(title, 0); Grid.SetColumn(capture, 1); Grid.SetColumn(clear, 2); Grid.SetColumn(reset, 3);
            row.Children.Add(title); row.Children.Add(capture); row.Children.Add(clear); row.Children.Add(reset);
            var status = new TextBlock { FontSize = 11, Margin = new Thickness(160, 3, 0, 0) };
            Grid.SetColumn(status, 0); Grid.SetColumnSpan(status, 4); Grid.SetRow(status, 1);
            row.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            row.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            row.Children.Add(status);
            ShortcutRows.Children.Add(row);
            _shortcutControls[option.WidgetType] = (capture, status);
        }
        UpdateShortcutStatuses();
    }

    private void CaptureShortcut(int widgetType, TextBox capture, KeyEventArgs args)
    {
        var key = args.Key == Key.System ? args.SystemKey : args.Key;
        var modifiers = Keyboard.Modifiers;
        if (key == Key.Tab && (modifiers & ~ModifierKeys.Shift) == ModifierKeys.None) return;
        if (key == Key.F4 && modifiers == ModifierKeys.Alt) return;
        args.Handled = true;
        if (key == Key.Escape && modifiers == ModifierKeys.None)
        {
            capture.MoveFocus(new TraversalRequest(FocusNavigationDirection.Next));
            return;
        }
        if (!WidgetShortcutGesture.TryFromKey(key, modifiers, out var gesture)) return;
        if (_shortcuts.IsDuplicate(widgetType, gesture.Display))
        {
            var status = _shortcutControls[widgetType].Status;
            status.Text = "Conflict — already assigned to another widget";
            status.Foreground = Brushes.Firebrick;
            return;
        }
        SetShortcut(widgetType, gesture.Display);
        capture.MoveFocus(new TraversalRequest(FocusNavigationDirection.Next));
    }

    private void SetShortcut(int widgetType, string? shortcut)
    {
        if (shortcut is not null && _shortcuts.IsDuplicate(widgetType, shortcut))
        {
            var status = _shortcutControls[widgetType].Status;
            status.Text = "Conflict — already assigned to another widget";
            status.Foreground = Brushes.Firebrick;
            return;
        }
        _settings.WidgetShortcuts[widgetType] = shortcut;
        _settings.NotifyChanged();
        if (_shortcutControls.TryGetValue(widgetType, out var controls)) controls.Capture.Text = shortcut ?? "";
        UpdateShortcutStatuses();
    }

    private void UpdateShortcutStatuses()
    {
        foreach (var (widgetType, controls) in _shortcutControls)
        {
            var registration = _shortcuts.StatusFor(widgetType);
            controls.Status.Text = registration.Status switch
            {
                WidgetShortcutStatus.Active => "Active",
                WidgetShortcutStatus.Conflict => "Conflict — Windows could not register this shortcut",
                _ => "Inactive"
            };
            controls.Status.Foreground = registration.Status == WidgetShortcutStatus.Conflict ? Brushes.Firebrick : Brushes.DimGray;
            controls.Status.ToolTip = registration.Detail;
            AutomationProperties.SetName(controls.Status, $"Shortcut status: {controls.Status.Text}");
        }
    }
}
