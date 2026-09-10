import type { SceneApi, SceneSnapshot } from '../api';

export interface ScenePollerOptions {
  /** Delay between the end of one request and the start of the next. */
  intervalMs: number;
  /** Called only when a snapshot with a *newer* version arrives. */
  onSnapshot: (snapshot: SceneSnapshot) => void;
  /** Called on every failed request; polling continues regardless. */
  onError?: (error: unknown) => void;
}

/**
 * Short polling loop (A-002-1).
 *
 * Requests are strictly sequential: the next one is scheduled only after
 * the previous one settles, so a slow backend can never pile up requests.
 * Snapshots whose `snapshotVersion` is not greater than the last applied
 * one are dropped, so the renderer is touched only when something changed.
 */
export class ScenePoller {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private abort: AbortController | null = null;
  private running = false;
  private lastVersion = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly api: SceneApi,
    private readonly options: ScenePollerOptions,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.tick();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.abort?.abort();
    this.abort = null;
  }

  get isRunning(): boolean {
    return this.running;
  }

  private async tick(): Promise<void> {
    if (!this.running) return;

    this.abort = new AbortController();
    try {
      const snapshot = await this.api.fetchSnapshot(this.abort.signal);
      if (!this.running) return;
      if (snapshot.snapshotVersion > this.lastVersion) {
        this.lastVersion = snapshot.snapshotVersion;
        this.options.onSnapshot(snapshot);
      }
    } catch (err) {
      if (!this.running) return; // aborted by stop()
      this.options.onError?.(err);
    } finally {
      this.abort = null;
    }

    if (this.running) {
      this.timer = setTimeout(() => void this.tick(), this.options.intervalMs);
    }
  }
}
