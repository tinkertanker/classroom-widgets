using System.Diagnostics;
using System.IO;
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

            var installedDirectory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Classroom Widgets");
            var isInstalled = Path.GetFullPath(AppContext.BaseDirectory).TrimEnd(Path.DirectorySeparatorChar).Equals(installedDirectory, StringComparison.OrdinalIgnoreCase);
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

            var installer = Path.Combine(Path.GetTempPath(), expectedName);
            using (var download = await Client.GetAsync(asset.DownloadUrl, HttpCompletionOption.ResponseHeadersRead))
            {
                download.EnsureSuccessStatusCode();
                await using var source = await download.Content.ReadAsStreamAsync();
                await using var destination = File.Create(installer);
                await source.CopyToAsync(destination);
            }
            await using (var downloaded = File.OpenRead(installer))
            {
                var digest = $"sha256:{Convert.ToHexString(await SHA256.HashDataAsync(downloaded)).ToLowerInvariant()}";
                if (!digest.Equals(asset.Digest, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Update checksum verification failed");
            }

            if (isInstalled)
                StartInstalledUpdate(installer);
            else
                StartPortableUpdate(installer);
            await _quit();
        }
        catch (Exception error) when (error is HttpRequestException or IOException or JsonException or InvalidOperationException or System.ComponentModel.Win32Exception or FormatException)
        {
            DashboardLog.Warn($"Update check failed: {error.Message}");
            if (manual) MessageBox.Show("Check your connection and try again.", "Unable to check for updates", MessageBoxButton.OK, MessageBoxImage.Warning);
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
        var script = Path.Combine(Path.GetTempPath(), $"classroom-widgets-update-{Environment.ProcessId}.ps1");
        File.WriteAllText(script, """
            param([int]$ProcessId, [string]$Archive, [string]$Target, [string]$Executable)
            Wait-Process -Id $ProcessId -ErrorAction SilentlyContinue
            $staging = Join-Path ([System.IO.Path]::GetTempPath()) ("classroom-widgets-extract-" + [guid]::NewGuid())
            Expand-Archive -LiteralPath $Archive -DestinationPath $staging -Force
            Copy-Item -Path (Join-Path $staging '*') -Destination $Target -Recurse -Force
            Start-Process -FilePath (Join-Path $Target $Executable)
            Remove-Item -LiteralPath $staging, $Archive, $PSCommandPath -Recurse -Force -ErrorAction SilentlyContinue
            """);
        var arguments = $"-NoProfile -ExecutionPolicy Bypass -File \"{script}\" -ProcessId {Environment.ProcessId} -Archive \"{archive}\" -Target \"{AppContext.BaseDirectory}\" -Executable \"{Path.GetFileName(Environment.ProcessPath)}\"";
        Process.Start(new ProcessStartInfo("powershell.exe", arguments) { UseShellExecute = false, CreateNoWindow = true });
    }

    private static void StartInstalledUpdate(string installer)
    {
        var script = Path.Combine(Path.GetTempPath(), $"classroom-widgets-update-{Environment.ProcessId}.ps1");
        File.WriteAllText(script, """
            param([int]$ProcessId, [string]$Installer)
            Wait-Process -Id $ProcessId -ErrorAction SilentlyContinue
            Start-Process -FilePath $Installer -ArgumentList '/SILENT /SUPPRESSMSGBOXES /CLOSEAPPLICATIONS' -Wait
            Remove-Item -LiteralPath $Installer, $PSCommandPath -Force -ErrorAction SilentlyContinue
            """);
        var arguments = $"-NoProfile -ExecutionPolicy Bypass -File \"{script}\" -ProcessId {Environment.ProcessId} -Installer \"{installer}\"";
        Process.Start(new ProcessStartInfo("powershell.exe", arguments) { UseShellExecute = false, CreateNoWindow = true });
    }

    private static HttpClient CreateClient()
    {
        var client = new HttpClient();
        client.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("ClassroomWidgets", App.AppVersion));
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        return client;
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
