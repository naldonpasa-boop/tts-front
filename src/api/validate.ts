import { SceneApiError } from './SceneApi';
import type { SceneObjectDto, SceneSnapshotDto } from './types';

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isSceneObject(value: unknown): value is SceneObjectDto {
  if (typeof value !== 'object' || value === null) return false;
  const o = value as Record<string, unknown>;
  return isInteger(o.id) && isInteger(o.x) && isInteger(o.y);
}

/**
 * Light runtime validation of the backend payload. Keeps garbage out of
 * the renderer and turns contract drift into an explicit error instead of
 * `NaN` sprite positions.
 */
export function parseSceneSnapshot(payload: unknown): SceneSnapshotDto {
  if (typeof payload !== 'object' || payload === null) {
    throw new SceneApiError('Snapshot payload is not an object');
  }
  const p = payload as Record<string, unknown>;

  if (!isInteger(p.snapshotVersion)) {
    throw new SceneApiError('snapshotVersion must be an integer');
  }
  if (!Array.isArray(p.sceneObjects)) {
    throw new SceneApiError('sceneObjects must be an array');
  }
  for (let i = 0; i < p.sceneObjects.length; i++) {
    if (!isSceneObject(p.sceneObjects[i])) {
      throw new SceneApiError(`sceneObjects[${i}] must be { id: int, x: int, y: int }`);
    }
  }

  return {
    snapshotVersion: p.snapshotVersion,
    sceneObjects: p.sceneObjects as SceneObjectDto[],
  };
}
