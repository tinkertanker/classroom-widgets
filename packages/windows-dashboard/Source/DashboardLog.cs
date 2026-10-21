using System.Diagnostics;
using System.IO;

namespace ClassroomWidgets;

public static class DashboardLog
{
    private static readonly object Gate = new();

    public static void Info(string message) => Write("INFO", message);
    public static void Warn(string message) => Write("WARN", message);
    public static void Error(string message) => Write("ERROR", message);

    private static void Write(string level, string message)
    {
        var line = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff} [{level}] {message}";
        Debug.WriteLine(line);
        try
        {
            lock (Gate)
            {
                // Read on each write, so tests that redirect the data directory also redirect the log.
                var directory = DashboardSettings.DataDirectory;
                Directory.CreateDirectory(directory);
                File.AppendAllText(Path.Combine(directory, "classroom-widgets.log"), line + Environment.NewLine);
            }
        }
        catch (IOException)
        {
        }
        catch (UnauthorizedAccessException)
        {
        }
    }
}
