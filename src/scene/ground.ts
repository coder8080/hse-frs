// Текстура земли: растительный покров (ESA WorldCover) + запечённая отмывка рельефа (R15).
// Пиксель ~0,22 км: лес, лоскуты полей, луга, города, мелкие озёра. Свет считается по DEM,
// поэтому овраги и долины читаются тоньше, чем позволяет сетка рельефа.
// Чистые вычисления над массивами: работает в Node без WebGL (тест бюджета).
import * as THREE from 'three';
import { WORLD, elevToY } from '../geo';
import { FIELDS, PALETTE, SUN_DIR } from '../palette';
import type { Dem } from './dem';
import { distToSegment, fillRow, rowCrossings, type P2 } from './polygon';
import { LC, type WorldData } from './types';
import type { RiverLine, WaterBody } from './water';

export interface GroundInput {
  dem: Dem;
  landcover: WorldData['landcover'];
  /** Кольца границы Татарстана в км (x, z). */
  border: P2[][];
  water: readonly WaterBody[];
  rivers: readonly RiverLine[];
  /** Затенение впадин 0.78…1.06 в узлах сетки рельефа: (nx + 1) × (nz + 1), узлы на краях охвата. */
  occlusion: { grid: Float32Array; nx: number; nz: number };
}

/** Флаги пикселя (для деревьев и прочей расстановки). */
export const GF = {
  inside: 1,
  /** Водохранилище, речное русло или класс «вода». */
  wet: 2,
  /** Берег: в пикселе от воды. */
  shore: 4,
} as const;

export interface Ground {
  texture: THREE.DataTexture;
  width: number;
  height: number;
  /** Размер пикселя, км. */
  px: number;
  pz: number;
  classes: Uint8Array;
  flags: Uint8Array;
}

// Ступени цвета по высоте (м): лёгкая подкраска поверх покрова
const lin = (hex: string) => new THREE.Color(hex);
const BANDS: [number, THREE.Color][] = (
  [
    [60, PALETTE.lowland],
    [130, PALETTE.lowland],
    [180, PALETTE.plain],
    [250, PALETTE.upland],
    [340, PALETTE.ridge],
  ] as const
).map(([m, hex]) => [m, lin(hex)]);

export function elevColor(m: number, out: THREE.Color): THREE.Color {
  if (m <= BANDS[0][0]) return out.copy(BANDS[0][1]);
  for (let i = 1; i < BANDS.length; i++) {
    if (m <= BANDS[i][0]) {
      const t = (m - BANDS[i - 1][0]) / (BANDS[i][0] - BANDS[i - 1][0]);
      const s = t * t * (3 - 2 * t);
      return out.copy(BANDS[i - 1][1]).lerp(BANDS[i][1], s);
    }
  }
  return out.copy(BANDS[BANDS.length - 1][1]);
}

