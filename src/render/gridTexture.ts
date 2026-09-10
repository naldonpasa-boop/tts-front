import { CanvasSource, Texture } from 'pixi.js';

export interface GridCellStyle {
  cellSize: number;
  fillColor: number;
  lineColor: number;
  lineWidth?: number;
  /** Texture resolution multiplier; >1 keeps lines crisp when zoomed in. */
  resolution?: number;
}

/**
 * Builds the texture of a single grid cell for `TilingSprite` (A-005.2).
 *
 * Only the top and left edges carry a line: when the tile repeats, the
 * neighbour's top/left lines close the cell, so no line is drawn twice.
 * The right/bottom edge of the whole field is closed by a separate border
 * in `SceneRenderer`.
 *
 * The tile is rasterised with Canvas 2D rather than `renderer.generateTexture`:
 * a plain `CanvasSource` tiles reliably, whereas a `RenderTexture` did not
 * repeat inside `TilingSprite` in our tests with PixiJS 8.20.
 */
export function createGridCellTexture(style: GridCellStyle): Texture {
  const { cellSize, fillColor, lineColor, lineWidth = 1, resolution = 2 } = style;

  const canvas = document.createElement('canvas');
  canvas.width = cellSize * resolution;
  canvas.height = cellSize * resolution;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is not available');

  ctx.scale(resolution, resolution);
  ctx.fillStyle = toCss(fillColor);
  ctx.fillRect(0, 0, cellSize, cellSize);
  ctx.fillStyle = toCss(lineColor);
  ctx.fillRect(0, 0, lineWidth, cellSize); // left edge
  ctx.fillRect(0, 0, cellSize, lineWidth); // top edge

  const source = new CanvasSource({
    resource: canvas,
    resolution,
    addressMode: 'repeat',
    scaleMode: 'linear',
    // Mipmaps let the 1px lines fade into a smooth tone when zoomed far out
    // instead of flickering as they fall below one screen pixel.
    autoGenerateMipmaps: true,
  });

  return new Texture({ source, label: 'grid-cell' });
}

function toCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
