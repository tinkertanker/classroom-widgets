using Xunit;
using Xunit.Abstractions;
using Xunit.Sdk;

[assembly: TestCollectionOrderer("ClassroomWidgetsTests.CaptureDiagnosticOrderer", "ClassroomWidgetsTests")]

namespace ClassroomWidgetsTests;

// Temporary diagnostic branch, not a test-selection policy. Every mode retains
// every collection; default delegates to xUnit 2.9.2's normal orderer.
public sealed class CaptureDiagnosticOrderer : ITestCollectionOrderer
{
    private static readonly string[] FailedRunOrder =
    [
        "WidgetShortcutMenuOrderMigrationTests", "DisplayGeometryTests", "WidgetShortcutSettingsTests",
        "DashboardSettingsTests", "SettingsPersistenceTests", "DisplayPreviewCoordinatorTests",
        "CompactWidgetMenuTests", "WidgetPanelSnapTests", "MoveToNextDisplayGeometryTests",
        "DisplayPreviewReconnectTests", "WindowSnapGeometryTests", "DisplayShortcutTests",
        "WebViewRecoveryTests", "WindowsInstallationTests", "DisplayCaptureSessionTests",
        "NativeMovementTests", "DisplayCatalogTests", "DisplayReconnectPolicyTests",
        "DashboardShortenerSettingsTests", "NativeWindowRegressionTests"
    ];

    public IEnumerable<ITestCollection> OrderTestCollections(IEnumerable<ITestCollection> testCollections)
    {
        var mode = Environment.GetEnvironmentVariable("CLASSROOM_WIDGETS_DIAGNOSTIC_ORDER") ?? "default";
        var collections = new DefaultTestCollectionOrderer().OrderTestCollections(testCollections);
        string[] priority = mode switch
        {
            "default" => [],
            "capture-first" => [nameof(DisplayCaptureSessionTests)],
            "webview-first" => [nameof(WebViewRecoveryTests), nameof(DisplayCaptureSessionTests), .. FailedRunOrder],
            "replay-failure" => FailedRunOrder,
            _ => throw new InvalidOperationException($"Unknown diagnostic order: {mode}")
        };
        var ordered = collections.OrderBy(collection =>
        {
            var index = Array.FindIndex(priority, name => collection.DisplayName.EndsWith("." + name, StringComparison.Ordinal));
            return index < 0 ? int.MaxValue : index;
        }).ToArray();
        var control = Environment.GetEnvironmentVariable("CLASSROOM_WIDGETS_DIAGNOSTIC_CONTROL") ?? "baseline";
        var renderer = Environment.GetEnvironmentVariable("CLASSROOM_WIDGETS_DIAGNOSTIC_RENDERER") ?? "default";
        var report = $"Diagnostic order: {mode}; control={control}; renderer={renderer}; process={Environment.ProcessId}; UTC={DateTime.UtcNow:O}\n"
            + string.Join("\n", ordered.Select((collection, index) => $"{index + 1}: {collection.DisplayName}"));
        Console.WriteLine(report);
        WpfTestHost.SaveEvidenceText("collection-order.txt", report);
        return ordered;
    }
}