/** Детерминированный шум 0…1. */
export function hash2(i: number, j: number): number {
  let h = (i * 374761393 + j * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Линейный цвет → байт sRGB (таблица, чтобы не считать pow на каждый пиксель). */
const SRGB_LUT = (() => {
  const n = 4096;
  const t = new Uint8Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const c = i / n;
    const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    t[i] = Math.round(Math.min(1, Math.max(0, s)) * 255);
  }
  return t;
})();
const toByte = (c: number) => SRGB_LUT[Math.min(4096, Math.max(0, (c * 4096) | 0))];

export function buildGround(input: GroundInput): Ground {
  const { dem, landcover } = input;
  const W = landcover.meta.width;
  const H = landcover.meta.height;
  const cls = landcover.classes;
  const px = WORLD.width / W;
  const pz = WORLD.depth / H;
  const cx = (c: number) => WORLD.minX + (c + 0.5) * px;
  const cz = (r: number) => WORLD.minZ + (r + 0.5) * pz;
  const flags = new Uint8Array(W * H);

  // 1. внутри Татарстана
  for (let r = 0; r < H; r++) {
    const row = r * W;
    fillRow(rowCrossings(input.border, cz(r)), cx(0), px, W, (c) => (flags[row + c] |= GF.inside));
  }
  // 2. вода: водохранилища, класс «вода», русла рек
  for (const body of input.water) {
    for (const poly of body.polygons) {
      const b = poly.bounds;
      const r0 = Math.max(0, Math.floor((b.minY - WORLD.minZ) / pz));
      const r1 = Math.min(H - 1, Math.ceil((b.maxY - WORLD.minZ) / pz));
      for (let r = r0; r <= r1; r++) {
        const row = r * W;
        fillRow(rowCrossings(poly.rings, cz(r)), cx(0), px, W, (c) => (flags[row + c] |= GF.wet));
      }
    }
  }
  for (let k = 0; k < W * H; k++) if (cls[k] === LC.water) flags[k] |= GF.wet;
  const bank = new Float32Array(W * H); // 0…1: близость к реке (тёмная прибрежная зелень)
  for (const rv of input.rivers) {
    const wet = rv.width * 0.5;
    const rad = wet + 0.6;
    for (let e = 1; e < rv.pts.length; e++) {
      const [ax, az] = rv.pts[e - 1];
      const [bx, bz] = rv.pts[e];
      const c0 = Math.max(0, Math.floor((Math.min(ax, bx) - rad - WORLD.minX) / px));
      const c1 = Math.min(W - 1, Math.ceil((Math.max(ax, bx) + rad - WORLD.minX) / px));
      const r0 = Math.max(0, Math.floor((Math.min(az, bz) - rad - WORLD.minZ) / pz));
      const r1 = Math.min(H - 1, Math.ceil((Math.max(az, bz) + rad - WORLD.minZ) / pz));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const d = distToSegment(cx(c), cz(r), ax, az, bx, bz);
          if (d > rad) continue;
          const k = r * W + c;
          if (d < wet) flags[k] |= GF.wet;
          bank[k] = Math.max(bank[k], 1 - d / rad);
        }
      }
    }
  }
  // 3. берег: сухой пиксель рядом с водой
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const k = r * W + c;
      if (flags[k] & GF.wet) continue;
      const near =
        (c > 0 && flags[k - 1] & GF.wet) ||
        (c < W - 1 && flags[k + 1] & GF.wet) ||
        (r > 0 && flags[k - W] & GF.wet) ||
        (r < H - 1 && flags[k + W] & GF.wet);
      if (near) flags[k] |= GF.shore;
    }
  }

  // 4. цвет и свет. Горячий цикл на ~3 млн пикселей: только числа и таблицы, без объектов
  type RGB = [number, number, number];
  const rgb = (hex: string): RGB => {
    const c = lin(hex);
    return [c.r, c.g, c.b];
  };
  const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const fields = FIELDS.map(rgb);
  const roofs = [PALETTE.brickRed, PALETTE.roofDark, PALETTE.stoneWhite].map((h) => mix(rgb(PALETTE.town), rgb(h), 0.45));
  // цвет по коду класса (остальные классы — луг)
  const base: RGB[] = new Array(256).fill(rgb(PALETTE.meadow));
  base[LC.tree] = rgb(PALETTE.forestFloor);
  base[LC.built] = rgb(PALETTE.town);
  base[LC.wetland] = rgb(PALETTE.wetland);
  base[LC.bare] = rgb(PALETTE.stoneSand);
  base[LC.water] = rgb(PALETTE.river);
  const shallow = mix(rgb(PALETTE.water), rgb(PALETTE.lowland), 0.35);
  const beach = mix(rgb(PALETTE.stoneSand), rgb(PALETTE.lowland), 0.3);
  const bankC = rgb(PALETTE.forest);
  const outside = rgb(PALETTE.outside);
  // подкраска по высоте: таблица по метрам
  const elevLut = new Float32Array(512 * 3);
  const tmp = new THREE.Color();
  for (let m = 0; m < 512; m++) {
    elevColor(m, tmp);
    elevLut.set([tmp.r, tmp.g, tmp.b], m * 3);
  }
  // высоты в центрах пикселей (м) — для отмывки центральными разностями; билинейно по DEM построчно
  const hm = new Float32Array(W * H);
  const dw = dem.w;
  const dh = dem.h;
  const colC = new Int32Array(W);
  const colU = new Float32Array(W);
  for (let q = 0; q < W; q++) {
    const fc = Math.min(dw - 1, Math.max(0, ((q + 0.5) / W) * (dw - 1)));
    colC[q] = Math.min(dw - 2, Math.floor(fc));
    colU[q] = fc - colC[q];
  }
  for (let r = 0; r < H; r++) {
    const fr = Math.min(dh - 1, Math.max(0, ((r + 0.5) / H) * (dh - 1)));
    const rr = Math.min(dh - 2, Math.floor(fr));
    const v = fr - rr;
    for (let q = 0; q < W; q++) {
      const c0 = colC[q];
      const u = colU[q];
      const top = dem.node(c0, rr) * (1 - u) + dem.node(c0 + 1, rr) * u;
      const bot = dem.node(c0, rr + 1) * (1 - u) + dem.node(c0 + 1, rr + 1) * u;
      hm[r * W + q] = top * (1 - v) + bot * v;
    }
  }
  const sl = Math.hypot(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z);
  const sx = SUN_DIR.x / sl;
  const sy = SUN_DIR.y / sl;
  const sz = SUN_DIR.z / sl;
  const kx = elevToY(1) / (2 * px); // м → наклон (ед. мира на км)
  const kz = elevToY(1) / (2 * pz);
  // затенение впадин: те же билинейные веса, что у высот, но по сетке рельефа
  const ao = input.occlusion;
  const avx = ao.nx + 1;
  const aoC = new Int32Array(W);
  const aoU = new Float32Array(W);
  for (let q = 0; q < W; q++) {
    const fc = ((q + 0.5) / W) * ao.nx;
    aoC[q] = Math.min(ao.nx - 1, Math.floor(fc));
    aoU[q] = fc - aoC[q];
  }
  const data = new Uint8Array(W * H * 4);
  let cr = 0;
  let cg = 0;
  let cb = 0;
  const lerpTo = (t: RGB, k: number) => {
    cr += (t[0] - cr) * k;
    cg += (t[1] - cg) * k;
    cb += (t[2] - cb) * k;
  };
  for (let r = 0; r < H; r++) {
    const br = (r / 2) | 0;
    const shift = (hash2(br, 7) * 3) | 0;
    const fa = ((r + 0.5) / H) * ao.nz;
    const ar = Math.min(ao.nz - 1, Math.floor(fa));
    const av = fa - ar;
    for (let q = 0; q < W; q++) {
      const k = r * W + q;
      const f = flags[k];
      const cl = cls[k];
      const m = hm[k];
      let t: RGB;
      if (cl === LC.crop) {
        // лоскуты полей ~0,5–0,9 км: блоки 3×2 пикселя со сдвигом рядов
        t = fields[(hash2(((q + shift) / 3) | 0, br) * fields.length) | 0];
      } else if (cl === LC.built) {
        const h = hash2(q, r);
        t = h > 0.55 ? roofs[(h * 7) % 3 | 0] : base[LC.built];
      } else {
        t = base[cl];
      }
      cr = t[0];
      cg = t[1];
      cb = t[2];
      if (cl !== LC.water) {
        // высота: возвышенности чуть теплее, низины свежее
        const e = Math.min(511, Math.max(0, m | 0)) * 3;
        cr += (elevLut[e] - cr) * 0.18;
        cg += (elevLut[e + 1] - cg) * 0.18;
        cb += (elevLut[e + 2] - cb) * 0.18;
        if (bank[k] > 0 && cl !== LC.built) lerpTo(bankC, bank[k] * 0.3);
      }
      if (f & GF.wet && cl !== LC.water) {
        cr = shallow[0];
        cg = shallow[1];
        cb = shallow[2];
      } else if (f & GF.shore) lerpTo(beach, 0.35);
      if (!(f & GF.inside)) lerpTo(outside, 0.55);
      // отмывка: Ламберт от солнца + рассеянный, AO с сетки рельефа, лёгкий шум
      const gx = (hm[q < W - 1 ? k + 1 : k] - hm[q > 0 ? k - 1 : k]) * kx;
      const gz = (hm[r < H - 1 ? k + W : k] - hm[r > 0 ? k - W : k]) * kz;
      const lambert = Math.max(0, (-gx * sx + sy - gz * sz) / Math.sqrt(gx * gx + 1 + gz * gz));
      const a = ar * avx + aoC[q];
      const au = aoU[q];
      const occ = (ao.grid[a] * (1 - au) + ao.grid[a + 1] * au) * (1 - av) + (ao.grid[a + avx] * (1 - au) + ao.grid[a + avx + 1] * au) * av;
      const shade = (0.58 + 0.5 * lambert) * occ * (0.97 + 0.06 * hash2(q * 3 + 1, r * 5 + 2));
      const o = k * 4;
      data[o] = toByte(cr * shade);
      data[o + 1] = toByte(cg * shade);
      data[o + 2] = toByte(cb * shade);
      data[o + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return { texture, width: W, height: H, px, pz, classes: cls, flags };
}
