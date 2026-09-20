using System.Text.RegularExpressions;
using System.Windows;
using Forms = System.Windows.Forms;

namespace ClassroomWidgets;

public sealed record DisplayDescriptor(
    string Id,
    string Name,
    Rect Bounds,
    Rect WorkingArea,
    bool IsPrimary);

public sealed class DisplayCatalog
{
    private readonly Func<IReadOnlyList<DisplayDescriptor>> _provider;

    public DisplayCatalog(Func<IReadOnlyList<DisplayDescriptor>>? provider = null)
    {
        _provider = provider ?? EnumerateDisplays;
    }

    public IReadOnlyList<DisplayDescriptor> Displays() => _provider();

    public IReadOnlyList<DisplayDescriptor> EligibleSources(string? hostId)
        => Displays().Where(display => !string.Equals(display.Id, hostId, StringComparison.OrdinalIgnoreCase)).ToList();

    public DisplayDescriptor? CurrentMatching(DisplayDescriptor descriptor)
        => Displays().FirstOrDefault(display => string.Equals(display.Id, descriptor.Id, StringComparison.OrdinalIgnoreCase));

    public DisplayDescriptor? ResolveSource(string? rememberedId, IReadOnlyList<DisplayDescriptor> candidates)
        => candidates.FirstOrDefault(candidate => string.Equals(candidate.Id, rememberedId, StringComparison.OrdinalIgnoreCase))
            ?? (candidates.Count == 1 ? candidates[0] : null);

    public string SourceLabel(DisplayDescriptor display)
        => $"{display.Name} — {Math.Round(display.Bounds.Width):0} × {Math.Round(display.Bounds.Height):0}, {DisplayGeometry.DescribePosition(display.Bounds)}";

    private static IReadOnlyList<DisplayDescriptor> EnumerateDisplays()
        => Forms.Screen.AllScreens.Select((screen, index) =>
        {
            var match = Regex.Match(screen.DeviceName, @"DISPLAY(?<number>\d+)$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
            var name = screen.Primary
                ? "Main display"
                : match.Success ? $"Display {match.Groups["number"].Value}" : $"Display {index + 1}";
            return new DisplayDescriptor(
                screen.DeviceName,
                name,
                new Rect(screen.Bounds.X, screen.Bounds.Y, screen.Bounds.Width, screen.Bounds.Height),
                new Rect(screen.WorkingArea.X, screen.WorkingArea.Y, screen.WorkingArea.Width, screen.WorkingArea.Height),
                screen.Primary);
        }).ToList();
}
