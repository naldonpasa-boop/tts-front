/**
 * Wire contract of `GET /api/scene/snapshot`.
 *
 * Coordinates are integer *world* coordinates (A-004, "Важное замечание").
 * They are not tied to grid cells; the renderer derives the cell by
 * integer division by the cell size (A-004-4).
 */
export interface SceneObjectDto {
  id: number;
  x: number;
  y: number;
}

export interface SceneSnapshotDto {
  snapshotVersion: number;
  sceneObjects: SceneObjectDto[];
}

/** Domain-side aliases. Identical to the DTOs for the MVP (A-003.1, full snapshot). */
export type SceneObject = Readonly<SceneObjectDto>;
export type SceneSnapshot = Readonly<{
  snapshotVersion: number;
  sceneObjects: readonly SceneObject[];
}>;
