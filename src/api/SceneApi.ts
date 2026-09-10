import type { SceneSnapshot } from './types';

/**
 * Boundary between the frontend and the backend service.
 *
 * Everything that knows about HTTP, hosts and paths lives behind this
 * interface. The rest of the application only ever sees `SceneSnapshot`.
 */
export interface SceneApi {
  /**
   * Fetch the full current scene snapshot (A-003.1).
   *
   * @param signal optional abort signal so the poller can cancel an
   *               in-flight request on shutdown.
   */
  fetchSnapshot(signal?: AbortSignal): Promise<SceneSnapshot>;
}

export class SceneApiError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'SceneApiError';
  }
}
