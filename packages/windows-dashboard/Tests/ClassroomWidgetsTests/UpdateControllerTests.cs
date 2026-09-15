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
