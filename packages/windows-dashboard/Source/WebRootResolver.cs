using System.IO;

namespace ClassroomWidgets;

/// <summary>
/// Locates the production teacher build that the WebView2 surfaces load.
/// Resolution order mirrors the macOS shell: explicit override, bundled copy
/// beside the executable, then a repository checkout above the executable.
/// </summary>
public static class WebRootResolver
{
    private static readonly Lazy<string> Resolved = new(ResolveOnce);

    public static string Resolve() => Resolved.Value;

    private static string ResolveOnce()
    {
        var overridePath = Environment.GetEnvironmentVariable("CLASSROOM_WIDGETS_WEB_ROOT");
        if (!string.IsNullOrWhiteSpace(overridePath))
        {
            return Path.GetFullPath(overridePath);
        }

        var bundled = Path.Combine(AppContext.BaseDirectory, "Web");
        if (File.Exists(Path.Combine(bundled, "index.html")))
        {
            return bundled;
        }

        var current = new DirectoryInfo(AppContext.BaseDirectory);
        for (var depth = 0; depth < 10 && current is not null; depth++)
        {
            var candidate = Path.Combine(current.FullName, "packages", "teacher", "build");
            if (File.Exists(Path.Combine(candidate, "index.html")))
            {
                return candidate;
            }
            current = current.Parent;
        }

        return Path.Combine(Directory.GetCurrentDirectory(), "packages", "teacher", "build");
    }
}
