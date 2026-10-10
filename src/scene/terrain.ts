// Рельеф: сетка ~230×165 ячеек с цветами по высоте, запечённым светом (R15) и «прорезями»
// под водохранилищами и реками. Граненый low-poly: у каждого треугольника свой цвет.
// Чистая геометрия: работает в Node без WebGL (тест бюджета).
import * as THREE from 'three';
import { WORLD, elevToY } from '../geo';
import { PALETTE, SUN_DIR } from '../palette';
import type { Dem } from './dem';
import { distToSegment, fillRow, rowCrossings, type P2 } from './polygon';
import type { RiverLine, WaterBody } from './water';

export interface TerrainInput {
  dem: Dem;
  /** Кольца границы Татарстана в км (x, z). */
  border: P2[][];
  water: readonly WaterBody[];
  rivers: readonly RiverLine[];
  segX?: number;
  segZ?: number;
}

export interface Terrain {
  mesh: THREE.Mesh;
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

// Ступени цвета по высоте (м)
const BANDS: [number, string][] = [
  [60, PALETTE.lowland],
  [130, PALETTE.lowland],
  [180, PALETTE.plain],
  [250, PALETTE.upland],
  [340, PALETTE.ridge],
];

const lin = (hex: string) => new THREE.Color(hex);

function elevColor(m: number, out: THREE.Color): THREE.Color {
  if (m <= BANDS[0][0]) return out.copy(lin(BANDS[0][1]));
  for (let i = 1; i < BANDS.length; i++) {
    if (m <= BANDS[i][0]) {
      const t = (m - BANDS[i - 1][0]) / (BANDS[i][0] - BANDS[i - 1][0]);
      // smoothstep — мягкие, но читаемые переходы
      const s = t * t * (3 - 2 * t);
      return out.copy(lin(BANDS[i - 1][1])).lerp(lin(BANDS[i][1]), s);
    }
  }
  return out.copy(lin(BANDS[BANDS.length - 1][1]));
}

/** Детерминированный шум 0…1 для лёгкой «ручной» неровности цвета граней. */
function hash(i: number, j: number): number {
  let h = (i * 374761393 + j * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function buildTerrain(input: TerrainInput): Terrain {
  const { dem } = input;
  const NX = input.segX ?? 232;
  const NZ = input.segZ ?? 164;
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

  // 2. внутри Татарстана (для приглушения соседей)
  const inside = new Float32Array(nv);
  for (let j = 0; j < VZ; j++) {
    fillRow(rowCrossings(input.border, vz(j)), WORLD.minX, dx, VX, (i) => (inside[j * VX + i] = 1));
  }

  // 3. вода: вершины внутри водохранилищ и расстояние до берега (растеризация рёбер)
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

  // 4. реки: прорезь под лентой
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

  // 5. затенение впадин (простое AO): насколько вершина ниже среднего по окрестности
  const ao = new Float32Array(nv);
  const AR = 3;
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

  // 6. граненая геометрия с запечённым светом
  const sun = new THREE.Vector3(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z).normalize();
  let minY = Infinity;
  for (let k = 0; k < nv; k++) if (y[k] < minY) minY = y[k];
  const baseY = minY - 1.4;
  const sideTris = 2 * (NX + NZ) * 2;
  const triangles = NX * NZ * 2 + sideTris;
  const pos = new Float32Array(triangles * 9);
  const col = new Float32Array(triangles * 9);
  let t = 0;

  const outside = lin(PALETTE.outside);
  const shallow = lin(PALETTE.water).lerp(lin(PALETTE.lowland), 0.35);
  const beach = lin(PALETTE.stoneSand).lerp(lin(PALETTE.lowland), 0.3);
  const riverBank = lin(PALETTE.lowland).lerp(lin(PALETTE.forest), 0.25);
  const cA = new THREE.Color();
  const cTmp = new THREE.Color();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const nrm = new THREE.Vector3();

  const face = (a: number, b: number, c: number, ia: number, ja: number) => {
    const ax = vx(a % VX), az = vz((a / VX) | 0);
    const bx = vx(b % VX), bz = vz((b / VX) | 0);
    const cx = vx(c % VX), cz = vz((c / VX) | 0);
    const o = t * 9;
    pos[o] = ax; pos[o + 1] = y[a]; pos[o + 2] = az;
    pos[o + 3] = bx; pos[o + 4] = y[b]; pos[o + 5] = bz;
    pos[o + 6] = cx; pos[o + 7] = y[c]; pos[o + 8] = cz;
    e1.set(bx - ax, y[b] - y[a], bz - az);
    e2.set(cx - ax, y[c] - y[a], cz - az);
    nrm.crossVectors(e1, e2).normalize();
    // цвет грани: высота до прорезей, вода, соседи
    const m = (meters[a] + meters[b] + meters[c]) / 3;
    elevColor(m, cA);
    const wet = (+!Number.isNaN(waterLevel[a]) + +!Number.isNaN(waterLevel[b]) + +!Number.isNaN(waterLevel[c])) / 3;
    // полностью под водой — отмель; на урезе — песчаный берег
    if (wet === 1) cA.copy(shallow);
    else if (wet > 0) cA.lerp(beach, 0.35 + 0.35 * wet);
    const rv = (riverMark[a] + riverMark[b] + riverMark[c]) / 3;
    if (rv > 0 && wet === 0) cA.lerp(riverBank, rv * 0.6);
    const ins = (inside[a] + inside[b] + inside[c]) / 3;
    if (ins < 1) cA.lerp(outside, (1 - ins) * 0.6);
    // свет: Ламберт от солнца + рассеянный, AO, лёгкий шум
    const lambert = Math.max(0, nrm.dot(sun));
    const occ = (ao[a] + ao[b] + ao[c]) / 3;
    const shade = (0.58 + 0.5 * lambert) * occ * (0.975 + 0.05 * hash(ia, ja));
    cA.multiplyScalar(shade);
    for (let v = 0; v < 3; v++) {
      col[o + v * 3] = cA.r;
      col[o + v * 3 + 1] = cA.g;
      col[o + v * 3 + 2] = cA.b;
    }
    t++;
  };

  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const a = j * VX + i;
      const b = a + 1;
      const c = a + VX;
      const d = c + 1;
      if ((i + j) % 2 === 0) {
        face(a, c, d, i * 2, j);
        face(a, d, b, i * 2 + 1, j);
      } else {
        face(a, c, b, i * 2, j);
        face(b, c, d, i * 2 + 1, j);
      }
    }
  }

  // 7. бока подставки: земля в разрезе, затенение по стороне света
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
      const o = t * 9;
      for (let v = 0; v < 3; v++) {
        const p = quad[q * 3 + v];
        pos[o + v * 3] = p[0]; pos[o + v * 3 + 1] = p[1]; pos[o + v * 3 + 2] = p[2];
        const isTop = p[3] === 1;
        col[o + v * 3] = isTop ? tr : bot.r;
        col[o + v * 3 + 1] = isTop ? tg : bot.g;
        col[o + v * 3 + 2] = isTop ? tb : bot.b;
      }
      // разворот, если грань смотрит внутрь
      e1.set(pos[o + 3] - pos[o], pos[o + 4] - pos[o + 1], pos[o + 5] - pos[o + 2]);
      e2.set(pos[o + 6] - pos[o], pos[o + 7] - pos[o + 1], pos[o + 8] - pos[o + 2]);
      nrm.crossVectors(e1, e2);
      if (nrm.x * nx + nrm.z * nz < 0) {
        for (let k = 0; k < 3; k++) {
          const p1 = pos[o + 3 + k]; pos[o + 3 + k] = pos[o + 6 + k]; pos[o + 6 + k] = p1;
          const c1 = col[o + 3 + k]; col[o + 3 + k] = col[o + 6 + k]; col[o + 6 + k] = c1;
        }
      }
      t++;
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

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true }));
  mesh.name = 'terrain';

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

  return { mesh, heightAt, baseY, triangles };
}
