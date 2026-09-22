using System.Reflection;
using System.Threading;
using System.Windows;
using System.Windows.Threading;

namespace ClassroomWidgets;

/// <summary>
/// Desktop application with a launcher window, a hidden widget host, a tray
/// menu, and visible per-widget panels. A named mutex keeps a second launch
/// from starting while a named event routes it to the existing launcher.
/// </summary>
public partial class App : Application
{
    private const string MutexName = "Local\\ClassroomWidgets.SingleInstance";
    private const string ShowLauncherEventName = "Local\\ClassroomWidgets.ShowLauncher";

    private Mutex? _instanceMutex;
    private EventWaitHandle? _showLauncherEvent;
    private RegisteredWaitHandle? _showLauncherRegistration;
    private DashboardSettings? _settings;
    private WidgetHostController? _host;
    private LauncherWindow? _launcher;
    private WidgetShortcutManager? _shortcuts;
    private DisplayPreviewCoordinator? _displayPreview;
    private TrayController? _tray;
    private UpdateController? _updates;
    private bool _terminationPrepared;
    private bool _launcherRequested;

    public static bool IsShuttingDown { get; private set; }

    public static string AppVersion { get; } = Assembly.GetExecutingAssembly()
        .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion.Split('+')[0]
        ?? Assembly.GetExecutingAssembly().GetName().Version?.ToString(3)
        ?? "0.0.0";

    protected override void OnStartup(StartupEventArgs args)
    {
        base.OnStartup(args);

        _instanceMutex = new Mutex(initiallyOwned: true, MutexName, out var createdNew);
        if (!createdNew)
        {
            DashboardLog.Info("Another instance is already running; exiting");
            if (!args.Args.Contains("--background", StringComparer.OrdinalIgnoreCase))
            {
                var signaled = false;
                Exception? signalError = null;
                for (var attempt = 0; attempt < 10 && !signaled; attempt++)
                {
                    try
                    {
                        using var showLauncherEvent = EventWaitHandle.OpenExisting(ShowLauncherEventName);
                        signaled = showLauncherEvent.Set();
                    }
                    catch (WaitHandleCannotBeOpenedException)
                    {
                        if (attempt < 9) Thread.Sleep(50);
                    }
                    catch (Exception error) when (error is UnauthorizedAccessException or System.IO.IOException)
                    {
                        signalError = error;
                        break;
                    }
                }
                if (!signaled)
                {
                    var detail = signalError is null ? "" : $": {signalError.Message}";
                    DashboardLog.Warn($"Running instance is not ready to open the widget launcher{detail}");
                }
            }
            Shutdown();
            return;
        }

        _showLauncherEvent = new EventWaitHandle(false, EventResetMode.AutoReset, ShowLauncherEventName);
        _showLauncherRegistration = ThreadPool.RegisterWaitForSingleObject(
            _showLauncherEvent,
            (_, _) => Dispatcher.BeginInvoke(new Action(RequestOpenLauncher)),
            null,
            Timeout.Infinite,
            executeOnlyOnce: false);
        _launcherRequested = !args.Args.Contains("--background", StringComparer.OrdinalIgnoreCase);

        DispatcherUnhandledException += OnDispatcherUnhandledException;
        DashboardLog.Info($"Classroom Widgets {AppVersion} starting");

        _settings = DashboardSettings.Load();
        _host = new WidgetHostController(_settings);
        _launcher = new LauncherWindow(widgetType =>
        {
            if (_host.WidgetOptions.Any(option => option.WidgetType == widgetType))
            {
                _ = _host.AddWidgetAsync(widgetType);
            }
        }, () => _displayPreview?.Open());
        _host.WidgetOptionsChanged += () =>
        {
            if (_launcherRequested) RequestOpenLauncher();
        };
        _settings.Changed += () => _host.ApplySettings();
        _host.ApplySettings();

        var displayCatalog = new DisplayCatalog();
        _displayPreview = new DisplayPreviewCoordinator(_settings, displayCatalog);
        _shortcuts = new WidgetShortcutManager(_settings, _host, _displayPreview.PerformShortcut);
        _updates = new UpdateController(RequestQuitAsync);
        _tray = new TrayController(_host, _settings, _shortcuts, _updates, RequestOpenLauncher, () => _displayPreview.Open());
        // The widget settings gear posts classroomWidgetPanel open-settings;
        // panels route it here so the same Settings window opens as from the tray.
        _host.OpenSettingsRequested += () => _tray.OpenSettings();
        _host.Coordinator.DisplayPreviewRequested += () => _displayPreview.Open();
        _ = _host.StartAsync();
        _ = CheckForUpdatesAfterDelayAsync();
    }

    private void RequestOpenLauncher()
    {
        if (IsShuttingDown) return;
        if (_host is null || _host.WidgetOptions.Count == 0)
        {
            _launcherRequested = true;
            return;
        }
        _launcherRequested = false;
        _launcher?.Show();
    }

    private async Task CheckForUpdatesAfterDelayAsync()
    {
        await Task.Delay(TimeSpan.FromSeconds(10));
        if (_updates is not null) await _updates.CheckAsync();
    }

    /// <summary>
    /// Flushes pending widget writes into the host store, then exits. Called
    /// from the tray menu and from session-end notifications.
    /// </summary>
    public async Task RequestQuitAsync()
    {
        if (IsShuttingDown) return;
        IsShuttingDown = true;
        _displayPreview?.Shutdown();
        if (_host is not null && !_terminationPrepared)
        {
            _terminationPrepared = await _host.PrepareForTerminationAsync();
            if (!_terminationPrepared) DashboardLog.Warn("Some widget state could not be flushed before quitting");
        }
        _settings?.Save();
        Shutdown();
    }

    protected override void OnSessionEnding(SessionEndingCancelEventArgs args)
    {
        IsShuttingDown = true;
        _displayPreview?.Shutdown();
        _host?.Coordinator.FlushPersistedFrames();
        _settings?.Save();
        base.OnSessionEnding(args);
    }

    protected override void OnExit(ExitEventArgs args)
    {
        IsShuttingDown = true;
        _displayPreview?.Shutdown();
        _tray?.Dispose();
        _shortcuts?.Dispose();
        _showLauncherRegistration?.Unregister(null);
        _showLauncherEvent?.Dispose();
        _instanceMutex?.Dispose();
        DashboardLog.Info("Classroom Widgets exited");
        base.OnExit(args);
    }

    private void OnDispatcherUnhandledException(object sender, DispatcherUnhandledExceptionEventArgs args)
    {
        DashboardLog.Error($"Unhandled exception: {args.Exception}");
        args.Handled = true;
    }
}
