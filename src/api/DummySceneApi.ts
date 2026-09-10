import type { SceneApi } from './SceneApi';
import type { SceneObjectDto, SceneSnapshot } from './types';

/**
 * In-memory stand-in for the backend. Returns the same static snapshot on
 * every call — exactly what the MVP is wired with.
 *
 * The default snapshot is generated deterministically so it always looks
 * the same: 50 tokens (FR-008) scattered over a 100x100 field (FR-010) with
 * integer world coordinates.
 */
export class DummySceneApi implements SceneApi {
  private readonly snapshot: SceneSnapshot;

  constructor(snapshot: SceneSnapshot = DummySceneApi.defaultSnapshot()) {
    this.snapshot = snapshot;
  }

  fetchSnapshot(): Promise<SceneSnapshot> {
    // Return a fresh copy so a consumer can never mutate our "server state".
    return Promise.resolve({
      snapshotVersion: this.snapshot.snapshotVersion,
      sceneObjects: this.snapshot.sceneObjects.map((o) => ({ ...o })),
    });
  }

  static defaultSnapshot(options: DummySnapshotOptions = {}): SceneSnapshot {
    const { tokenCount = 50, cellSize = 64, columns = 100, rows = 100, seed = 42 } = options;

    const rand = mulberry32(seed);
    const sceneObjects: SceneObjectDto[] = [];
    const usedCells = new Set<number>();

    while (sceneObjects.length < tokenCount) {
      const col = Math.floor(rand() * columns);
      const row = Math.floor(rand() * rows);
      const key = row * columns + col;
      if (usedCells.has(key)) continue;
      usedCells.add(key);

      // Coordinates are world units, deliberately *not* cell-aligned (FR-011):
      // pick a random integer point somewhere inside the chosen cell.
      const x = col * cellSize + Math.floor(rand() * cellSize);
      const y = row * cellSize + Math.floor(rand() * cellSize);

      sceneObjects.push({ id: sceneObjects.length + 1, x, y });
    }

    return { snapshotVersion: 1, sceneObjects };
  }
}

export interface DummySnapshotOptions {
  tokenCount?: number;
  cellSize?: number;
  columns?: number;
  rows?: number;
  seed?: number;
}

/** Tiny seeded PRNG so the dummy scene is reproducible between reloads. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
