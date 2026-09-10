import { SceneApiError, type SceneApi } from './SceneApi';
import type { SceneSnapshot } from './types';
import { parseSceneSnapshot } from './validate';

export const SNAPSHOT_PATH = '/api/scene/snapshot';

/**
 * Real backend client. Parameterised by the host base URL, e.g.
 * `new RealSceneApi('http://192.168.1.10:8080')`.
 *
 * Auth and transport security are intentionally out of scope (FR-004).
 */
export class RealSceneApi implements SceneApi {
  private readonly snapshotUrl: string;

  constructor(baseUrl: string) {
    // SNAPSHOT_PATH is absolute, so only origin (scheme/host/port) of baseUrl is used.
    this.snapshotUrl = new URL(SNAPSHOT_PATH, baseUrl).toString();
  }

  async fetchSnapshot(signal?: AbortSignal): Promise<SceneSnapshot> {
    let response: Response;
    try {
      response = await fetch(this.snapshotUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal,
      });
    } catch (err) {
      if (signal?.aborted) throw err;
      throw new SceneApiError(`Network error while requesting ${this.snapshotUrl}`, err);
    }

    if (!response.ok) {
      throw new SceneApiError(`Backend responded ${response.status} ${response.statusText}`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (err) {
      throw new SceneApiError('Backend returned non-JSON body', err);
    }

    return parseSceneSnapshot(payload);
  }
}
