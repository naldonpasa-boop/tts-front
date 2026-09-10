import { Application, Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import type { SceneObject, SceneSnapshot } from '../api/types';
import { Emitter } from './Emitter';
import { createGridCellTexture } from './gridTexture';

export interface SceneRendererOptions {
  /** DOM element the canvas is appended to and sized against. */
  host: HTMLElement;
  /** Grid geometry. World size is `columns * cellSize` x `rows * cellSize`. */
  cellSize: number;
  columns: number;
  rows: number;
  /** The single placeholder texture used for every token (FR-005). */
  tokenTexture: Texture;
  colors: {
    background: number;
    cellFill: number;
    gridLine: number;
    gridBorder: number;
  };
  /** Token diameter as a fraction of the cell size. */
  tokenScale?: number;
  /** Upper zoom bound; the lower bound is always "whole world fits on screen". */
  maxZoom?: number;
}

export interface SceneRendererEvents extends Record<string, unknown> {
  /** Fired after a snapshot has been applied to the scene. */
  sceneUpdated: { snapshotVersion: number; tokenCount: number };
  /** Fired when a token is tapped/clicked. Informational only in the MVP (FR-009). */
  tokenTapped: { id: number };
}

/**
 * Encapsulates everything PixiJS (A-007-2a).
 *
 * - Owns the `Application`, the `Viewport` (A-006) and all sprites.
 * - Knows nothing about where snapshots come from: call `updateScene()`.
 * - Reports what happens inside the canvas via `on()` / `off()`.
 * - Never touches the DOM outside of `options.host`.
 */
export class SceneRenderer {
  private readonly app: Application;
  private readonly viewport: Viewport;
  private readonly tokenLayer: Container;
  private readonly tokens = new Map<number, Sprite>();
  private readonly emitter = new Emitter<SceneRendererEvents>();
  private readonly gridTexture: Texture;
  private readonly opts: Required<SceneRendererOptions>;
  private readonly worldWidth: number;
  private readonly worldHeight: number;
  private lastVersion: number | null = null;
  private destroyed = false;

  /** Async factory: PixiJS v8 needs `await app.init()` before use. */
  static async create(options: SceneRendererOptions): Promise<SceneRenderer> {
    const app = new Application();
    await app.init({
      resizeTo: options.host,
      background: options.colors.background,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      preference: 'webgl',
    });
    return new SceneRenderer(app, options);
  }

  private constructor(app: Application, options: SceneRendererOptions) {
    this.app = app;
    this.opts = { tokenScale: 0.85, maxZoom: 4, ...options };
    this.worldWidth = this.opts.columns * this.opts.cellSize;
    this.worldHeight = this.opts.rows * this.opts.cellSize;

    this.opts.host.appendChild(app.canvas);

    // --- Camera (A-006.2: pixi-viewport) ---------------------------------
    this.viewport = new Viewport({
      screenWidth: app.screen.width,
      screenHeight: app.screen.height,
      worldWidth: this.worldWidth,
      worldHeight: this.worldHeight,
      events: app.renderer.events,
    });
    this.viewport.drag().pinch().wheel().decelerate();
    this.viewport.clamp({ direction: 'all', underflow: 'center' });
    this.applyZoomClamp();
    app.stage.addChild(this.viewport);

    // --- Grid (A-005.2: TilingSprite) --------------------------------------
    this.gridTexture = createGridCellTexture({
      cellSize: this.opts.cellSize,
      fillColor: this.opts.colors.cellFill,
      lineColor: this.opts.colors.gridLine,
    });
    const grid = new TilingSprite({
      texture: this.gridTexture,
      width: this.worldWidth,
      height: this.worldHeight,
    });
    grid.eventMode = 'none';
    this.viewport.addChild(grid);

    // Right/bottom edge of the field, which the tile pattern never draws.
    const border = new Graphics()
      .rect(0, 0, this.worldWidth, this.worldHeight)
      .stroke({ width: 2, color: this.opts.colors.gridBorder, alignment: 1 });
    border.eventMode = 'none';
    this.viewport.addChild(border);

    // --- Tokens --------------------------------------------------------------
    this.tokenLayer = new Container();
    this.viewport.addChild(this.tokenLayer);

    // Start by showing the whole field.
    this.viewport.fitWorld(true);
    this.viewport.moveCenter(this.worldWidth / 2, this.worldHeight / 2);

    app.renderer.on('resize', this.handleResize, this);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Synchronise sprites with a full scene snapshot (A-003.1).
   * Adds new tokens, moves existing ones, removes those no longer present.
   */
  updateScene(snapshot: SceneSnapshot): void {
    if (this.destroyed) return;

    const seen = new Set<number>();

    for (const obj of snapshot.sceneObjects) {
      seen.add(obj.id);
      const sprite = this.tokens.get(obj.id) ?? this.createToken(obj.id);
      const { x, y } = this.worldToCellCenter(obj);
      sprite.position.set(x, y);
    }

    for (const [id, sprite] of this.tokens) {
      if (!seen.has(id)) {
        this.tokens.delete(id);
        sprite.destroy();
      }
    }

    this.lastVersion = snapshot.snapshotVersion;
    this.emitter.emit('sceneUpdated', {
      snapshotVersion: snapshot.snapshotVersion,
      tokenCount: this.tokens.size,
    });
  }

  on<K extends keyof SceneRendererEvents>(
    event: K,
    listener: (payload: SceneRendererEvents[K]) => void,
  ): () => void {
    return this.emitter.on(event, listener);
  }

  off<K extends keyof SceneRendererEvents>(
    event: K,
    listener: (payload: SceneRendererEvents[K]) => void,
  ): void {
    this.emitter.off(event, listener);
  }

  /** Version of the last applied snapshot, or `null` before the first one. */
  get snapshotVersion(): number | null {
    return this.lastVersion;
  }

  /** Current camera zoom (1 = one world unit per CSS pixel). */
  get zoom(): number {
    return this.viewport.scale.x;
  }

  /** Escape hatch for debugging and tests. Do not build features on it. */
  get pixi(): { app: Application; viewport: Viewport; gridTexture: Texture } {
    return { app: this.app, viewport: this.viewport, gridTexture: this.gridTexture };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.app.renderer.off('resize', this.handleResize, this);
    this.emitter.clear();
    this.tokens.clear();
    this.viewport.destroy({ children: true });
    this.gridTexture.destroy(true);
    this.app.destroy(true, { children: true });
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /**
   * A-004-4: integer world coordinates → owning cell → cell centre.
   * The grid is purely visual; the model never stores cell indices (FR-011).
   */
  private worldToCellCenter(obj: SceneObject): { x: number; y: number } {
    const { cellSize, columns, rows } = this.opts;
    const col = clamp(Math.floor(obj.x / cellSize), 0, columns - 1);
    const row = clamp(Math.floor(obj.y / cellSize), 0, rows - 1);
    return {
      x: col * cellSize + cellSize / 2,
      y: row * cellSize + cellSize / 2,
    };
  }

  private createToken(id: number): Sprite {
    const sprite = new Sprite(this.opts.tokenTexture);
    sprite.anchor.set(0.5);
    const size = this.opts.cellSize * this.opts.tokenScale;
    sprite.width = size;
    sprite.height = size;
    sprite.eventMode = 'static';
    sprite.cursor = 'pointer';
    sprite.on('pointertap', () => this.emitter.emit('tokenTapped', { id }));
    this.tokenLayer.addChild(sprite);
    this.tokens.set(id, sprite);
    return sprite;
  }

  private handleResize(width: number, height: number): void {
    this.viewport.resize(width, height, this.worldWidth, this.worldHeight);
    this.applyZoomClamp();
  }

  /** Never allow zooming out further than "the whole field is visible". */
  private applyZoomClamp(): void {
    const { width, height } = this.app.screen;
    const minScale = Math.min(width / this.worldWidth, height / this.worldHeight);
    this.viewport.clampZoom({ minScale, maxScale: this.opts.maxZoom });
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
