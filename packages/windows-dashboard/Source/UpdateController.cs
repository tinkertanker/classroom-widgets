using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text.Json;
using System.Windows;

namespace ClassroomWidgets;

public sealed class UpdateController
{
    private const string LatestReleaseApi = "https://api.github.com/repos/tinkertanker/classroom-widgets/releases/latest";
    private static readonly HttpClient Client = CreateClient();
    private readonly Func<Task> _quit;
    private bool _checking;

    public UpdateController(Func<Task> quit) => _quit = quit;
    public event Action<string?>? UpdateAvailable;

    public async Task CheckAsync(bool manual = false)
    {
        if (_checking) return;
        _checking = true;
        var installApproved = false;
        var handoffStarted = false;
        string? downloadPath = null;
        try
        {
            using var response = await Client.GetAsync(LatestReleaseApi);
            response.EnsureSuccessStatusCode();
            await using var content = await response.Content.ReadAsStreamAsync();
            var release = await JsonSerializer.DeserializeAsync<GitHubRelease>(content);
            if (release is null || !UpdateVersion.TryParse(release.TagName, out var available))
                throw new InvalidDataException("GitHub returned an invalid release");

            var current = Version.Parse(App.AppVersion);
            if (available <= current)
            {
                UpdateAvailable?.Invoke(null);
                if (manual) MessageBox.Show($"Version {App.AppVersion} is the latest version.", "Classroom Widgets is up to date", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }
            var availableVersion = available.ToString(3);
            var isInstalled = WindowsInstallation.IsInstallerManaged(AppContext.BaseDirectory);
            var expectedName = isInstalled
                ? $"ClassroomWidgets-v{availableVersion}-windows-x64-setup.exe"
                : $"ClassroomWidgets-v{availableVersion}-windows-x64.zip";
            var asset = release.Assets.FirstOrDefault(candidate => candidate.Name == expectedName && HasUsableDigest(candidate.Digest));
            if (asset is null)
            {
                UpdateAvailable?.Invoke(null);
                if (manual) OpenReleasePage(release.HtmlUrl, $"Version {availableVersion} is available, but its Windows installer is not attached yet.");
                return;
            }
            UpdateAvailable?.Invoke(availableVersion);
            if (!manual) return;

            if (!CanWriteToInstallDirectory())
            {
                var location = Path.GetFullPath(AppContext.BaseDirectory).TrimEnd(Path.DirectorySeparatorChar);
                MessageBox.Show(
                    $"Classroom Widgets is installed in\n{location}\nwhich this account cannot modify, so the automatic update would fail and roll back.\n\nReinstall to the default per-user location (no administrator rights needed), or run the new installer manually as administrator.",
                    "Unable to update Classroom Widgets",
                    MessageBoxButton.OK,
                    MessageBoxImage.Warning);
                return;
            }

            var choice = MessageBox.Show(
                $"Classroom Widgets {availableVersion} is available.\n\nYou are using version {App.AppVersion}. The update will be downloaded and the app will restart.",
                "Update available",
                MessageBoxButton.OKCancel,
                MessageBoxImage.Information);
            if (choice != MessageBoxResult.OK) return;
            installApproved = true;

            downloadPath = Path.Combine(Path.GetTempPath(), expectedName);
            using (var download = await Client.GetAsync(asset.DownloadUrl, HttpCompletionOption.ResponseHeadersRead))
            {
                download.EnsureSuccessStatusCode();
                await using var source = await download.Content.ReadAsStreamAsync();
                await using var destination = File.Create(downloadPath);
                await source.CopyToAsync(destination);
            }
            await using (var downloaded = File.OpenRead(downloadPath))
            {
                var digest = $"sha256:{Convert.ToHexString(await SHA256.HashDataAsync(downloaded)).ToLowerInvariant()}";
                if (!digest.Equals(asset.Digest, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Update checksum verification failed");
            }

            if (isInstalled)
                StartInstalledUpdate(downloadPath, availableVersion);
            else
                StartPortableUpdate(downloadPath);
            handoffStarted = true;
            await _quit();
        }
        catch (Exception error)
        {
            if (!handoffStarted && downloadPath is not null) TryDeleteFile(downloadPath);
            DashboardLog.Warn($"Update check failed: {error.Message}");
            if (manual || installApproved) MessageBox.Show("The update could not be installed. The existing app has not been changed. Check your connection and try again.", "Unable to update Classroom Widgets", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
        finally
        {
            _checking = false;
        }
    }

    private static void OpenReleasePage(string url, string message)
    {
        if (MessageBox.Show(message, "Update available", MessageBoxButton.OKCancel, MessageBoxImage.Information) != MessageBoxResult.OK) return;
        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
    }

    private static void StartPortableUpdate(string archive)
    {
        var target = Path.GetFullPath(AppContext.BaseDirectory).TrimEnd(Path.DirectorySeparatorChar);
        var staging = $"{target}.update-{Guid.NewGuid():N}";
        var backup = $"{target}.previous-{Guid.NewGuid():N}";
        var executable = Path.GetFileName(Environment.ProcessPath) ?? "ClassroomWidgets.exe";
        var script = Path.Combine(Path.GetTempPath(), $"classroom-widgets-update-{Guid.NewGuid():N}.ps1");
        try
        {
            ZipFile.ExtractToDirectory(archive, staging);
            File.Delete(archive);
            File.WriteAllText(script, """
            param([int]$ProcessId, [string]$Staging, [string]$Target, [string]$Backup, [string]$Executable)
            $ErrorActionPreference = 'Stop'
            Wait-Process -Id $ProcessId -ErrorAction SilentlyContinue
            $installed = [System.Collections.Generic.List[string]]::new()
            $cleanup = $false
            $separators = [char[]]@([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
            $stagingRoot = $Staging.TrimEnd($separators) + [System.IO.Path]::DirectorySeparatorChar
            $backupRoot = $Backup.TrimEnd($separators) + [System.IO.Path]::DirectorySeparatorChar
            try {
              foreach ($file in Get-ChildItem -LiteralPath $Staging -File -Recurse) {
                $relative = $file.FullName.Substring($stagingRoot.Length)
                $destination = Join-Path $Target $relative
                $saved = Join-Path $Backup $relative
                New-Item -ItemType Directory -Path (Split-Path $destination) -Force | Out-Null
                if (Test-Path -LiteralPath $destination) {
                  New-Item -ItemType Directory -Path (Split-Path $saved) -Force | Out-Null
                  Move-Item -LiteralPath $destination -Destination $saved
                }
                Move-Item -LiteralPath $file.FullName -Destination $destination
                $installed.Add($destination)
              }
              $replacement = Start-Process -FilePath (Join-Path $Target $Executable) -ArgumentList '--background' -PassThru
              Start-Sleep -Seconds 2
              if ($replacement.HasExited) { throw 'The updated app exited during startup.' }
              $cleanup = $true
            } catch {
              try {
                foreach ($destination in $installed) {
                  Remove-Item -LiteralPath $destination -Force -ErrorAction SilentlyContinue
                }
                if (Test-Path -LiteralPath $Backup) {
                  foreach ($file in Get-ChildItem -LiteralPath $Backup -File -Recurse) {
                    $relative = $file.FullName.Substring($backupRoot.Length)
                    $destination = Join-Path $Target $relative
                    New-Item -ItemType Directory -Path (Split-Path $destination) -Force | Out-Null
                    Move-Item -LiteralPath $file.FullName -Destination $destination -Force
                  }
                }
                if (Test-Path -LiteralPath (Join-Path $Target $Executable)) { Start-Process -FilePath (Join-Path $Target $Executable) -ArgumentList '--background' }
                $cleanup = $true
              } catch {
                # Preserve staging and backup for manual recovery.
              }
            }
            if ($cleanup) {
              Remove-Item -LiteralPath $Staging, $Backup, $PSCommandPath -Recurse -Force -ErrorAction SilentlyContinue
            }
            """);
            var start = new ProcessStartInfo("powershell.exe") { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = Path.GetTempPath() };
            foreach (var argument in new[] { "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-ProcessId", Environment.ProcessId.ToString(), "-Staging", staging, "-Target", target, "-Backup", backup, "-Executable", executable })
                start.ArgumentList.Add(argument);
            Process.Start(start);
        }
        catch
        {
            TryDeleteDirectory(staging);
            TryDeleteFile(script);
            throw;
        }
    }

    private static bool CanWriteToInstallDirectory()
    {
        try
        {
            var probe = Path.Combine(AppContext.BaseDirectory, $".write-test-{Guid.NewGuid():N}");
            File.WriteAllBytes(probe, Array.Empty<byte>());
            File.Delete(probe);
            return true;
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            DashboardLog.Warn($"Install directory is not writable, automatic update would roll back: {error.Message}");
            return false;
        }
    }

    private static void StartInstalledUpdate(string installer, string version)
    {
        // Inno's own log records which file or process blocked the install; the
        // app log only learns the exit code after the app has already quit.
        var logFile = Path.Combine(DashboardSettings.DataDirectory, $"update-{version}-{DateTime.Now:yyyyMMdd-HHmmss}.log");
        Directory.CreateDirectory(DashboardSettings.DataDirectory);
        var appLog = Path.Combine(DashboardSettings.DataDirectory, "classroom-widgets.log");
        var appExe = Environment.ProcessPath ?? Path.Combine(AppContext.BaseDirectory, "ClassroomWidgets.exe");
        var script = Path.Combine(Path.GetTempPath(), $"classroom-widgets-update-{Guid.NewGuid():N}.ps1");
        File.WriteAllText(script, """
            param([int]$ProcessId, [string]$Installer, [string]$LogFile, [string]$AppLog, [string]$AppExe)
            Wait-Process -Id $ProcessId -ErrorAction SilentlyContinue
            $setup = Start-Process -FilePath $Installer -Wait -PassThru -ArgumentList @(
              '/SILENT', '/SUPPRESSMSGBOXES', '/CLOSEAPPLICATIONS', '/LOGCLOSEAPPLICATIONS', "/LOG=`"$LogFile`"")
            if ($setup.ExitCode -eq 0) {
              Remove-Item -LiteralPath $Installer, $LogFile, $PSCommandPath -Force -ErrorAction SilentlyContinue
              return
            }
            $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff'
            Add-Content -LiteralPath $AppLog -Value "$stamp [ERROR] Update installer exited with code $($setup.ExitCode); see $LogFile" -ErrorAction SilentlyContinue
            if (Test-Path -LiteralPath $AppExe) { Start-Process -FilePath $AppExe -ArgumentList '--background' }
            $message = "The Classroom Widgets update failed and was rolled back (installer exit code $($setup.ExitCode)).`n`nInstaller log:`n$LogFile`n`nThe installer was kept at $Installer - run it manually to see the error. If the app lives outside your user profile (e.g. Program Files), reinstall it to the default location to enable automatic updates."
            [void](New-Object -ComObject WScript.Shell).Popup($message, 0, 'Classroom Widgets update failed', 48)
            Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue
            """);
        var start = new ProcessStartInfo("powershell.exe") { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = Path.GetTempPath() };
        foreach (var argument in new[] { "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-ProcessId", Environment.ProcessId.ToString(), "-Installer", installer, "-LogFile", logFile, "-AppLog", appLog, "-AppExe", appExe })
            start.ArgumentList.Add(argument);
        Process.Start(start);
    }

    private static HttpClient CreateClient()
    {
        var client = new HttpClient();
        client.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("ClassroomWidgets", App.AppVersion));
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        return client;
    }

    private static bool HasUsableDigest(string? digest) =>
        digest is { Length: 71 }
        && digest.StartsWith("sha256:", StringComparison.Ordinal)
        && digest[7..].All(Uri.IsHexDigit);

    private static void TryDeleteFile(string path)
    {
        try
        {
            File.Delete(path);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            DashboardLog.Warn($"Unable to remove update file: {error.Message}");
        }
    }

    private static void TryDeleteDirectory(string path)
    {
        try
        {
            if (Directory.Exists(path)) Directory.Delete(path, recursive: true);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            DashboardLog.Warn($"Unable to remove update directory: {error.Message}");
        }
    }

    private sealed record GitHubRelease(
        [property: System.Text.Json.Serialization.JsonPropertyName("tag_name")] string TagName,
        [property: System.Text.Json.Serialization.JsonPropertyName("html_url")] string HtmlUrl,
        [property: System.Text.Json.Serialization.JsonPropertyName("assets")] GitHubAsset[] Assets);

    private sealed record GitHubAsset(
        [property: System.Text.Json.Serialization.JsonPropertyName("name")] string Name,
        [property: System.Text.Json.Serialization.JsonPropertyName("browser_download_url")] string DownloadUrl,
        [property: System.Text.Json.Serialization.JsonPropertyName("digest")] string? Digest);
}
