// Пути полёта камеры между остановками (route.json → кривые над рельефом).
// Чистая геометрия: тестируется в Node, сцена только сэмплирует кривые.
import * as THREE from 'three';
import type { Transition } from '../../content/schema';
import { project, WORLD, type XZ } from '../geo';

export type HeightFn = (x: number, z: number) => number;
export type RiverFn = (id: string) => XZ[] | undefined;

/** Где висит камера у остановки и куда смотрит. */
export interface Viewpoint {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

/** Высота полёта над рельефом, км. */
const CRUISE = 9;
/** Ракурс у остановки: откуда смотрим на миниатюру (смещение к югу и вверх). */
const VIEW_KEY = { back: 7.5, up: 6 };
const VIEW_FLY = { back: 13, up: 10 };

export function stopTarget(lat: number, lon: number, heightAt: HeightFn): THREE.Vector3 {
  const p = project(lat, lon);
  return new THREE.Vector3(p.x, heightAt(p.x, p.z) + 1, p.z);
}

/** Камера у остановки: ключевые ближе (зум в миниатюру), пролётные выше. */
export function viewpoint(lat: number, lon: number, kind: string, heightAt: HeightFn): Viewpoint {
  const target = stopTarget(lat, lon, heightAt);
  const v = kind === 'flythrough' ? VIEW_FLY : VIEW_KEY;
  const position = new THREE.Vector3(target.x, 0, target.z + v.back);
  position.y = Math.max(target.y + v.up, heightAt(position.x, position.z) + 2);
  return { position, target };
}

/**
 * Обзор всей карты (остановка 0 и финальный подъём).
 * aspect — пропорции экрана: на узком (телефон) камера отходит дальше, чтобы карта влезла по ширине;
 * shift — сдвиг карты вправо в долях ширины экрана (под панелью «Путешествия»).
 */
export function overview(aspect = 16 / 9, shift = 0): Viewpoint {
  const k = THREE.MathUtils.clamp(1.6 / aspect, 1, 4.6);
  const cx = (WORLD.minX + WORLD.maxX) / 2 - shift * WORLD.width * k;
  const cz = (WORLD.minZ + WORLD.maxZ) / 2;
  // на узком экране смотрим почти сверху: карта компактнее
  const tilt = aspect < 1 ? 0.35 : 0.78;
  return {
    position: new THREE.Vector3(cx, WORLD.width * 0.62 * k, cz + WORLD.depth * tilt * k),
    target: new THREE.Vector3(cx, 0, cz + WORLD.depth * 0.05),
  };
}

/** Индекс ближайшей точки полилинии. */
function nearestIndex(line: XZ[], p: XZ): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < line.length; i++) {
    const d = (line[i].x - p.x) ** 2 + (line[i].z - p.z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Прореживание: точки не чаще чем раз в step км, чтобы Catmull-Rom не дрожал. */
function thin(points: XZ[], step: number): XZ[] {
  if (points.length < 3) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const last = out[out.length - 1];
    if (Math.hypot(points[i].x - last.x, points[i].z - last.z) >= step) out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Участок реки между двумя точками (в любом направлении течения). */
export function riverSection(line: XZ[], from: XZ, to: XZ): XZ[] {
  const a = nearestIndex(line, from);
  const b = nearestIndex(line, to);
  const part = a <= b ? line.slice(a, b + 1) : line.slice(b, a + 1).reverse();
  return thin(part, 6);
}

export interface Flight {
  /** Кривая положения камеры, параметр 0..1 */
  position: THREE.Curve<THREE.Vector3>;
  /** Кривая точки взгляда */
  target: THREE.Curve<THREE.Vector3>;
  /** Длительность при обычном полёте, с */
  duration: number;
  /** Пауза на вершине (финал), доля 0..1 параметра, где камера замирает */
  hold?: { at: number; seconds: number };
}

/** Безопасная высота над рельефом вдоль отрезка. */
function clearance(x: number, z: number, heightAt: HeightFn, above: number): number {
  return heightAt(x, z) + above;
}

/**
 * Строит полёт от одной точки обзора к другой.
 * river — по осевой линии реки на крейсерской высоте; arc — дуга, высота растёт с длиной;
 * final — подъём на обзор всей карты и пикирование.
 */
export function buildFlight(
  from: Viewpoint,
  to: Viewpoint,
  transition: Transition,
  heightAt: HeightFn,
  river: RiverFn,
): Flight {
  const fromXZ = { x: from.target.x, z: from.target.z };
  const toXZ = { x: to.target.x, z: to.target.z };
  const dist = Math.hypot(toXZ.x - fromXZ.x, toXZ.z - fromXZ.z);
  // 1,5–3 с: длинные переходы быстрее по скорости, но не дольше 3 с (см. «Форма остановки»)
  const duration = THREE.MathUtils.clamp(1.5 + dist / 90, 1.5, 3);

  if (transition.type === 'final') {
    const top = overview();
    const mid = new THREE.Vector3().lerpVectors(from.position, top.position, 0.5);
    mid.y = top.position.y * 0.8;
    const position = new THREE.CatmullRomCurve3([from.position.clone(), mid, top.position.clone(), to.position.clone()], false, 'centripetal');
    const target = new THREE.CatmullRomCurve3([from.target.clone(), top.target.clone(), top.target.clone(), to.target.clone()], false, 'centripetal');
    // короткий взгляд на всю карту (весь пройденный маршрут) и пикирование; ~3,8 с вместе с паузой
    return { position, target, duration: 3.4, hold: { at: 0.55, seconds: 0.4 } };
  }

  let ground: XZ[] = [];
  if (transition.type === 'river') {
    const line = river(transition.river);
    if (line && line.length > 1) ground = riverSection(line, fromXZ, toXZ);
    if (transition.via) ground.push(...transition.via.map(([lat, lon]) => project(lat, lon)));
  }

  const pts: THREE.Vector3[] = [from.position.clone()];
  if (ground.length > 2) {
    // по реке: первая и последняя точки участка совпадают с остановками, их пропускаем
    for (const g of ground.slice(1, -1)) pts.push(new THREE.Vector3(g.x, clearance(g.x, g.z, heightAt, CRUISE), g.z + 4));
  } else {
    // дуга: апекс посередине, выше для длинных переходов
    const h = transition.type === 'arc' && transition.height ? transition.height : THREE.MathUtils.clamp(dist * 0.3, 5, 60);
    const m = new THREE.Vector3().lerpVectors(from.position, to.position, 0.5);
    m.y = Math.max(m.y, clearance(m.x, m.z, heightAt, 3)) + h;
    pts.push(m);
  }
  pts.push(to.position.clone());

  const position = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  // взгляд скользит от одной остановки к другой, слегка опережая камеру по маршруту
  const targetPts = [from.target.clone()];
  if (ground.length > 2) {
    for (const g of ground.slice(2)) targetPts.push(new THREE.Vector3(g.x, heightAt(g.x, g.z), g.z));
    targetPts.pop();
  }
  targetPts.push(to.target.clone());
  const target =
    targetPts.length > 2
      ? new THREE.CatmullRomCurve3(targetPts, false, 'centripetal')
      : new THREE.LineCurve3(targetPts[0], targetPts[1]);
  return { position, target, duration };
}

/** Плавный разгон и торможение. */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
