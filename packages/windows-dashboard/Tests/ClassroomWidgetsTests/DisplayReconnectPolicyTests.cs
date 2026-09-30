using ClassroomWidgets;
using Xunit;

namespace ClassroomWidgetsTests;

// Each test is one way hide-on-disconnect / show-on-reconnect could go wrong.
// Mirrors the Linux and macOS policy tests.
public class DisplayReconnectPolicyTests
{
    private static DisplayReconnectPolicy AutoHidden()
    {
        var policy = new DisplayReconnectPolicy(externalDisplayAvailable: true);
        Assert.Equal(DisplayReconnectAction.Hide, policy.DisplaysChanged(false, isOpen: true, showOnReconnect: true));
        policy.WindowClosed();
        return policy;
    }

    [Fact]
    public void LosingTheExternalDisplayHidesAnOpenWidgetAndRemembersWhy()
    {
        Assert.True(AutoHidden().HiddenByDisconnect);
    }

    [Fact]
    public void TheWidgetComesBackOnceWhenTheDisplayReconnects()
    {
        var policy = AutoHidden();
        Assert.Equal(DisplayReconnectAction.Show, policy.DisplaysChanged(true, isOpen: false, showOnReconnect: true));
        policy.WindowOpened();
        Assert.Equal(DisplayReconnectAction.None, policy.DisplaysChanged(true, isOpen: true, showOnReconnect: true));
        Assert.False(policy.HiddenByDisconnect);
    }

    [Fact]
    public void WithTheSettingOffTheWidgetStaysHiddenEvenAfterLaterNotices()
    {
        var policy = AutoHidden();
        Assert.Equal(DisplayReconnectAction.None, policy.DisplaysChanged(true, isOpen: false, showOnReconnect: false));
        Assert.Equal(DisplayReconnectAction.None, policy.DisplaysChanged(true, isOpen: false, showOnReconnect: true));
    }

    [Fact]
    public void AWidgetTheUserClosedIsNeverBroughtBack()
    {
        var policy = new DisplayReconnectPolicy(externalDisplayAvailable: true);
        policy.WindowOpened();
        policy.WindowClosed();
        Assert.Equal(DisplayReconnectAction.None, policy.DisplaysChanged(false, isOpen: false, showOnReconnect: true));
        Assert.Equal(DisplayReconnectAction.None, policy.DisplaysChanged(true, isOpen: false, showOnReconnect: true));
    }

    [Fact]
    public void OpeningThenClosingWhileDisconnectedCancelsThePendingReconnect()
    {
        var policy = AutoHidden();
        policy.WindowOpened();
        policy.WindowClosed();
        Assert.Equal(DisplayReconnectAction.None, policy.DisplaysChanged(true, isOpen: false, showOnReconnect: true));
    }

    [Fact]
    public void AWidgetOpenedOnASingleDisplayIsNotHiddenByUnrelatedNotices()
    {
        var policy = new DisplayReconnectPolicy(externalDisplayAvailable: false);
        policy.WindowOpened();
        Assert.Equal(DisplayReconnectAction.None, policy.DisplaysChanged(false, isOpen: true, showOnReconnect: true));
        Assert.Equal(DisplayReconnectAction.None, policy.DisplaysChanged(false, isOpen: true, showOnReconnect: true));
    }

    [Fact]
    public void RepeatedNoticesWhileDisconnectedNeitherReHideNorForgetTheAutoHide()
    {
        var policy = AutoHidden();
        Assert.Equal(DisplayReconnectAction.None, policy.DisplaysChanged(false, isOpen: false, showOnReconnect: true));
        Assert.True(policy.HiddenByDisconnect);
        Assert.Equal(DisplayReconnectAction.Show, policy.DisplaysChanged(true, isOpen: false, showOnReconnect: true));
    }

    [Fact]
    public void KeepingAnExternalDisplayDoesNotHideTheWidget()
    {
        var policy = new DisplayReconnectPolicy(externalDisplayAvailable: true);
        Assert.Equal(DisplayReconnectAction.None, policy.DisplaysChanged(true, isOpen: true, showOnReconnect: true));
    }

    [Fact]
    public void AHideThatHasNotClosedYetDoesNotCountAsTheUserClosingIt()
    {
        var policy = new DisplayReconnectPolicy(externalDisplayAvailable: true);
        Assert.Equal(DisplayReconnectAction.Hide, policy.DisplaysChanged(false, isOpen: true, showOnReconnect: true));
        Assert.False(policy.HiddenByDisconnect);
        policy.WindowClosed();
        Assert.True(policy.HiddenByDisconnect);
    }

    [Fact]
    public void PreferencesFromEarlierVersionsShowDisplayOnReconnect()
    {
        var settings = DashboardSettings.DeserializeSettings("""{ "BackgroundOpacity": 0.4 }""");

        Assert.NotNull(settings);
        Assert.True(settings.DisplayPreviewShowOnReconnect);
    }
}
