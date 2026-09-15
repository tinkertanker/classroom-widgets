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
                if (manual) MessageBox.Show($"Version {App.AppVersion} is the latest version.", "Classroom Widgets is up to date", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            var isInstalled = WindowsInstallation.IsInstallerManaged(AppContext.BaseDirectory);
            var expectedName = isInstalled
                ? $"ClassroomWidgets-v{available.ToString(3)}-windows-x64-setup.exe"
                : $"ClassroomWidgets-v{available.ToString(3)}-windows-x64.zip";
            var asset = release.Assets.FirstOrDefault(candidate => candidate.Name == expectedName);
            if (asset is null)
            {
                OpenReleasePage(release.HtmlUrl, $"Version {available.ToString(3)} is available, but its Windows installer is not attached yet.");
                return;
            }

            var choice = MessageBox.Show(
                $"Classroom Widgets {available.ToString(3)} is available.\n\nYou are using version {App.AppVersion}. The update will be downloaded and the app will restart.",
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
                StartInstalledUpdate(downloadPath);
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
              $replacement = Start-Process -FilePath (Join-Path $Target $Executable) -PassThru
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
                if (Test-Path -LiteralPath (Join-Path $Target $Executable)) { Start-Process -FilePath (Join-Path $Target $Executable) }
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

    private static void StartInstalledUpdate(string installer)
    {
        var script = Path.Combine(Path.GetTempPath(), $"classroom-widgets-update-{Guid.NewGuid():N}.ps1");
        File.WriteAllText(script, """
            param([int]$ProcessId, [string]$Installer)
            Wait-Process -Id $ProcessId -ErrorAction SilentlyContinue
            Start-Process -FilePath $Installer -ArgumentList '/SILENT /SUPPRESSMSGBOXES /CLOSEAPPLICATIONS' -Wait
            Remove-Item -LiteralPath $Installer, $PSCommandPath -Force -ErrorAction SilentlyContinue
            """);
        var start = new ProcessStartInfo("powershell.exe") { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = Path.GetTempPath() };
        foreach (var argument in new[] { "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-ProcessId", Environment.ProcessId.ToString(), "-Installer", installer })
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
        [property: System.Text.Json.Serialization.JsonPropertyName("digest")] string Digest);
}
