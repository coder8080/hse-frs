// 3D-приложение: сцена + миниатюры + режим «Доклад» или «Путешествие».
import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import type { RouteData } from '../content-types';
import type { DeviceInfo } from '../device';
import { watchDevice } from '../device';
import { MINIATURE_SCALE, project, unproject } from '../geo';
import { buildMiniature, type Miniature } from '../models';
import { loadWorldData } from '../scene/data';
import { createRenderer } from '../scene/renderer';
import { buildWorld, riverPolyline } from '../scene/world';
import { MapAttribution } from '../ui';
import { DATA_ATTRIBUTION_SHORT } from './attribution';
import { CameraRig } from './camera';
import { buildFlight, overview, viewpoint, type Viewpoint } from './flight';
import type { Mode } from './mode';
import type { Stage } from './stage';
import { startTalk } from './talk';
import { startTour } from './tour';
import './app.css';

const ARRIVAL_HOLD_MS = 1000;

export interface AppOptions {
  mode: Mode;
  device: DeviceInfo;
  debug: boolean;
}

export async function startApp(root: HTMLElement, route: RouteData, opts: AppOptions): Promise<void> {
  const loading = document.createElement('div');
  loading.className = 'app-loading';
  loading.textContent = 'Загрузка карты…';
  document.body.append(loading);

  const data = await loadWorldData();
  const world = buildWorld(data);
  const view = createRenderer(root, { lowQuality: opts.device.phone });
  const { scene, camera } = view;
  scene.add(world.group);
  camera.near = 0.1;
  camera.far = 4000;
  camera.updateProjectionMatrix();
  // туман отодвигается для дальнего обзора на узких экранах
  const fitFog = () => {
    if (scene.fog instanceof THREE.Fog) scene.fog.far = window.innerWidth < window.innerHeight ? 3200 : 1400;
  };
  fitFog();
  window.addEventListener('resize', fitFog);

  // миниатюры на рельефе; близкие (кремль и слобода в 2 км) раздвигаются, чтобы не наезжали
  const scales = route.stops.map((s) => MINIATURE_SCALE * (s.kind === 'key' ? 1 : 0.8));
  const places = spread(
    route.stops.map((s) => project(s.lat, s.lon)),
    scales.map((k, i) => (route.stops[i].kind === 'intro' ? 0 : k * 4.8)),
  );
  const minis: Miniature[] = [];
  const pickables: THREE.Object3D[] = [];
  route.stops.forEach((s, i) => {
    if (s.kind === 'intro') return;
    const m = buildMiniature(s.slug);
    const p = places[i];
    const scale = scales[i];
    m.group.scale.setScalar(scale);
    m.group.position.set(p.x, world.heightAt(p.x, p.z), p.z);
    m.group.userData.stopIndex = i;
    m.group.traverse((o) => (o.userData.stopIndex = i));
    scene.add(m.group);
    minis.push(m);
    pickables.push(m.group);
  });

  const heightAt = world.heightAt;
  const rivers = new Map<string, { x: number; z: number }[] | undefined>();
  const river = (id: string) => {
    if (!rivers.has(id)) rivers.set(id, riverPolyline(data, id));
    return rivers.get(id);
  };
  const views: Viewpoint[] = route.stops.map((s, i) => {
    if (s.kind === 'intro') return overviewNow();
    const ll = unproject(places[i].x, places[i].z);
    return viewpoint(ll.lat, ll.lon, s.kind, heightAt);
  });

  function overviewNow(): Viewpoint {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    // в «Путешествии» на десктопе слева панель остановок — карта сдвигается вправо
    const shift = opts.mode === 'tour' && window.innerWidth > 760 ? 180 / window.innerWidth : 0;
    return overview(aspect, shift);
  }
  window.addEventListener('resize', () => {
    route.stops.forEach((s, i) => {
      if (s.kind === 'intro') views[i] = overviewNow();
    });
  });

  const rig = new CameraRig(camera);
  const controls = new MapControls(camera, view.renderer.domElement);
  controls.enabled = false;
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.42;
  controls.minDistance = 4;
  controls.maxDistance = 2500;
  controls.screenSpacePanning = false;

  // подписи остановок (только «Путешествие»)
  const labels = document.createElement('div');
  labels.className = 'app-labels';
  labels.hidden = true;
  const labelEls = route.stops.map((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'app-label';
    b.innerHTML = `<b>${i}</b><span></span>`;
    b.querySelector('span')!.textContent = s.title;
    b.addEventListener('click', () => pickCb?.(i));
    labels.append(b);
    return b;
  });
  document.body.append(labels);
  const labelPos = route.stops.map((_, i) => {
    const p = places[i];
    return new THREE.Vector3(p.x, heightAt(p.x, p.z) + scales[i] * 10.5, p.z);
  });
  labelEls[0].hidden = true; // «Татарстан в цифрах» — вся карта, без точки

  let pickCb: ((i: number) => void) | null = null;
  let freeCamera = false;
  let flying = false;
  let pendingDone: (() => void) | null = null;
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let finishNow: (() => void) | null = null;
  let skipHold = false;

  const stage: Stage = {
    canvas: view.renderer.domElement,
    stops: route.stops,
    get flying() {
      return flying;
    },
    flyTo(from, to, o) {
      controls.enabled = false;
      const a = views[from];
      const b = views[to];
      // переход описан у остановки, к которой летим «вперёд»; «назад» — та же дорога или быстрая дуга
      const forward = to > from;
      const tr = route.stops[Math.max(from, to)].transition;
      const transition = o.fast || tr.type === 'start' || (!forward && tr.type === 'final') ? { type: 'arc' as const } : tr;
      const f = buildFlight(a, b, transition, heightAt, river);
      flying = true;
      skipHold = false;
      pendingDone = o.onDone;
      view.setPaused(false);
      const done = () => {
        clearTimeout(holdTimer);
        flying = false;
        const cb = pendingDone;
        pendingDone = null;
        syncControls(b);
        cb?.();
      };
      rig.fly(f, {
        fast: o.fast,
        // прибытие к ключевой: миниатюру видно ~1 с, потом открывается слайдшоу
        onDone: () => {
          if (o.fast || skipHold || route.stops[to].kind !== 'key') done();
          else holdTimer = setTimeout(done, ARRIVAL_HOLD_MS);
        },
      });
      finishNow = done;
    },
    finishFlight() {
      skipHold = true;
      if (rig.flying) rig.finish();
      else if (flying) finishNow?.();
    },
    jumpTo(i) {
      clearTimeout(holdTimer);
      flying = false;
      pendingDone = null;
      rig.jump(views[i]);
      syncControls(views[i]);
    },
    setPaused(p) {
      view.setPaused(p);
    },
    setFreeCamera(on) {
      freeCamera = on;
      controls.enabled = on && !flying;
      rig.idleEnabled = !on;
    },
    onPick(cb) {
      pickCb = cb;
    },
    setLabels(visible, active) {
      labels.hidden = !visible;
      labelEls.forEach((el, i) => el.classList.toggle('is-active', i === active));
    },
  };

  function syncControls(v: Viewpoint) {
    controls.target.copy(v.target);
    controls.update();
    controls.enabled = freeCamera;
  }

  // клик по миниатюре
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt: { x: number; y: number } | null = null;
  stage.canvas.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY }));
  stage.canvas.addEventListener('pointerup', (e) => {
    if (!pickCb || !downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
    const r = stage.canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, true)[0];
    if (hit && typeof hit.object.userData.stopIndex === 'number') pickCb(hit.object.userData.stopIndex);
  });

  // подписи: ключевые важнее; подпись, наезжающая на уже поставленную, сворачивается в номер
  const v = new THREE.Vector3();
  const order = route.stops.map((_, i) => i).filter((i) => i > 0).sort((a, b) => Number(route.stops[b].kind === 'key') - Number(route.stops[a].kind === 'key'));
  const widths: number[] = [];
  function placeLabels() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    for (const i of order) {
      v.copy(labelPos[i]).project(camera);
      const el = labelEls[i];
      const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      el.style.visibility = visible ? 'visible' : 'hidden';
      if (!visible) continue;
      const x = ((v.x + 1) / 2) * w;
      const y = ((1 - v.y) / 2) * h;
      widths[i] ??= el.offsetWidth;
      const box = { x0: x - widths[i] / 2, x1: x + widths[i] / 2, y0: y - 26, y1: y };
      const hit = placed.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0);
      el.classList.toggle('is-compact', hit && !el.classList.contains('is-active'));
      placed.push(hit ? { x0: x - 13, x1: x + 13, y0: y - 26, y1: y } : box);
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    }
  }
  let t = 0;
  view.onFrame((dt) => {
    t += dt;
    if (controls.enabled) controls.update();
    else rig.update(dt);
    for (const m of minis) m.update?.(t);
    if (!labels.hidden) placeLabels();
  });

  new MapAttribution(DATA_ATTRIBUTION_SHORT, { corner: 'bottom-right' }).show();

  const handle = opts.mode === 'talk' ? startTalk(route, stage) : (startTour(route, stage, { phone: opts.device.phone }), null);
  // телефон ↔ десктоп при повороте/изменении окна (R8): качество рендера
  watchDevice((d) => view.setLowQuality?.(d.phone));

  view.start();
  loading.remove();
  document.body.dataset.ready = '1';
  // для e2e: состояние доклада и сцены
  (window as unknown as { __app: unknown }).__app = {
    talk: handle,
    stage,
    stats: () => ({ ...world.stats, calls: view.renderer.info.render.calls, triangles: view.renderer.info.render.triangles, frame: view.renderer.info.render.frame }),
    renderer: view.renderer,
  };
}

/** Раздвигает круги радиусов r, чтобы не пересекались (несколько итераций попарного отталкивания). */
export function spread(points: { x: number; z: number }[], r: number[], gap = 1.2): { x: number; z: number }[] {
  const p = points.map((q) => ({ ...q }));
  for (let it = 0; it < 60; it++) {
    let moved = false;
    for (let i = 0; i < p.length; i++) {
      for (let j = i + 1; j < p.length; j++) {
        if (!r[i] || !r[j]) continue;
        const dx = p[j].x - p[i].x;
        const dz = p[j].z - p[i].z;
        const d = Math.hypot(dx, dz) || 1e-3;
        const need = r[i] + r[j] + gap;
        if (d >= need) continue;
        const push = (need - d) / 2;
        p[i].x -= (dx / d) * push;
        p[i].z -= (dz / d) * push;
        p[j].x += (dx / d) * push;
        p[j].z += (dz / d) * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return p;
}
