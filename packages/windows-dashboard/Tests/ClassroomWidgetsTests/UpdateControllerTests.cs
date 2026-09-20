using System.IO;
using ClassroomWidgets;
using Xunit;

namespace ClassroomWidgetsTests;

public sealed class UpdateVersionTests
{
    [Theory]
    [InlineData("0.12.0", "0.11.9", true)]
    [InlineData("v0.11.10", "0.11.9", true)]
    [InlineData("0.11.2", "0.11.2", false)]
    [InlineData("nightly", "0.11.2", false)]
    public void ComparesSemanticVersions(string candidate, string current, bool expected)
    {
        Assert.Equal(expected, UpdateVersion.IsNewer(candidate, current));
    }
}

public sealed class WindowsInstallationTests
{
    [Fact]
    public void RecognizesCustomInstallerDirectory()
    {
        var directory = Path.Combine(Path.GetTempPath(), "Classroom Widgets Custom");

        Assert.True(WindowsInstallation.MatchesInstallLocation(directory, directory + Path.DirectorySeparatorChar));
    }

    [Fact]
    public void RejectsPortableDirectoryBesideInstallation()
    {
        var installed = Path.Combine(Path.GetTempPath(), "Classroom Widgets");
        var portable = Path.Combine(Path.GetTempPath(), "Classroom Widgets Portable");

        Assert.False(WindowsInstallation.MatchesInstallLocation(portable, installed));
        Assert.False(WindowsInstallation.MatchesInstallLocation(portable, null));
    }
}

public sealed class DashboardSettingsTests
{
    [Theory]
    [InlineData("\"C:\\Apps\\ClassroomWidgets.exe\" --background", true)]
    [InlineData("\"C:\\Apps\\ClassroomWidgets.exe\" --background --other", true)]
    [InlineData("\"C:\\Apps\\--background\\ClassroomWidgets.exe\"", false)]
    [InlineData("\"C:\\Apps\\ClassroomWidgets.exe\" --backgrounding", false)]
    public void DetectsBackgroundAsAnExactArgument(string command, bool expected)
    {
        Assert.Equal(expected, DashboardSettings.HasBackgroundArgument(command));
    }
}
