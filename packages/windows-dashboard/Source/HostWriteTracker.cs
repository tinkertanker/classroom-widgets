namespace ClassroomWidgets;

/// <summary>
/// Counts fire-and-forget writes into the host store (Randomiser list saves
/// and deletes) so reload and quit can wait for them to land before the host
/// is torn down. Mirrors the macOS shell's HostWriteTracker.
/// </summary>
public sealed class HostWriteTracker
{
    private int _count;
    private bool _failed;
    private int _generation;
    private readonly List<TaskCompletionSource<bool>> _waiters = new();

    public int Begin()
    {
        _count++;
        return _generation;
    }

    public void Finish(bool succeeded, int generation)
    {
        if (generation != _generation) return;
        _count = Math.Max(0, _count - 1);
        _failed |= !succeeded;
        if (_count > 0) return;
        Complete(!_failed);
    }

    /// <summary>Completes once no writes are in flight; false when any write since the last reset failed.</summary>
    public Task<bool> WaitAsync()
    {
        if (_count == 0) return Task.FromResult(!_failed);
        var waiter = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        _waiters.Add(waiter);
        return waiter.Task;
    }

    /// <summary>A failed deactivation attempt must not poison later attempts against the same live host.</summary>
    public void AcknowledgeFailure() => _failed = false;

    /// <summary>The host is being replaced; outstanding writes can never complete.</summary>
    public void Reset()
    {
        _generation++;
        _count = 0;
        _failed = false;
        Complete(false);
    }

    private void Complete(bool result)
    {
        var waiters = _waiters.ToList();
        _waiters.Clear();
        foreach (var waiter in waiters) waiter.TrySetResult(result);
    }
}
