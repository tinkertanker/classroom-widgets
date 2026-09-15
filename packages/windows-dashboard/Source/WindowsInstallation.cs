using System.IO;
using System.Runtime.Versioning;
using System.Security;
using Microsoft.Win32;

namespace ClassroomWidgets;

internal static class WindowsInstallation
{
    private const string UninstallKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\{7C1E2B54-3F0A-4D3B-9C7E-5B2A8E1F6D43}_is1";

    [SupportedOSPlatform("windows")]
    public static bool IsInstallerManaged(string appDirectory)
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(UninstallKeyPath, writable: false);
            return MatchesInstallLocation(appDirectory, key?.GetValue("InstallLocation") as string);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or SecurityException)
        {
            DashboardLog.Warn($"Unable to inspect Windows installation: {error.Message}");
            return false;
        }
    }

    internal static bool MatchesInstallLocation(string appDirectory, string? installLocation)
    {
        if (string.IsNullOrWhiteSpace(installLocation)) return false;
        var appPath = Path.GetFullPath(appDirectory).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var installedPath = Path.GetFullPath(Environment.ExpandEnvironmentVariables(installLocation)).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        return appPath.Equals(installedPath, StringComparison.OrdinalIgnoreCase);
    }
}
