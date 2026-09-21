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
    private readonly Dictionary<(int WidgetType, WidgetShortcutAction Action), (TextBox Capture, TextBlock Status)> _shortcutControls = new();
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
        SelectProvider(DashboardShortenerSettings.NormalizeProvider(_settings.LinkShortenerProvider));
        UpdateShortioFields();
        ApiKeyBox.Password = _settings.LinkShortenerPublicApiKey;
        DomainBox.Text = _settings.LinkShortenerDomain;
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

    private void ProviderCombo_SelectionChanged(object sender, SelectionChangedEventArgs args)
    {
        if (_loading) return;
        if (ProviderCombo.SelectedItem is not ComboBoxItem { Tag: string provider }) return;
        _settings.LinkShortenerProvider = provider;
        UpdateShortioFields();
        _settings.NotifyChanged();
    }

    private void ApiKeyBox_PasswordChanged(object sender, RoutedEventArgs args)
    {
        if (_loading) return;
        _settings.LinkShortenerPublicApiKey = ApiKeyBox.Password;
        _settings.NotifyChanged();
    }

    private void DomainBox_TextChanged(object sender, TextChangedEventArgs args)
    {
        if (_loading) return;
        _settings.LinkShortenerDomain = DomainBox.Text;
        _settings.NotifyChanged();
    }

    private void SelectProvider(string provider)
    {
        foreach (ComboBoxItem item in ProviderCombo.Items)
        {
            if (item.Tag is string tag && tag == provider)
            {
                ProviderCombo.SelectedItem = item;
                return;
            }
        }
    }

    // Short.io is the only provider that needs a key or a branded domain.
    private void UpdateShortioFields()
        => ShortioFields.Visibility = SelectedProvider == DashboardShortenerSettings.ShortioProvider
            ? Visibility.Visible
            : Visibility.Collapsed;

    private string? SelectedProvider => (ProviderCombo.SelectedItem as ComboBoxItem)?.Tag as string;

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
        var header = new Grid { Margin = new Thickness(0, 0, 0, 6) };
        header.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(130) });
        header.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        header.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        header.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        var widgetHeader = new TextBlock { Text = "Widget", Foreground = Brushes.DimGray, FontWeight = FontWeights.SemiBold };
        var showHeader = new TextBlock { Text = "Show", Foreground = Brushes.DimGray, FontWeight = FontWeights.SemiBold };
        var dismissHeader = new TextBlock { Text = "Dismiss", Foreground = Brushes.DimGray, FontWeight = FontWeights.SemiBold };
        Grid.SetColumn(widgetHeader, 0);
        Grid.SetColumn(showHeader, 1);
        Grid.SetColumn(dismissHeader, 2);
        header.Children.Add(widgetHeader);
        header.Children.Add(showHeader);
        header.Children.Add(dismissHeader);
        ShortcutRows.Children.Add(header);
        var options = new[] { new CompactWidgetOption(DisplayShortcutLogic.WidgetType, "Display") }.Concat(_host.WidgetOptions);
        foreach (var option in options)
        {
            var row = new Grid { Margin = new Thickness(0, 0, 0, 12) };
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(130) });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            var title = new TextBlock { Text = option.Title, VerticalAlignment = VerticalAlignment.Center, TextTrimming = TextTrimming.CharacterEllipsis, Margin = new Thickness(0, 0, 10, 0) };
            var show = CreateShortcutField(option, WidgetShortcutAction.Show);
            var dismiss = CreateShortcutField(option, WidgetShortcutAction.Dismiss);
            var reset = new Button { Content = "Reset", Padding = new Thickness(8, 4, 8, 4), Margin = new Thickness(6, 0, 0, 0), IsEnabled = option.WidgetType == DisplayShortcutLogic.WidgetType || _settings.WidgetShortcutDefaults.ContainsKey(option.WidgetType) };
            AutomationProperties.SetName(reset, $"Reset shortcuts for {option.Title}");
            reset.Click += (_, _) =>
            {
                var shortcut = option.WidgetType == DisplayShortcutLogic.WidgetType
                    ? DisplayShortcutLogic.DefaultShortcut
                    : _settings.WidgetShortcutDefaults.GetValueOrDefault(option.WidgetType);
                SetShortcut(option.WidgetType, WidgetShortcutAction.Show, shortcut);
                SetShortcut(option.WidgetType, WidgetShortcutAction.Dismiss, shortcut);
            };

            Grid.SetColumn(title, 0); Grid.SetColumn(show, 1); Grid.SetColumn(dismiss, 2); Grid.SetColumn(reset, 3);
            row.Children.Add(title); row.Children.Add(show); row.Children.Add(dismiss); row.Children.Add(reset);
            ShortcutRows.Children.Add(row);
        }
        UpdateShortcutStatuses();
    }

    private FrameworkElement CreateShortcutField(CompactWidgetOption option, WidgetShortcutAction action)
    {
        var panel = new StackPanel { Margin = new Thickness(0, 0, 8, 0) };
        var controls = new Grid();
        controls.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        controls.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        var capture = new TextBox
        {
            Text = GetShortcut(option.WidgetType, action) ?? "",
            IsReadOnly = true,
            Padding = new Thickness(7, 5, 7, 5),
            VerticalContentAlignment = VerticalAlignment.Center
        };
        AutomationProperties.SetName(capture, $"{action} shortcut for {option.Title}");
        capture.GotKeyboardFocus += (_, _) =>
        {
            _shortcuts.Suspend();
            capture.Text = "Press shortcut…";
            capture.SelectAll();
        };
        capture.LostKeyboardFocus += (_, _) =>
        {
            capture.Text = GetShortcut(option.WidgetType, action) ?? "";
            _shortcuts.Resume();
        };
        capture.PreviewKeyDown += (_, args) => CaptureShortcut(option.WidgetType, action, capture, args);
        var clear = new Button { Content = "Clear", Padding = new Thickness(6, 4, 6, 4), Margin = new Thickness(4, 0, 0, 0) };
        AutomationProperties.SetName(clear, $"Clear {action.ToString().ToLowerInvariant()} shortcut for {option.Title}");
        clear.Click += (_, _) => SetShortcut(option.WidgetType, action, null);
        Grid.SetColumn(clear, 1);
        controls.Children.Add(capture);
        controls.Children.Add(clear);
        var status = new TextBlock { FontSize = 11, Margin = new Thickness(0, 3, 0, 0) };
        panel.Children.Add(controls);
        panel.Children.Add(status);
        _shortcutControls[(option.WidgetType, action)] = (capture, status);
        return panel;
    }

    private void CaptureShortcut(int widgetType, WidgetShortcutAction action, TextBox capture, KeyEventArgs args)
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
            var status = _shortcutControls[(widgetType, action)].Status;
            status.Text = "Conflict — already assigned to another widget";
            status.Foreground = Brushes.Firebrick;
            return;
        }
        SetShortcut(widgetType, action, gesture.Display);
        capture.MoveFocus(new TraversalRequest(FocusNavigationDirection.Next));
    }

    private string? GetShortcut(int widgetType, WidgetShortcutAction action)
    {
        if (widgetType == DisplayShortcutLogic.WidgetType)
            return action == WidgetShortcutAction.Show ? _settings.DisplayPreviewShortcut : _settings.DisplayPreviewDismissShortcut;
        var bindings = action == WidgetShortcutAction.Show ? _settings.WidgetShortcuts : _settings.WidgetDismissShortcuts;
        return bindings.GetValueOrDefault(widgetType);
    }

    private void SetShortcut(int widgetType, WidgetShortcutAction action, string? shortcut)
    {
        if (shortcut is not null && _shortcuts.IsDuplicate(widgetType, shortcut))
        {
            var status = _shortcutControls[(widgetType, action)].Status;
            status.Text = "Conflict — already assigned to another widget";
            status.Foreground = Brushes.Firebrick;
            return;
        }
        if (widgetType == DisplayShortcutLogic.WidgetType)
        {
            if (action == WidgetShortcutAction.Show) _settings.DisplayPreviewShortcut = shortcut;
            else _settings.DisplayPreviewDismissShortcut = shortcut;
        }
        else
        {
            var bindings = action == WidgetShortcutAction.Show ? _settings.WidgetShortcuts : _settings.WidgetDismissShortcuts;
            bindings[widgetType] = shortcut;
        }
        _settings.NotifyChanged();
        if (_shortcutControls.TryGetValue((widgetType, action), out var controls)) controls.Capture.Text = shortcut ?? "";
        UpdateShortcutStatuses();
    }

    private void UpdateShortcutStatuses()
    {
        foreach (var (key, controls) in _shortcutControls)
        {
            var registration = _shortcuts.StatusFor(key.WidgetType, key.Action);
            controls.Status.Text = registration.Status switch
            {
                WidgetShortcutStatus.Active => registration.Detail is null ? "Active" : $"Active — {registration.Detail}",
                WidgetShortcutStatus.Conflict => "Conflict — Windows could not register this shortcut",
                _ => "Inactive"
            };
            controls.Status.Foreground = registration.Status == WidgetShortcutStatus.Conflict ? Brushes.Firebrick : Brushes.DimGray;
            controls.Status.ToolTip = registration.Detail;
            AutomationProperties.SetName(controls.Status, $"Shortcut status: {controls.Status.Text}");
        }
    }
}
