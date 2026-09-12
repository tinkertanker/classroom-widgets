/**
 * Counts fire-and-forget writes into the host store (Randomiser list saves
 * and deletes) so reload and quit can wait for them to land before the host
 * is torn down. Mirrors the Windows shell's HostWriteTracker.
 */
export class HostWriteTracker {
  private count = 0;
  private failed = false;
  private generation = 0;
  private waiters: Array<(result: boolean) => void> = [];

  begin(): number {
    this.count++;
    return this.generation;
  }

  finish(succeeded: boolean, generation: number): void {
    if (generation !== this.generation) return;
    this.count = Math.max(0, this.count - 1);
    this.failed ||= !succeeded;
    if (this.count > 0) return;
    this.complete(!this.failed);
  }

  /** Resolves once no writes are in flight; false when any write since the last reset failed. */
  wait(): Promise<boolean> {
    if (this.count === 0) return Promise.resolve(!this.failed);
    return new Promise<boolean>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  /** A failed deactivation attempt must not poison later attempts against the same live host. */
  acknowledgeFailure(): void {
    this.failed = false;
  }

  /** The host is being replaced; outstanding writes can never complete. */
  reset(): void {
    this.generation++;
    this.count = 0;
    this.failed = false;
    this.complete(false);
  }

  private complete(result: boolean): void {
    const waiters = this.waiters;
    this.waiters = [];
    for (const resolve of waiters) resolve(result);
  }
}
