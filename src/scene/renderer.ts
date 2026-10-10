// Рендерер и цикл кадров (R4): потеря/восстановление WebGL-контекста, смена экрана и DPR,
// пауза в скрытой вкладке и по запросу (слайдшоу). ?debug — оверлей с fps, вызовами и треугольниками.
import * as THREE from 'three';
import { PALETTE, SUN_DIR } from '../palette';

export interface RendererOptions {
  /** Телефон/слабое железо: devicePixelRatio 1. */
  lowQuality?: boolean;
  /** Оверлей отладки; по умолчанию — если в URL есть ?debug. */
  debug?: boolean;
}

/** dt и время с запуска, секунды. */
export type FrameCallback = (dt: number, time: number) => void;

export interface SceneRenderer {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Запустить цикл (идёт, пока не stop, не пауза, вкладка видна и контекст жив). */
  start(): void;
  stop(): void;
  /** Пауза рендера (например, пока открыто слайдшоу). */
  setPaused(paused: boolean): void;
  /** Подписка на кадр; возвращает отписку. Колбэки вызываются перед рендером. */
  onFrame(cb: FrameCallback): () => void;
  /** Переключить качество на лету (DPR 1 ↔ min(dpr, 1.5)). */
  setLowQuality(low: boolean): void;
  /** Отрисовать один кадр вне цикла (например, после смены камеры на паузе). */
  renderOnce(): void;
  dispose(): void;
}

export function createRenderer(container: HTMLElement, opts: RendererOptions = {}): SceneRenderer {
  let lowQuality = !!opts.lowQuality;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false; // тени запечены (R15)
  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.touchAction = 'none';
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 500, 1400);

  // свет только для Lambert-миниатюр; рельеф и вода освещены заранее (MeshBasicMaterial)
  const hemi = new THREE.HemisphereLight(PALETTE.sky, PALETTE.plain, 1.9);
  const sun = new THREE.DirectionalLight('#fff6e8', 1.7);
  sun.position.set(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z).multiplyScalar(100);
  scene.add(hemi, sun);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.3, 3000);
  camera.position.set(0, 320, 330);
  camera.lookAt(0, 0, 0);

  // ---------- размер и плотность пикселей ----------
  const targetDpr = () => (lowQuality ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
  const resize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(targetDpr());
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!loopActive()) renderOnce();
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro?.observe(container);
  window.addEventListener('resize', resize);
  // смена монитора/масштаба: matchMedia срабатывает один раз, поэтому перерегистрируемся
  let mql: MediaQueryList | null = null;
  const onDprChange = () => {
    resize();
    watchDpr();
  };
  const watchDpr = () => {
    mql?.removeEventListener('change', onDprChange);
    mql = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    mql.addEventListener('change', onDprChange);
  };
  watchDpr();

  // ---------- цикл ----------
  let running = false;
  let paused = false;
  let contextLost = false;
  let disposed = false;
  const callbacks = new Set<FrameCallback>();
  let last = -1;
  let elapsed = 0;

  const loopActive = () => running && !paused && !contextLost && !document.hidden && !disposed;

  const debug = opts.debug ?? new URLSearchParams(location.search).has('debug');
  const overlay = debug ? createOverlay(container) : null;
  let fpsFrames = 0;
  let fpsTime = 0;

  const frame = (nowMs: number) => {
    const now = nowMs / 1000;
    const dt = last < 0 ? 0 : Math.min(0.1, now - last);
    last = now;
    elapsed += dt;
    for (const cb of callbacks) cb(dt, elapsed);
    renderer.render(scene, camera);
    if (overlay) {
      fpsFrames++;
      fpsTime += dt;
      if (fpsTime >= 0.5) {
        const info = renderer.info.render;
        overlay.textContent = `${(fpsFrames / fpsTime).toFixed(0)} fps · ${info.calls} calls · ${info.triangles.toLocaleString('ru')} tris · dpr ${renderer.getPixelRatio()}`;
        fpsFrames = 0;
        fpsTime = 0;
      }
    }
  };

  const sync = () => {
    if (loopActive()) {
      last = -1; // после паузы не прыгаем во времени
      renderer.setAnimationLoop(frame);
    } else {
      renderer.setAnimationLoop(null);
    }
  };

  function renderOnce() {
    if (contextLost || disposed) return;
    renderer.render(scene, camera);
  }

  const onVisibility = () => sync();
  document.addEventListener('visibilitychange', onVisibility);
  const onLost = (e: Event) => {
    e.preventDefault(); // без этого контекст не восстановится
    contextLost = true;
    sync();
  };
  const onRestored = () => {
    // three.js сам перезаливает геометрию и текстуры; состояние приложения не трогаем
    contextLost = false;
    resize();
    sync();
  };
  canvas.addEventListener('webglcontextlost', onLost, false);
  canvas.addEventListener('webglcontextrestored', onRestored, false);

  resize();

  return {
    renderer,
    scene,
    camera,
    start() {
      running = true;
      sync();
    },
    stop() {
      running = false;
      sync();
    },
    setPaused(p: boolean) {
      paused = p;
      sync();
    },
    onFrame(cb: FrameCallback) {
      callbacks.add(cb);
      return () => callbacks.delete(cb);
    },
    setLowQuality(low: boolean) {
      lowQuality = low;
      resize();
    },
    renderOnce,
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      ro?.disconnect();
      window.removeEventListener('resize', resize);
      mql?.removeEventListener('change', onDprChange);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      callbacks.clear();
      overlay?.remove();
      renderer.dispose();
      canvas.remove();
    },
  };
}

function createOverlay(container: HTMLElement): HTMLElement {
  const el = document.createElement('div');
  el.className = 'debug-overlay';
  el.style.cssText =
    'position:absolute;left:8px;top:8px;z-index:50;padding:4px 8px;border-radius:4px;' +
    'background:rgba(20,24,28,.72);color:#e8f0f2;font:12px/1.4 ui-monospace,monospace;pointer-events:none';
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  container.appendChild(el);
  return el;
}
