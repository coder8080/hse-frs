// Рельеф: гладкая сетка ~460×330 ячеек с «прорезями» под водохранилищами и реками.
// Цвет — текстура земли (покров + запечённый свет, ground.ts); бока подставки — отдельным мешем.
// Чистая геометрия: работает в Node без WebGL (тест бюджета).
import * as THREE from 'three';
import { WORLD, elevToY } from '../geo';
import { PALETTE, SUN_DIR } from '../palette';
import type { Dem } from './dem';
import { buildGround, type Ground } from './ground';
import { distToSegment, fillRow, rowCrossings, type P2 } from './polygon';
import type { WorldData } from './types';
import type { RiverLine, WaterBody } from './water';

export interface TerrainInput {
  dem: Dem;
  /** Кольца границы Татарстана в км (x, z). */
  border: P2[][];
  water: readonly WaterBody[];
  rivers: readonly RiverLine[];
  landcover: WorldData['landcover'];
  segX?: number;
  segZ?: number;
}

export interface Terrain {
  mesh: THREE.Mesh;
  /** Бока подставки диорамы. */
  sides: THREE.Mesh;
  /** Текстура и флаги покрова (для деревьев). */
  ground: Ground;
  /** Высота поверхности итогового меша рельефа (ед. мира). */
  heightAt(x: number, z: number): number;
  /** Нижняя грань «подставки» диорамы. */
  baseY: number;
  triangles: number;
}

/** Шаг понижения дна под водохранилищем, м. */
const WATER_STEP_M = 9;
/** Берег держим чуть выше уровня, чтобы край воды не висел над низиной, м. */
const SHORE_LIFT_M = 1.5;
/** Прорезь под речной лентой, м. */
const RIVER_STEP_M = 5;

const lin = (hex: string) => new THREE.Color(hex);

