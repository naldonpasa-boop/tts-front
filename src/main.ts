import { Assets, type Texture } from 'pixi.js';
import { createSceneApi } from './api';
import { ScenePoller } from './app/ScenePoller';
import { config } from './config';
import { SceneRenderer } from './render/SceneRenderer';

/**
 * Composition root. Wires the three independent pieces together:
 *   SceneApi (dummy in the MVP)  →  ScenePoller  →  SceneRenderer
 */
async function bootstrap(): Promise<void> {
  const host = mustGet<HTMLElement>('#scene');
  const status = mustGet<HTMLElement>('#status');

  const setStatus = (text: string, isError = false): void => {
    status.textContent = text;
    status.classList.toggle('error', isError);
  };

  const tokenTexture = await Assets.load<Texture>(config.assets.tokenPlaceholder);

  const renderer = await SceneRenderer.create({
    host,
    cellSize: config.grid.cellSize,
    columns: config.grid.columns,
    rows: config.grid.rows,
    tokenTexture,
    colors: config.colors,
  });

  renderer.on('sceneUpdated', ({ snapshotVersion, tokenCount }) => {
    setStatus(`api: ${config.api.mode} · snapshot v${snapshotVersion} · tokens: ${tokenCount}`);
  });
  renderer.on('tokenTapped', ({ id }) => {
    console.debug('[scene] token tapped', id);
  });

  const api = createSceneApi(config.api.mode, config.api.baseUrl);

  const poller = new ScenePoller(api, {
    intervalMs: config.polling.intervalMs,
    onSnapshot: (snapshot) => renderer.updateScene(snapshot),
    onError: (err) => {
      console.error('[poller]', err);
      setStatus(`api: ${config.api.mode} · error: ${describe(err)}`, true);
    },
  });

  poller.start();
  setStatus(`api: ${config.api.mode} · waiting for first snapshot…`);

  if (import.meta.env.DEV) {
    // Dev-only handle for poking at the scene from the browser console.
    (window as unknown as { __tts?: unknown }).__tts = { renderer, poller, api, config };
  }

  window.addEventListener('beforeunload', () => {
    poller.stop();
    renderer.destroy();
  });
}

function mustGet<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return el;
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

bootstrap().catch((err: unknown) => {
  console.error('[bootstrap]', err);
  const status = document.querySelector('#status');
  if (status) {
    status.textContent = `failed to start: ${describe(err)}`;
    status.classList.add('error');
  }
});
