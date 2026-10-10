// Вода (R16): водохранилища — плоские меши на своём уровне (медиана DEM внутри полигона),
// реки — ленты вдоль осевых линий на высоте рельефа с небольшим отступом.
import * as THREE from 'three';
import earcut from 'earcut';
import { elevToY, project } from '../geo';
import { PALETTE } from '../palette';
import type { Dem } from './dem';
import { fillRow, pointInPolygon, ringsBounds, rowCrossings, type P2 } from './polygon';
import type { River, WaterData } from './types';

export interface WaterPolygon {
  rings: P2[][];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface WaterBody {
  id: string;
  name: string;
  /** Уровень воды, м (медиана DEM внутри полигонов). */
  levelM: number;
  /** Уровень в единицах мира. */
  levelY: number;
  polygons: WaterPolygon[];
}

const toKm = (ring: [number, number][]): P2[] =>
  ring.map(([lat, lon]) => {
    const p = project(lat, lon);
    return [p.x, p.z];
  });

/** Полигоны водохранилищ в км и их уровни по DEM. */
export function prepareWater(data: WaterData, dem: Dem): WaterBody[] {
  return data.reservoirs.map((r) => {
    const polygons: WaterPolygon[] = r.polygons.map((p) => {
      const rings = p.map(toKm);
      return { rings, bounds: ringsBounds(rings) };
    });
    // медиана узлов DEM внутри полигонов (заливка строк)
    const samples: number[] = [];
    const x0 = dem.nodeXZ(0, 0).x;
    const ddx = dem.nodeXZ(1, 0).x - x0;
    for (const poly of polygons) {
      const b = poly.bounds;
      for (let row = 0; row < dem.h; row++) {
        const z = dem.nodeXZ(0, row).z;
        if (z < b.minY || z > b.maxY) continue;
        fillRow(rowCrossings(poly.rings, z), x0, ddx, dem.w, (c) => samples.push(dem.node(c, row)));
      }
    }
    samples.sort((a, b) => a - b);
    const levelM = samples.length ? samples[samples.length >> 1] : 50;
    return { id: r.id, name: r.name, levelM, levelY: elevToY(levelM), polygons };
  });
}

/** Уровень воды (ед. мира) в точке или null, если точка не на водохранилище. */
export function waterLevelAt(bodies: readonly WaterBody[], x: number, z: number): number | null {
  for (const b of bodies) {
    for (const p of b.polygons) {
      const bb = p.bounds;
      if (x < bb.minX || x > bb.maxX || z < bb.minY || z > bb.maxY) continue;
      if (pointInPolygon(x, z, p.rings)) return b.levelY;
    }
  }
  return null;
}

// ---------- материал с лёгкой рябью ----------

/** Общий uniform времени для всей воды: обновляется одной записью в кадр. */
export const waterTime = { value: 0 };

/**
 * MeshBasicMaterial с дешёвой рябью: яркость слегка колеблется по синусам от мировых x/z и времени.
 * Освещение не нужно — вода матовая и плоская, как в настольной диораме.
 */
export function createWaterMaterial(color: string, opts: { polygonOffset?: number } = {}): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color });
  if (opts.polygonOffset) {
    m.polygonOffset = true;
    m.polygonOffsetFactor = -opts.polygonOffset;
    m.polygonOffsetUnits = -opts.polygonOffset;
  }
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWaterXZ;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWaterXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec2 vWaterXZ;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float wv = sin(vWaterXZ.x * 0.9 + uTime * 0.8) * sin(vWaterXZ.y * 0.7 - uTime * 0.6)
                 + 0.5 * sin((vWaterXZ.x + vWaterXZ.y) * 2.3 + uTime * 1.3);
        diffuseColor.rgb *= 1.0 + 0.035 * wv;`,
      );
  };
  m.customProgramCacheKey = () => `water-shimmer-${opts.polygonOffset ?? 0}`;
  return m;
}

// ---------- водохранилища ----------

export function buildReservoirs(bodies: readonly WaterBody[]): THREE.Mesh {
  const pos: number[] = [];
  for (const b of bodies) {
    for (const p of b.polygons) {
      const flat: number[] = [];
      const holes: number[] = [];
      p.rings.forEach((r, k) => {
        if (k > 0) holes.push(flat.length / 2);
        for (const [x, z] of r) flat.push(x, z);
      });
      const tri = earcut(flat, holes);
      for (let i = 0; i < tri.length; i += 3) {
        const a = tri[i] * 2;
        let bb = tri[i + 1] * 2;
        let c = tri[i + 2] * 2;
        // порядок (a, c, b) должен смотреть вверх: y-компонента (c - a) × (b - a) > 0
        const up = (flat[c + 1] - flat[a + 1]) * (flat[bb] - flat[a]) - (flat[c] - flat[a]) * (flat[bb + 1] - flat[a + 1]);
        if (up < 0) [bb, c] = [c, bb];
        pos.push(flat[a], b.levelY, flat[a + 1], flat[c], b.levelY, flat[c + 1], flat[bb], b.levelY, flat[bb + 1]);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, createWaterMaterial(PALETTE.water));
  mesh.name = 'reservoirs';
  return mesh;
}

// ---------- ленты ----------

export interface RibbonOptions {
  width: number;
  /** Отступ над поверхностью, ед. мира. */
  lift: number;
  /** Сузить ленту у истока (реки «растут» по течению). */
  taper?: boolean;
  closed?: boolean;
  /** Точки, где ленту рисовать не надо (например, внутри водохранилища). */
  skip?: (x: number, z: number) => boolean;
  /** Шаг уплотнения, км. */
  step?: number;
}

/** Уплотняет полилинию до шага ≤ step. */
export function densify(pts: readonly P2[], step: number, closed = false): P2[] {
  const src = closed ? [...pts, pts[0]] : pts;
  const out: P2[] = [src[0]];
  for (let i = 1; i < src.length; i++) {
    const [ax, az] = src[i - 1];
    const [bx, bz] = src[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  if (closed) out.pop();
  return out;
}

/**
 * Лента вдоль полилинии (дописывает в общие массивы, чтобы все реки были одним мешем).
 * Высота точки — максимум поверхности под центром и краями плюс lift.
 */
export function appendRibbon(
  line: readonly P2[],
  surface: (x: number, z: number) => number,
  o: RibbonOptions,
  pos: number[],
  idx: number[],
): void {
  const pts = densify(line, o.step ?? 1.5, o.closed);
  if (o.closed) pts.push(pts[0]);
  const n = pts.length;
  if (n < 2) return;
  const cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[n - 1] || 1;
  const keep = pts.map((p) => !o.skip?.(p[0], p[1]));
  const vert = new Int32Array(n).fill(-1);
  const emit = (i: number): number => {
    if (vert[i] >= 0) return vert[i];
    const p = pts[i];
    // касательная: по соседям (у замкнутой линии — через стык)
    const prev = i > 0 ? pts[i - 1] : o.closed ? pts[n - 2] : p;
    const next = i < n - 1 ? pts[i + 1] : o.closed ? pts[1] : p;
    let tx = next[0] - prev[0];
    let tz = next[1] - prev[1];
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    const w = o.width * (o.taper ? 0.45 + 0.55 * (cum[i] / total) : 1) * 0.5;
    const ax = p[0] - tz * w;
    const az = p[1] + tx * w;
    const bx = p[0] + tz * w;
    const bz = p[1] - tx * w;
    const y = Math.max(surface(p[0], p[1]), surface(ax, az), surface(bx, bz)) + o.lift;
    vert[i] = pos.length / 3;
    pos.push(ax, y, az, bx, y, bz);
    return vert[i];
  };
  for (let i = 1; i < n; i++) {
    if (!keep[i - 1] && !keep[i]) continue;
    const a = emit(i - 1);
    const b = emit(i);
    // (a0, a1, b0) и (a1, b1, b0) смотрят вверх
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
}

export interface RiverLine {
  id: string;
  width: number;
  pts: P2[];
}

export function riverLines(rivers: Record<string, River>): RiverLine[] {
  return Object.values(rivers).map((r) => ({ id: r.id, width: r.width_km ?? 0.4, pts: toKm(r.points) }));
}

export function buildRivers(
  lines: readonly RiverLine[],
  surface: (x: number, z: number) => number,
  bodies: readonly WaterBody[],
): THREE.Mesh {
  const pos: number[] = [];
  const idx: number[] = [];
  for (const r of lines) {
    const big = r.id === 'volga' || r.id === 'kama';
    appendRibbon(r.pts, surface, {
      width: r.width,
      lift: 0.035,
      taper: !big,
      // там, где видна вода водохранилища (рельеф под ней опущен), лента не нужна;
      // в узких протоках, где рельеф выше уровня, лента подменяет воду
      skip: (x, z) => {
        const w = waterLevelAt(bodies, x, z);
        return w !== null && surface(x, z) < w - 0.01;
      },
    }, pos, idx);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, createWaterMaterial(PALETTE.river, { polygonOffset: 2 }));
  mesh.name = 'rivers';
  return mesh;
}
