/**
 * Application configuration for the MVP.
 *
 * Values marked with `VITE_*` can be overridden via environment variables
 * (see `.env.example`). Everything else is a compile-time constant.
 */

export type SceneApiMode = 'dummy' | 'real';

function readApiMode(raw: string | undefined): SceneApiMode {
  return raw === 'real' ? 'real' : 'dummy';
}

export const config = {
  grid: {
    /** Size of a single grid cell in world units (pixels at zoom 1). */
    cellSize: 64,
    /** Number of cells horizontally (FR-010). */
    columns: 100,
    /** Number of cells vertically (FR-010). */
    rows: 100,
  },
  polling: {
    /** Short-polling interval (A-002). */
    intervalMs: 200,
  },
  api: {
    /** Which SceneApi implementation to wire. MVP default: dummy. */
    mode: readApiMode(import.meta.env.VITE_SCENE_API),
    /** Base URL for the real backend, e.g. http://192.168.1.10:8080 */
    baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080',
  },
  assets: {
    /** Single placeholder image used for every token (FR-005). */
    tokenPlaceholder: `${import.meta.env.BASE_URL}token.svg`,
  },
  colors: {
    background: 0x1b1d22,
    cellFill: 0x24272e,
    gridLine: 0x3c414b,
    gridBorder: 0x5b6270,
  },
} as const;

export type AppConfig = typeof config;
