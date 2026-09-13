using System.Text.Json;

namespace ClassroomWidgets;

public readonly record struct PanelSize(double Width, double Height)
{
    public PanelSize Clamped() => new(Math.Max(Width, 1), Math.Max(Height, 1));
}

public sealed record CompactWidgetOption(int WidgetType, string Title);

/// <summary>
/// One widget the host has asked native to present. The full snapshot payload
/// is retained verbatim so it can be forwarded to the panel web view unchanged.
/// </summary>
public sealed record WidgetPanelDescriptor(
    string Id,
    string Title,
    PanelSize PreferredContentSize,
    PanelSize MinimumContentSize,
    PanelSize? MaximumContentSize,
    bool IsResizable,
    double? AspectRatio,
    int Revision,
    int StateRevision,
    JsonElement SnapshotPayload)
{
    public static WidgetPanelDescriptor? FromPayload(JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object) return null;
        if (!payload.TryGetProperty("schemaVersion", out var schema) || !schema.TryGetInt32(out var schemaVersion) || schemaVersion != 1) return null;
        if (!TryGetString(payload, "widgetId", out var id) || string.IsNullOrEmpty(id)) return null;
        if (!TryGetString(payload, "title", out var title)) return null;
        if (!TryGetSize(payload, "preferredSize", out var preferred)) return null;
        if (!TryGetSize(payload, "minimumSize", out var minimum)) return null;
        if (!payload.TryGetProperty("isResizable", out var resizable) || resizable.ValueKind is not (JsonValueKind.True or JsonValueKind.False)) return null;
        if (!payload.TryGetProperty("maintainsAspectRatio", out var aspect) || aspect.ValueKind is not (JsonValueKind.True or JsonValueKind.False)) return null;
        if (!payload.TryGetProperty("maximumSize", out var maximumValue)) return null;

        PanelSize? maximum = null;
        if (maximumValue.ValueKind == JsonValueKind.Object)
        {
            if (!TryGetSize(payload, "maximumSize", out var parsedMaximum)) return null;
            maximum = parsedMaximum;
        }
        else if (maximumValue.ValueKind != JsonValueKind.Null)
        {
            return null;
        }

        var revision = payload.TryGetProperty("revision", out var revisionValue) && revisionValue.TryGetInt32(out var parsedRevision) ? parsedRevision : 0;
        var stateRevision = payload.TryGetProperty("stateRevision", out var stateValue) && stateValue.TryGetInt32(out var parsedState) ? parsedState : 0;
        var maintainsAspectRatio = aspect.GetBoolean();

        return new WidgetPanelDescriptor(
            id,
            title,
            preferred,
            minimum,
            maximum,
            resizable.GetBoolean(),
            maintainsAspectRatio && preferred.Height > 0 ? preferred.Width / preferred.Height : null,
            revision,
            stateRevision,
            payload.Clone());
    }

    private static bool TryGetString(JsonElement element, string name, out string value)
    {
        value = string.Empty;
        if (!element.TryGetProperty(name, out var property) || property.ValueKind != JsonValueKind.String) return false;
        value = property.GetString() ?? string.Empty;
        return true;
    }

    private static bool TryGetSize(JsonElement element, string name, out PanelSize size)
    {
        size = default;
        if (!element.TryGetProperty(name, out var property) || property.ValueKind != JsonValueKind.Object) return false;
        if (!property.TryGetProperty("width", out var width) || !width.TryGetDouble(out var w)) return false;
        if (!property.TryGetProperty("height", out var height) || !height.TryGetDouble(out var h)) return false;
        size = new PanelSize(w, h);
        return true;
    }
}

public sealed record WidgetPanelInventory(string HostInstanceId, int Revision, IReadOnlyList<WidgetPanelDescriptor> Widgets, IReadOnlyList<CompactWidgetOption>? Options)
{
    public static WidgetPanelInventory? FromMessage(JsonElement body)
    {
        if (!body.TryGetProperty("schemaVersion", out var schema) || !schema.TryGetInt32(out var schemaVersion) || schemaVersion != 1) return null;
        if (!body.TryGetProperty("hostInstanceId", out var hostValue) || hostValue.ValueKind != JsonValueKind.String) return null;
        var hostInstanceId = hostValue.GetString()?.Trim();
        if (string.IsNullOrEmpty(hostInstanceId)) return null;
        if (!body.TryGetProperty("inventoryRevision", out var revisionValue) || !revisionValue.TryGetInt32(out var revision) || revision < 0) return null;
        if (!body.TryGetProperty("widgets", out var widgetsValue) || widgetsValue.ValueKind != JsonValueKind.Array) return null;

        var widgets = widgetsValue.EnumerateArray()
            .Select(WidgetPanelDescriptor.FromPayload)
            .Where(descriptor => descriptor is not null)
            .Cast<WidgetPanelDescriptor>()
            .ToList();

        IReadOnlyList<CompactWidgetOption>? options = null;
        if (body.TryGetProperty("compactWidgetOptions", out var optionsValue) && optionsValue.ValueKind == JsonValueKind.Array)
        {
            var seen = new HashSet<int>();
            var parsed = new List<CompactWidgetOption>();
            foreach (var option in optionsValue.EnumerateArray())
            {
                if (!option.TryGetProperty("widgetType", out var typeValue) || !typeValue.TryGetInt32(out var widgetType)) continue;
                if (!option.TryGetProperty("title", out var titleValue) || titleValue.ValueKind != JsonValueKind.String) continue;
                var title = titleValue.GetString()?.Trim();
                if (string.IsNullOrEmpty(title) || !seen.Add(widgetType)) continue;
                parsed.Add(new CompactWidgetOption(widgetType, title));
            }
            options = parsed;
        }

        return new WidgetPanelInventory(hostInstanceId, revision, widgets, options);
    }
}

public enum WidgetPanelLayout
{
    Freeform,
    Row,
    Column
}

/// <summary>A state write from a panel that the host store must apply.</summary>
public sealed record WidgetPanelStateChange(string WidgetId, JsonElement Payload);
