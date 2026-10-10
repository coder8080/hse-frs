// Превью мира для разработки: scene-preview.html, орбитальная камера.
// ?view=overview|confluence|kazan|kama|elabuga — заготовленные ракурсы (для скриншотов).
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { project } from '../geo';
import { loadWorldData } from './data';
import { createRenderer } from './renderer';
import { buildWorld } from './world';

const VIEWS: Record<string, { at: [number, number]; dist: number; az: number; el: number }> = {
  overview: { at: [55.2, 50.75], dist: 470, az: 0, el: 50 },
  confluence: { at: [55.15, 49.4], dist: 150, az: -25, el: 38 },
  kazan: { at: [55.78, 49.12], dist: 70, az: 20, el: 32 },
  kama: { at: [55.75, 52.2], dist: 140, az: 160, el: 35 },
  elabuga: { at: [55.75, 52.05], dist: 45, az: -40, el: 28 },
};

async function main(): Promise<void> {
  const container = document.getElementById('view')!;
  const r = createRenderer(container);
  const t0 = performance.now();
  const data = await loadWorldData();
  const world = buildWorld(data);
  console.info(`мир: ${world.stats.triangles} треугольников, ${world.stats.meshes} мешей, ${(performance.now() - t0).toFixed(0)} мс`);
  r.scene.add(world.group);

  const params = new URLSearchParams(location.search);
  const v = VIEWS[params.get('view') ?? 'overview'] ?? VIEWS.overview;
  const c = project(v.at[0], v.at[1]);
  const ty = world.heightAt(c.x, c.z);
  const az = (v.az * Math.PI) / 180;
  const el = (v.el * Math.PI) / 180;
  r.camera.position.set(
    c.x + Math.sin(az) * Math.cos(el) * v.dist,
    ty + Math.sin(el) * v.dist,
    c.z + Math.cos(az) * Math.cos(el) * v.dist,
  );
  const controls = new OrbitControls(r.camera, r.renderer.domElement);
  controls.target.set(c.x, ty, c.z);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.update();

  r.onFrame((_dt, t) => {
    controls.update();
    world.update(t);
  });
  r.start();
  // для отладки из консоли и e2e
  (window as unknown as { __scene: unknown }).__scene = { renderer: r, world };
  requestAnimationFrame(() => requestAnimationFrame(() => {
    (window as unknown as { __previewReady: boolean }).__previewReady = true;
  }));
}

main().catch((e) => {
  console.error(e);
  document.body.textContent = String(e);
});