export function buildTerrain(input: TerrainInput): Terrain {
  const { dem } = input;
  const NX = input.segX ?? 464;
  const NZ = input.segZ ?? 328;
  const dx = WORLD.width / NX;
  const dz = WORLD.depth / NZ;
  const VX = NX + 1;
  const VZ = NZ + 1;
  const nv = VX * VZ;
  const vx = (i: number) => WORLD.minX + i * dx;
  const vz = (j: number) => WORLD.minZ + j * dz;

  // 1. высоты: DEM, сглаженный окном в ячейку меша
  const meters = new Float32Array(nv);
  for (let j = 0; j < VZ; j++) {
    for (let i = 0; i < VX; i++) meters[j * VX + i] = dem.mean(vx(i), vz(j), Math.max(dx, dz) * 1.2);
  }
  const y = new Float32Array(nv);
  for (let k = 0; k < nv; k++) y[k] = elevToY(meters[k]);

  // 2. вода: вершины внутри водохранилищ и расстояние до берега (растеризация рёбер)
  const waterLevel = new Float32Array(nv).fill(NaN);
  const shoreDist = new Float32Array(nv).fill(Infinity);
  const shoreLevel = new Float32Array(nv).fill(NaN);
  const cell = Math.max(dx, dz);
  const R = cell * 1.25;
  for (const body of input.water) {
    for (const poly of body.polygons) {
      const b = poly.bounds;
      const j0 = Math.max(0, Math.floor((b.minY - WORLD.minZ) / dz));
      const j1 = Math.min(NZ, Math.ceil((b.maxY - WORLD.minZ) / dz));
      for (let j = j0; j <= j1; j++) {
        fillRow(rowCrossings(poly.rings, vz(j)), WORLD.minX, dx, VX, (i) => (waterLevel[j * VX + i] = body.levelY));
      }
      for (const ring of poly.rings) {
        for (let e = 0; e < ring.length; e++) {
          const [ax, az] = ring[e];
          const [bx, bz] = ring[(e + 1) % ring.length];
          const ei0 = Math.max(0, Math.floor((Math.min(ax, bx) - R - WORLD.minX) / dx));
          const ei1 = Math.min(NX, Math.ceil((Math.max(ax, bx) + R - WORLD.minX) / dx));
          const ej0 = Math.max(0, Math.floor((Math.min(az, bz) - R - WORLD.minZ) / dz));
          const ej1 = Math.min(NZ, Math.ceil((Math.max(az, bz) + R - WORLD.minZ) / dz));
          for (let j = ej0; j <= ej1; j++) {
            for (let i = ei0; i <= ei1; i++) {
              const k = j * VX + i;
              const d = distToSegment(vx(i), vz(j), ax, az, bx, bz);
              if (d < shoreDist[k]) {
                shoreDist[k] = d;
                shoreLevel[k] = body.levelY;
              }
            }
          }
        }
      }
    }
  }
  const step = elevToY(WATER_STEP_M);
  const lift = elevToY(SHORE_LIFT_M);
  // узкие протоки уже ячейки: опускаем и вершины у самого берега снаружи, иначе вода спрячется под рельефом
  const CARVE_OUT = cell * 0.6;
  for (let k = 0; k < nv; k++) {
    if (Number.isNaN(waterLevel[k]) && shoreDist[k] < CARVE_OUT) waterLevel[k] = shoreLevel[k];
    if (!Number.isNaN(waterLevel[k])) y[k] = Math.min(y[k], waterLevel[k] - step);
    else if (shoreDist[k] < R) y[k] = Math.max(y[k], shoreLevel[k] + lift);
  }

  // 3. реки: прорезь под лентой
  const riverMark = new Uint8Array(nv);
  for (const r of input.rivers) {
    const rad = r.width * 0.5 + cell * 0.55;
    for (let e = 1; e < r.pts.length; e++) {
      const [ax, az] = r.pts[e - 1];
      const [bx, bz] = r.pts[e];
      const ei0 = Math.max(0, Math.floor((Math.min(ax, bx) - rad - WORLD.minX) / dx));
      const ei1 = Math.min(NX, Math.ceil((Math.max(ax, bx) + rad - WORLD.minX) / dx));
      const ej0 = Math.max(0, Math.floor((Math.min(az, bz) - rad - WORLD.minZ) / dz));
      const ej1 = Math.min(NZ, Math.ceil((Math.max(az, bz) + rad - WORLD.minZ) / dz));
      for (let j = ej0; j <= ej1; j++) {
        for (let i = ei0; i <= ei1; i++) {
          if (distToSegment(vx(i), vz(j), ax, az, bx, bz) < rad) riverMark[j * VX + i] = 1;
        }
      }
    }
  }
  const rstep = elevToY(RIVER_STEP_M);
  for (let k = 0; k < nv; k++) if (riverMark[k] && Number.isNaN(waterLevel[k])) y[k] -= rstep;

  // 4. затенение впадин (простое AO): насколько вершина ниже среднего по окрестности
  const ao = new Float32Array(nv);
  const AR = 5;
  for (let j = 0; j < VZ; j++) {
    for (let i = 0; i < VX; i++) {
      let s = 0;
      let n = 0;
      for (let b = -AR; b <= AR; b++) {
        const jj = j + b;
        if (jj < 0 || jj >= VZ) continue;
        for (let a = -AR; a <= AR; a++) {
          const ii = i + a;
          if (ii < 0 || ii >= VX) continue;
          s += y[jj * VX + ii];
          n++;
        }
      }
      const c = y[j * VX + i] - s / n; // < 0 во впадине
      ao[j * VX + i] = Math.min(1.06, Math.max(0.78, 1 + c * 0.35));
    }
  }

  // 5. гладкая сетка с UV; цвет и свет — в текстуре земли (ground.ts)
  const ground = buildGround({
    dem,
    landcover: input.landcover,
    border: input.border,
    water: input.water,
    rivers: input.rivers,
    occlusion: { grid: ao, nx: NX, nz: NZ },
  });

  let minY = Infinity;
  for (let k = 0; k < nv; k++) if (y[k] < minY) minY = y[k];
  const baseY = minY - 1.4;
  const pos = new Float32Array(nv * 3);
  const uv = new Float32Array(nv * 2);
  for (let j = 0; j < VZ; j++) {
    for (let i = 0; i < VX; i++) {
      const k = j * VX + i;
      pos[k * 3] = vx(i);
      pos[k * 3 + 1] = y[k];
      pos[k * 3 + 2] = vz(j);
      uv[k * 2] = i / NX;
      uv[k * 2 + 1] = j / NZ; // строка 0 текстуры — северный край (minZ)
    }
  }
  const index = new Uint32Array(NX * NZ * 6);
  let t = 0;
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const a = j * VX + i;
      const b = a + 1;
      const c = a + VX;
      const d = c + 1;
      // диагонали чередуются — как в heightAt
      if ((i + j) % 2 === 0) index.set([a, c, d, a, d, b], t);
      else index.set([a, c, b, b, c, d], t);
      t += 6;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: ground.texture }));
  mesh.name = 'terrain';

  // 6. бока подставки: земля в разрезе, затенение по стороне света
  const sun = new THREE.Vector3(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z).normalize();
  const sideTris = 2 * (NX + NZ) * 2;
  const spos = new Float32Array(sideTris * 9);
  const scol = new Float32Array(sideTris * 9);
  let st = 0;
  const cTmp = new THREE.Color();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const soilTop = lin(PALETTE.ridge).multiplyScalar(0.82);
  const soilBottom = lin(PALETTE.wood).multiplyScalar(0.7);
  const wall = (x0: number, z0: number, y0: number, x1: number, z1: number, y1: number, nx: number, nz: number) => {
    const lambert = Math.max(0, nx * sun.x + nz * sun.z);
    const shade = 0.62 + 0.45 * lambert;
    const top = cTmp.copy(soilTop).multiplyScalar(shade);
    const tr = top.r, tg = top.g, tb = top.b;
    const bot = cTmp.copy(soilBottom).multiplyScalar(shade);
    const quad = [
      [x0, y0, z0, 1], [x0, baseY, z0, 0], [x1, y1, z1, 1],
      [x1, y1, z1, 1], [x0, baseY, z0, 0], [x1, baseY, z1, 0],
    ];
    for (let q = 0; q < 2; q++) {
      const o = st * 9;
      for (let v = 0; v < 3; v++) {
        const p = quad[q * 3 + v];
        spos[o + v * 3] = p[0]; spos[o + v * 3 + 1] = p[1]; spos[o + v * 3 + 2] = p[2];
        const isTop = p[3] === 1;
        scol[o + v * 3] = isTop ? tr : bot.r;
        scol[o + v * 3 + 1] = isTop ? tg : bot.g;
        scol[o + v * 3 + 2] = isTop ? tb : bot.b;
      }
      // разворот, если грань смотрит внутрь
      e1.set(spos[o + 3] - spos[o], spos[o + 4] - spos[o + 1], spos[o + 5] - spos[o + 2]);
      e2.set(spos[o + 6] - spos[o], spos[o + 7] - spos[o + 1], spos[o + 8] - spos[o + 2]);
      nrm.crossVectors(e1, e2);
      if (nrm.x * nx + nrm.z * nz < 0) {
        for (let k = 0; k < 3; k++) {
          const p1 = spos[o + 3 + k]; spos[o + 3 + k] = spos[o + 6 + k]; spos[o + 6 + k] = p1;
          const c1 = scol[o + 3 + k]; scol[o + 3 + k] = scol[o + 6 + k]; scol[o + 6 + k] = c1;
        }
      }
      st++;
    }
  };
  for (let i = 0; i < NX; i++) {
    wall(vx(i), vz(0), y[i], vx(i + 1), vz(0), y[i + 1], 0, -1);
    const s0 = NZ * VX + i;
    wall(vx(i), vz(NZ), y[s0], vx(i + 1), vz(NZ), y[s0 + 1], 0, 1);
  }
  for (let j = 0; j < NZ; j++) {
    wall(vx(0), vz(j), y[j * VX], vx(0), vz(j + 1), y[(j + 1) * VX], -1, 0);
    wall(vx(NX), vz(j), y[j * VX + NX], vx(NX), vz(j + 1), y[(j + 1) * VX + NX], 1, 0);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  sg.setAttribute('color', new THREE.BufferAttribute(scol, 3));
  sg.computeBoundingSphere();
  const sides = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true }));
  sides.name = 'terrain-sides';
  const triangles = NX * NZ * 2 + sideTris;

  const heightAt = (x: number, z: number): number => {
    const fx = Math.min(NX, Math.max(0, (x - WORLD.minX) / dx));
    const fz = Math.min(NZ, Math.max(0, (z - WORLD.minZ) / dz));
    const i = Math.min(NX - 1, Math.floor(fx));
    const j = Math.min(NZ - 1, Math.floor(fz));
    const u = fx - i;
    const v = fz - j;
    const a = j * VX + i;
    const ha = y[a];
    const hb = y[a + 1];
    const hc = y[a + VX];
    const hd = y[a + VX + 1];
    if ((i + j) % 2 === 0) {
      // диагональ a–d
      return u >= v ? ha + u * (hb - ha) + v * (hd - hb) : ha + v * (hc - ha) + u * (hd - hc);
    }
    // диагональ b–c
    return u + v <= 1 ? ha + u * (hb - ha) + v * (hc - ha) : hd + (1 - u) * (hc - hd) + (1 - v) * (hb - hd);
  };

  return { mesh, sides, ground, heightAt, baseY, triangles };
}
