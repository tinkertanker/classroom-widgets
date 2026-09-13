using System.Reflection;
using System.Threading;
using System.Windows;
using System.Windows.Threading;

namespace ClassroomWidgets;

/// <summary>
/// Tray-only application: no main window, a hidden widget host, and visible
/// per-widget panels. A named mutex keeps a second launch from starting.
/// </summary>
public partial class App : Application
{
    private const string MutexName = "Local\\ClassroomWidgets.SingleInstance";

    private Mutex? _instanceMutex;
    private DashboardSettings? _settings;
    private WidgetHostController? _host;
    private TrayController? _tray;
    private bool _terminationPrepared;

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
            Shutdown();
            return;
        }

        DispatcherUnhandledException += OnDispatcherUnhandledException;
        DashboardLog.Info($"Classroom Widgets {AppVersion} starting");

        _settings = DashboardSettings.Load();
        _host = new WidgetHostController(_settings);
        _settings.Changed += () => _host.ApplySettings();
        _host.ApplySettings();

        _tray = new TrayController(_host, _settings);
        // The widget settings gear posts classroomWidgetPanel open-settings;
        // panels route it here so the same Settings window opens as from the tray.
        _host.OpenSettingsRequested += () => _tray.OpenSettings();
        _ = _host.StartAsync();
    }

    /// <summary>
    /// Flushes pending widget writes into the host store, then exits. Called
    /// from the tray menu and from session-end notifications.
    /// </summary>
    public async Task RequestQuitAsync()
    {
        if (IsShuttingDown) return;
        IsShuttingDown = true;
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
        _host?.Coordinator.FlushPersistedFrames();
        _settings?.Save();
        base.OnSessionEnding(args);
    }

    protected override void OnExit(ExitEventArgs args)
    {
        IsShuttingDown = true;
        _tray?.Dispose();
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
