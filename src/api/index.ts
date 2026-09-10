import type { SceneApiMode } from '../config';
import { DummySceneApi } from './DummySceneApi';
import { RealSceneApi } from './RealSceneApi';
import type { SceneApi } from './SceneApi';

export type { SceneApi } from './SceneApi';
export { SceneApiError } from './SceneApi';
export type { SceneObject, SceneObjectDto, SceneSnapshot, SceneSnapshotDto } from './types';
export { DummySceneApi } from './DummySceneApi';
export { RealSceneApi } from './RealSceneApi';

/** Single place where the concrete backend implementation is chosen. */
export function createSceneApi(mode: SceneApiMode, baseUrl: string): SceneApi {
  switch (mode) {
    case 'real':
      return new RealSceneApi(baseUrl);
    case 'dummy':
      return new DummySceneApi();
  }
}
