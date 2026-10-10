// Болгар на высоком берегу Волги: руины Соборной мечети с Большим минаретом и
// угловой башней, Успенская церковь, Северный мавзолей, Ханская усыпальница с
// Малым минаретом, Памятный знак с золотым куполом над рекой и Белая мечеть.
// У пристани покачивается круизный теплоход.
import * as THREE from 'three';
import { Builder, assemble, convexHull, groundShadow, mix, plinth, shade, type Col, type Miniature, type P2, type P3 } from './kit';
import { MOSQUE_DOME, roundTree, spire, tree } from './archi';

// ---------- палитра ----------
const SAND = mix('stoneSand', 'stoneWhite', 0.2); // белый камень руин
const SAND_TOP = shade('stoneSand', 0.84);
const SAND_DARK = shade('stoneSand', 0.9);
const WHITE = 'stoneWhite';
const WHITE_TOP = shade('stoneWhite', 0.86);
const WHITE_TRIM = shade('stoneWhite', 0.93);
const BLACK = mix('roofDark', 'oilBlack', 0.5);
const PALE_GOLD = mix('gold', 'stoneWhite', 0.45);
const GLASS = mix('roofDark', 'glass', 0.35);
const HOLE = shade('roofDark', 0.8);
const PAVE = mix('stoneSand', 'stoneWhite', 0.4);
const GRASS = 'lowland';

/** Гладкая луковица (для куполов Белой мечети и глав церкви). */
const ONION_S: P2[] = [
  [0.6, 0],
  [0.86, 0.12],
  [1, 0.3],
  [0.97, 0.45],
  [0.8, 0.62],
  [0.5, 0.78],
  [0.22, 0.9],
  [0.07, 0.97],
  [0, 1],
];
/** Полусферический купол мавзолея. */
const BOWL: P2[] = [
  [1, 0],
  [0.95, 0.32],
  [0.8, 0.6],
  [0.55, 0.84],
  [0.25, 0.97],
  [0, 1],
];

function prof(p: P2[], r: number, h: number, y0 = 0): P2[] {
  return p.map(([pr, py]) => [pr * r, y0 + py * h]);
}

/** Окно со стрельчатым верхом, смотрит в +Z. */
function archWin(b: Builder, w: number, h: number, color: Col, at: P3, ry = 0): void {
  b.group({ at, ry }, () => {
    b.rect(w, h, color);
    b.tri([-w / 2, h, 0], [w / 2, h, 0], [0, h + w * 0.6, 0], color, [0, 0, 1], { shadow: false });
  });
}

/** Окна по граням многогранного тела (вершины как у lathe с тем же seg/phase). */
function ringWindows(b: Builder, r: number, seg: number, y: number, w: number, h: number, color: Col, phase = 0, every = 1): void {
  const ap = r * Math.cos(Math.PI / seg) + 0.012;
  for (let j = 0; j < seg; j += every) {
    const m = phase + ((j + 0.5) / seg) * Math.PI * 2;
    archWin(b, w, h, color, [Math.sin(m) * ap, y, Math.cos(m) * ap], m);
  }
}

/** Полумесяц: плоский серп в плоскости XY. */
function crescent(b: Builder, at: P3, r: number, ry = 0): void {
  const pts: P2[] = [];
  const n = 5;
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI * 0.8 + (i / n) * Math.PI * 1.6;
    pts.push([Math.sin(a) * r, Math.cos(a) * r]);
  }
  for (let i = n; i >= 0; i--) {
    const a = -Math.PI * 0.62 + (i / n) * Math.PI * 1.24;
    pts.push([Math.sin(a) * r * 0.78, Math.cos(a) * r * 0.78 + r * 0.28]);
  }
  b.profile(pts, 0.03, 'gold', { at, ry, shadow: false });
}

/** Золотое навершие: шарик, шпиль и полумесяц. */
function finial(b: Builder, y: number, s = 1): void {
  b.lathe(
    [
      [0, y],
      [0.05 * s, y + 0.04 * s],
      [0, y + 0.09 * s],
    ],
    5,
    'gold',
  );
  spire(b, [0, y + 0.07 * s, 0], 0.2 * s, 0.02 * s);
  crescent(b, [0, y + 0.3 * s, 0], 0.07 * s, 0.6);
}

/** Православный крест. */
function cross(b: Builder, at: P3, s = 1): void {
  b.group({ at, s }, () => {
    b.box(0.03, 0.34, 0.03, 'gold');
    b.box(0.18, 0.03, 0.03, 'gold', { at: [0, 0.22, 0] });
  });
}

/** Склон между двумя кольцами с одинаковым числом точек. */
function slope(b: Builder, lo: P2[], ylo: number, hi: P2[], yhi: number, color: (i: number) => Col): void {
  const n = lo.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // нормаль наружу: от середины верхнего ребра к нижнему + вверх
    let px = (lo[i][0] + lo[j][0] - hi[i][0] - hi[j][0]) / 2;
    let pz = (lo[i][1] + lo[j][1] - hi[i][1] - hi[j][1]) / 2;
    const run = Math.hypot(px, pz);
    if (run < 1e-6) {
      px = lo[i][0];
      pz = lo[i][1];
    }
    const pl = Math.hypot(px, pz) || 1;
    const want: P3 = [(px / pl) * (yhi - ylo), Math.max(run, 0.02), (pz / pl) * (yhi - ylo)];
    const c = shade(color(i), 0.96 + 0.06 * Math.sin(i * 2.3));
    const a: P3 = [lo[i][0], ylo, lo[i][1]];
    const bb: P3 = [lo[j][0], ylo, lo[j][1]];
    const d: P3 = [hi[j][0], yhi, hi[j][1]];
    const e: P3 = [hi[i][0], yhi, hi[i][1]];
    b.tri(a, bb, d, c, want, { ao: false, shadow: false });
    b.tri(a, d, e, c, want, { ao: false, shadow: false });
  }
}

/** Круг радиуса r, срезанный по x ≥ xc (берег), n точек. */
function bank(r: number, xc: number, n: number): P2[] {
  const out: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push([Math.max(xc, Math.cos(a) * r), Math.sin(a) * r]);
  }
  return out;
}

// ---------- постройки ----------

/** Большой минарет: сужающийся ствол, пояс-карниз, галерея с арками, чёрный конус. */
function bigMinaret(b: Builder, at: P3, h: number): void {
  const r = 0.36;
  b.group(
    { at },
    () => {
      b.cyl(r * 1.45, r * 1.4, 0.35, 8, SAND_DARK, undefined, { top: SAND_TOP, phase: Math.PI / 8 });
      b.lathe(
        [
          [r, 0.35],
          [r * 0.9, h * 0.5],
        ],
        12,
        SAND,
        undefined,
        { capTop: false },
      );
      b.lathe(
        [
          [r * 0.9, h * 0.5],
          [r * 1.03, h * 0.5 + 0.08],
          [r * 1.03, h * 0.5 + 0.22],
          [r * 0.86, h * 0.5 + 0.28],
        ],
        12,
        SAND_TOP,
        undefined,
        { capTop: false, bands: [SAND_TOP, mix('stoneWhite', 'stoneSand', 0.5), SAND_TOP] },
      );
      b.lathe(
        [
          [r * 0.86, h * 0.5 + 0.28],
          [r * 0.8, h * 0.84],
        ],
        12,
        SAND,
        undefined,
        { capTop: false },
      );
      // галерея муэдзина с арками
      b.cyl(r * 0.92, r * 0.92, 0.07, 12, SAND_TOP, { at: [0, h * 0.84, 0] }, { top: false });
      b.cyl(r * 0.84, r * 0.84, h * 0.08, 12, SAND, { at: [0, h * 0.84 + 0.07, 0] }, { top: false });
      ringWindows(b, r * 0.84, 12, h * 0.84 + 0.1, 0.06, h * 0.05, HOLE, 0, 1);
      const yc = h * 0.92 + 0.07;
      b.cyl(r * 0.9, r * 0.9, 0.05, 12, SAND_TOP, { at: [0, yc, 0] }, { top: false });
      b.lathe(
        [
          [r * 0.92, yc + 0.05],
          [0, h + 0.75],
        ],
        12,
        BLACK,
        undefined,
        { capTop: false },
      );
      finial(b, h + 0.72, 1);
    },
    { shadowGroup: true },
  );
}

/** Успенская церковь: колокольня с чёрным шатром, четверик с главой, апсида. */
function assumptionChurch(b: Builder, at: P3, ry: number): void {
  b.group(
    { at, ry },
    () => {
      // храм
      b.box(1.0, 0.85, 0.9, WHITE, { at: [0.35, 0, 0] }, { top: WHITE_TOP });
      b.pyramid(1.06, 0.96, 0.22, BLACK, { at: [0.35, 0.85, 0] });
      b.cyl(0.36, 0.36, 0.6, 8, WHITE, { at: [0.95, 0, 0] }, { top: BLACK });
      for (const s of [1, -1]) archWin(b, 0.1, 0.25, GLASS, [0.35, 0.36, s * 0.452], s > 0 ? 0 : Math.PI);
      b.cyl(0.24, 0.24, 0.35, 8, WHITE, { at: [0.35, 0.95, 0] }, { top: false });
      b.lathe(prof(ONION_S, 0.25, 0.38, 1.3), 8, BLACK, { at: [0.35, 0, 0] });
      cross(b, [0.35, 1.66, 0], 0.7);
      // колокольня
      b.box(0.62, 0.95, 0.62, WHITE, { at: [-0.45, 0, 0] }, { top: WHITE_TOP });
      archWin(b, 0.22, 0.42, HOLE, [-0.45, 0, 0.312]);
      b.box(0.68, 0.05, 0.68, WHITE_TRIM, { at: [-0.45, 0.95, 0] });
      b.cyl(0.27, 0.27, 0.5, 8, WHITE, { at: [-0.45, 1.0, 0] }, { phase: Math.PI / 8, top: false });
      b.group({ at: [-0.45, 0, 0] }, () => ringWindows(b, 0.27, 8, 1.1, 0.1, 0.22, HOLE, Math.PI / 8, 2));
      b.lathe(
        [
          [0.34, 1.48],
          [0.3, 1.55],
          [0.05, 2.15],
        ],
        8,
        BLACK,
        { at: [-0.45, 0, 0] },
        { phase: Math.PI / 8, capTop: false },
      );
      b.lathe(prof(ONION_S, 0.08, 0.16, 2.12), 6, BLACK, { at: [-0.45, 0, 0] });
      cross(b, [-0.45, 2.27, 0], 0.55);
    },
    { shadowGroup: true },
  );
}

/** Мавзолей: куб, восьмигранный барабан, купол. */
function mausoleum(b: Builder, at: P3, ry: number, s: number, low = false): void {
  b.group(
    { at, ry, s },
    () => {
      b.box(1.2, 0.95, 1.2, SAND, undefined, { top: SAND_TOP });
      b.box(1.26, 0.06, 1.26, SAND_TOP, { at: [0, 0.95, 0] });
      archWin(b, 0.34, 0.45, HOLE, [0, 0, 0.602]);
      b.box(0.5, 0.75, 0.08, SAND_DARK, { at: [0, 0, 0.62] });
      archWin(b, 0.3, 0.42, HOLE, [0, 0, 0.661]);
      if (!low) b.cyl(0.55, 0.55, 0.3, 8, SAND, { at: [0, 1.01, 0] }, { phase: Math.PI / 8, top: SAND_TOP });
      b.lathe(prof(BOWL, low ? 0.6 : 0.52, low ? 0.42 : 0.55, low ? 1.01 : 1.31), 12, SAND_DARK);
    },
    { shadowGroup: true },
  );
}

/** Памятный знак в честь принятия ислама: белый восьмерик с золотым куполом. */
function memorial(b: Builder, at: P3, s: number): void {
  b.group(
    { at, s },
    () => {
      b.extrude(
        [
          [-1.0, -0.7],
          [1.0, -0.7],
          [1.0, 0.7],
          [-1.0, 0.7],
        ],
        0.15,
        WHITE_TRIM,
        undefined,
        { top: PAVE },
      );
      b.cyl(0.72, 0.72, 0.5, 8, WHITE, { at: [0, 0.15, 0] }, { phase: Math.PI / 8, top: WHITE_TOP });
      b.cyl(0.62, 0.62, 0.55, 8, WHITE, { at: [0, 0.65, 0] }, { phase: Math.PI / 8, top: WHITE_TOP });
      ringWindows(b, 0.72, 8, 0.22, 0.14, 0.24, GLASS, Math.PI / 8, 1);
      ringWindows(b, 0.62, 8, 0.76, 0.12, 0.22, GLASS, Math.PI / 8, 1);
      b.lathe(prof(MOSQUE_DOME, 0.6, 0.7, 1.2), 14, 'gold', undefined, { bands: ['gold', shade('gold', 1.08), 'gold', shade('gold', 1.08), 'gold'] });
      finial(b, 1.88, 1.2);
    },
    { shadowGroup: true },
  );
}

/** Минарет Белой мечети: восьмигранные ярусы с балконами, белая луковка. */
function whiteMinaret(b: Builder, at: P3, h: number): void {
  const r = 0.17;
  b.group(
    { at },
    () => {
      b.cyl(r * 1.35, r * 1.35, h * 0.3, 8, WHITE, undefined, { top: WHITE_TOP, phase: Math.PI / 8 });
      let y = h * 0.3;
      let rr = r;
      for (let k = 0; k < 3; k++) {
        const seg = h * (k === 0 ? 0.28 : 0.13);
        b.cyl(rr, rr, seg, 8, WHITE, { at: [0, y, 0] }, { top: false, phase: Math.PI / 8 });
        ringWindows(b, rr, 8, y + seg * 0.45, 0.04, 0.1, GLASS, Math.PI / 8, 4);
        y += seg;
        b.cyl(rr * 1.45, rr * 1.35, 0.05, 8, mix('stoneWhite', 'gold', 0.25), { at: [0, y, 0] }, { phase: Math.PI / 8, top: WHITE_TOP });
        y += 0.05;
        rr *= 0.85;
      }
      b.lathe(prof(ONION_S, rr * 1.4, 0.38, y), 8, PALE_GOLD);
      spire(b, [0, y + 0.36, 0], 0.18, 0.02);
    },
    { shadowGroup: true },
  );
}

/** Белая мечеть: молельный зал, портал, купол на барабане, два минарета, аркадные галереи. */
function whiteMosque(b: Builder, at: P3, ry: number): void {
  b.group({ at, ry, s: 0.82 }, () => {
    // стилобат
    b.box(2.6, 0.12, 2.2, WHITE_TRIM, { at: [0, 0, -0.1] }, { top: PAVE });
    b.group(
      {},
      () => {
        b.box(1.3, 1.0, 1.2, WHITE, { at: [0, 0.12, -0.25] }, { top: WHITE_TOP });
        b.box(1.36, 0.06, 1.26, mix('stoneWhite', 'gold', 0.25), { at: [0, 1.12, -0.25] });
        // портал со стрельчатой аркой
        b.box(0.6, 1.25, 0.2, WHITE, { at: [0, 0.12, 0.42] }, { top: WHITE_TOP });
        archWin(b, 0.32, 0.65, GLASS, [0, 0.12, 0.522]);
        for (const x of [-0.45, 0.45]) archWin(b, 0.12, 0.38, GLASS, [x, 0.45, 0.352]);
        for (const s of [1, -1]) {
          b.group({ at: [s * 0.652, 0, -0.25], ry: (s * Math.PI) / 2 }, () => {
            for (const x of [-0.35, 0, 0.35]) archWin(b, 0.12, 0.38, GLASS, [x, 0.45, 0]);
          });
        }
        // барабан с окнами и купол
        b.cyl(0.42, 0.42, 0.35, 12, WHITE, { at: [0, 1.18, -0.25] }, { top: false });
        b.group({ at: [0, 0, -0.25] }, () => ringWindows(b, 0.42, 12, 1.24, 0.06, 0.15, GLASS, 0, 1));
        b.lathe(prof(ONION_S, 0.55, 0.85, 1.5), 14, PALE_GOLD, { at: [0, 0, -0.25] }, { bands: [PALE_GOLD, shade(PALE_GOLD, 1.06), PALE_GOLD] });
        spire(b, [0, 2.32, -0.25], 0.25, 0.025);
        // угловые башенки
        for (const [x, z] of [
          [-0.6, -0.8],
          [0.6, -0.8],
          [-0.6, 0.3],
          [0.6, 0.3],
        ] as P2[]) {
          b.cyl(0.06, 0.06, 1.3, 6, WHITE, { at: [x, 0.12, z] }, { top: false });
          b.lathe(prof(ONION_S, 0.08, 0.16, 1.42), 6, PALE_GOLD, { at: [x, 0, z] });
        }
      },
      { shadowGroup: true },
    );
    // минареты по сторонам портала
    for (const x of [-0.95, 0.95]) whiteMinaret(b, [x, 0.12, 0.45], 3.5);
    // аркадные галереи-крылья с малыми куполами
    for (const s of [1, -1]) {
      b.group(
        { at: [s * 1.0, 0.12, -0.35] },
        () => {
          b.box(0.55, 0.5, 1.3, WHITE, undefined, { top: WHITE_TOP });
          b.box(0.6, 0.04, 1.36, mix('stoneWhite', 'gold', 0.25), { at: [0, 0.5, 0] });
          b.group({ at: [s * 0.277, 0, 0], ry: (s * Math.PI) / 2 }, () => {
            for (const x of [-0.42, -0.14, 0.14, 0.42]) archWin(b, 0.16, 0.24, GLASS, [x, 0.05, 0]);
          });
          b.cyl(0.18, 0.18, 0.12, 8, WHITE, { at: [0, 0.5, -0.3] }, { top: false });
          b.lathe(prof(ONION_S, 0.22, 0.35, 0.62), 8, PALE_GOLD, { at: [0, 0, -0.3] });
        },
        { shadowGroup: true },
      );
    }
  });
}

/** Руины Соборной мечети: обломки стен с арочными нишами, угловая башня, базы колонн. */
function ruins(b: Builder, Y: number): void {
  const x0 = -1.9;
  const x1 = 0.7;
  const z0 = -3.2;
  const z1 = -0.95;
  const pieces: [P2, P2, number][] = [
    [[x0, z0], [x0 + 1.0, z0], 0.7],
    [[x0 + 1.35, z0], [x1, z0], 0.5],
    [[x1, z0 + 0.5], [x1, z0 + 1.3], 0.62],
    [[x1, z0 + 1.6], [x1, z1], 0.4],
    [[x1, z1], [x1 - 0.8, z1], 0.55],
    [[x0 + 1.0, z1], [x0 + 0.4, z1], 0.45],
    [[x0, z1 - 0.5], [x0, z0 + 0.6], 0.6],
  ];
  for (const [a, c, h] of pieces) {
    const dx = c[0] - a[0];
    const dz = c[1] - a[1];
    const len = Math.hypot(dx, dz);
    b.group({ at: [(a[0] + c[0]) / 2, Y, (a[1] + c[1]) / 2], ry: Math.atan2(-dz, dx) }, () => {
      b.box(len, 0.12, 0.34, SAND_DARK, undefined, { top: SAND_TOP });
      b.box(len - 0.06, h, 0.24, SAND, undefined, { top: SAND_TOP });
      // зубчатый обломанный верх
      const n = Math.max(1, Math.floor(len / 0.35));
      for (let i = 0; i < n; i++) {
        if ((i * 7 + Math.round(len * 10)) % 3 === 0) continue;
        b.box(0.18, 0.08 + ((i * 5) % 3) * 0.05, 0.24, SAND, { at: [(i - (n - 1) / 2) * (len / n), h, 0] }, { top: SAND_TOP });
      }
      // ниши
      const m = Math.floor(len / 0.45);
      for (let i = 0; i < m; i++) {
        const x = (i - (m - 1) / 2) * (len / m);
        archWin(b, 0.13, h * 0.42, shade('stoneSand', 0.62), [x, 0.12, 0.122]);
      }
    });
  }
  // угловая башня-восьмерик (северо-восток)
  b.group({ at: [x1, Y, z0] }, () => {
    b.cyl(0.62, 0.66, 0.2, 8, SAND_DARK, undefined, { top: SAND_TOP, phase: Math.PI / 8 });
    b.cyl(0.52, 0.48, 1.05, 8, SAND, { at: [0, 0.2, 0] }, { top: SAND_TOP, phase: Math.PI / 8 });
  });
  // базы колонн молельного зала
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 2; j++) {
      b.box(0.16, 0.12 + ((i + j) % 3) * 0.07, 0.16, SAND, { at: [x0 + 0.55 + i * 0.5, Y, z0 + 0.75 + j * 0.65], shadow: false });
    }
  }
}

export function buildBolgar(): Miniature {
  const b = new Builder();
  const G = plinth(b, 'water');

  // высокий левый берег Волги: урез с песком, крутой склон, плато
  const H = 0.6;
  const Y = G + H;
  const N = 32;
  const lo = bank(4.7, -3.2, N);
  const mid = bank(4.69, -3.0, N);
  const hi = bank(4.45, -2.35, N);
  const onRiver = (i: number) => lo[i][0] <= -3.19 || lo[(i + 1) % N][0] <= -3.19;
  slope(b, lo, G, mid, G + 0.08, (i) => (onRiver(i) ? mix('stoneSand', GRASS, 0.2) : shade(GRASS, 0.9)));
  slope(b, mid, G + 0.08, hi, Y, (i) => (onRiver(i) ? mix(GRASS, 'forest', 0.35) : shade(GRASS, 0.92)));
  b.flat(hi, Y, GRASS);
  b.shadowPlane = { y: Y, poly: convexHull(hi), color: groundShadow(GRASS) };

  // мощёные дорожки
  const path = (pts: P2[]) => b.flat(pts, Y + 0.01, PAVE);
  path([
    [-0.5, -0.9],
    [-0.2, -0.9],
    [0.05, 4.3],
    [-0.35, 4.3],
  ]);
  path([
    [-0.3, 0.6],
    [-0.3, 0.9],
    [2.2, 1.6],
    [2.3, 1.3],
  ]);
  path([
    [-2.0, 2.6],
    [-1.9, 2.3],
    [-0.25, 1.6],
    [-0.25, 1.9],
  ]);
  b.flat(
    [
      [-2.0, -3.4],
      [0.9, -3.4],
      [0.9, -0.75],
      [-2.0, -0.75],
    ],
    Y + 0.008,
    mix(GRASS, 'stoneSand', 0.35),
  );

  ruins(b, Y);
  bigMinaret(b, [-0.35, Y, -0.7], 4.6);
  assumptionChurch(b, [-1.0, Y, -3.8], 0.05);
  mausoleum(b, [-1.55, Y, 0.85], 0.2, 0.9);
  // Ханская усыпальница и Малый минарет
  mausoleum(b, [1.9, Y, -2.55], -0.3, 0.85, true);
  b.group(
    { at: [2.95, Y, -1.7] },
    () => {
      b.lathe(
        [
          [0.22, 0],
          [0.19, 1.5],
        ],
        8,
        SAND,
        undefined,
        { capTop: false },
      );
      b.cyl(0.23, 0.23, 0.07, 8, SAND_TOP, { at: [0, 1.5, 0] }, { top: false });
      b.lathe(
        [
          [0.23, 1.57],
          [0, 2.25],
        ],
        8,
        BLACK,
        undefined,
        { capTop: false },
      );
      spire(b, [0, 2.22, 0], 0.18, 0.02);
    },
    { shadowGroup: true },
  );
  memorial(b, [-1.65, Y, 2.75], 0.62);
  whiteMosque(b, [2.55, Y, 0.95], -0.6);

  // деревья
  roundTree(b, 0.9, 0.0, Y, 0.55);
  roundTree(b, -2.2, -0.2, Y, 0.6);
  roundTree(b, 0.6, 3.4, Y, 0.55);
  roundTree(b, 1.2, 3.9, Y, 0.5);
  roundTree(b, 4.0, 0.9, Y, 0.5);
  roundTree(b, 2.4, -3.6, Y, 0.55);
  tree(b, -2.0, 1.75, Y, 0.45);
  tree(b, 3.4, -2.6, Y, 0.45);
  tree(b, -0.9, 3.9, Y, 0.45);
  tree(b, 0.4, -3.9, Y, 0.4);
  roundTree(b, 2.2, 3.3, Y, 0.5);
  roundTree(b, 3.3, 2.5, Y, 0.45);
  tree(b, 1.6, 2.7, Y, 0.4);
  roundTree(b, -2.75, -2.0, G + 0.2, 0.45, mix('forest', 'lowland', 0.3));
  roundTree(b, -2.8, 1.2, G + 0.2, 0.42, mix('forest', 'lowland', 0.3));

  // фигурки
  const people: [number, number, Col][] = [
    [-0.25, 2.2, 'accent'],
    [-0.1, 2.5, 'roofBlue'],
    [0.6, 1.0, 'gold'],
    [-1.0, 1.95, 'kamazBlue'],
    [1.4, 1.35, 'accent'],
  ];
  for (const [x, z, c] of people) b.box(0.07, 0.14, 0.07, c, { at: [x, Y, z], shadow: false });

  // пристань
  b.box(0.2, 0.07, 1.4, 'wood', { at: [-3.4, G, 0.6], shadow: false }, { top: shade('wood', 1.1) });
  b.box(0.4, 0.05, 0.2, 'wood', { at: [-3.2, G, 0.6], shadow: false });

  // ---------- теплоход (покачивается) ----------
  const a = new Builder(G);
  const shipAt: P3 = [-3.92, G, 0.55];
  a.group({ at: shipAt, ry: Math.PI / 2 - 0.04 }, () => {
    a.profile(
      [
        [-1.1, 0],
        [0.95, 0],
        [1.25, 0.2],
        [-1.15, 0.2],
      ],
      0.38,
      WHITE,
      undefined,
      { caps: WHITE_TRIM, faces: ['roofBlue', 'roofBlue', WHITE_TOP, 'roofBlue'] },
    );
    a.box(1.75, 0.16, 0.32, WHITE, { at: [-0.12, 0.2, 0] }, { top: WHITE_TOP });
    a.box(1.45, 0.15, 0.28, WHITE, { at: [-0.18, 0.36, 0] }, { top: WHITE_TOP });
    a.box(0.5, 0.12, 0.26, WHITE, { at: [0.25, 0.51, 0] }, { top: 'accent' });
    for (const s of [1, -1]) {
      a.group({ ry: s > 0 ? 0 : Math.PI }, () => {
        a.rect(1.65, 0.05, GLASS, { at: [-0.12 * s, 0.26, 0.162] });
        a.rect(1.35, 0.05, GLASS, { at: [-0.18 * s, 0.42, 0.142] });
      });
    }
    a.cyl(0.05, 0.05, 0.18, 6, 'accent', { at: [-0.35, 0.51, 0] });
  });

  const shipEnd = a.triangles;

  // лодка-моторка у дальнего берега
  const boatAt: P3 = [-3.9, G, -2.1];
  a.group({ at: boatAt, ry: Math.PI / 2 + 0.3 }, () => {
    a.profile(
      [
        [-0.28, 0],
        [0.22, 0],
        [0.34, 0.09],
        [-0.3, 0.09],
      ],
      0.16,
      WHITE,
      undefined,
      { caps: WHITE_TRIM, faces: ['accent', 'accent', WHITE_TOP, 'accent'] },
    );
    a.box(0.12, 0.08, 0.12, GLASS, { at: [0.0, 0.09, 0] });
  });
  const boatEnd = a.triangles;

  // чайки кружат над минаретом
  const gullC: P2 = [-0.35, -0.7];
  const gulls: [number, number, number][] = [
    [1.3, Y + 3.7, 0],
    [1.7, Y + 4.1, 2.2],
    [1.1, Y + 4.4, 4.1],
  ];
  for (const [r, y, ph] of gulls) {
    a.group({ at: [gullC[0] + Math.cos(ph) * r, y, gullC[1] + Math.sin(ph) * r], ry: -ph }, () => {
      for (const sx of [1, -1]) {
        for (const ny of [1, -1]) a.tri([0, 0, -0.04], [0, 0, 0.06], [sx * 0.17, 0.05, -0.02], WHITE, [0, ny, 0], { shadow: false });
      }
    });
  }

  const mini = assemble('bolgar', [b, a]);
  const mesh = mini.group.children[1] as THREE.Mesh;
  const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  const rest = Float32Array.from(pos.array as Float32Array);
  const out = pos.array as Float32Array;
  mesh.geometry.boundingSphere!.set(new THREE.Vector3(-1.5, 2.5, -0.5), 5);
  const vShip = shipEnd * 9;
  const vBoat = boatEnd * 9;
  mini.update = (t: number) => {
    // теплоход: медленное покачивание и крен
    const bob = 0.02 * Math.sin(t * 1.3);
    const roll = 0.025 * Math.sin(t * 0.9 + 1);
    for (let i = 0; i < vShip; i += 3) out[i + 1] = Math.max(0, rest[i + 1] + bob + roll * (rest[i] - shipAt[0]));
    // моторка: чаще и сильнее
    const bob2 = 0.02 * Math.sin(t * 2.3 + 1.5);
    const pitch = 0.06 * Math.sin(t * 2.3);
    for (let i = vShip; i < vBoat; i += 3) out[i + 1] = Math.max(0, rest[i + 1] + bob2 + pitch * (rest[i + 2] - boatAt[2]));
    // чайки: поворот вокруг оси минарета и взмахи
    const ang = t * 0.35;
    const c = Math.cos(ang);
    const sn = Math.sin(ang);
    for (let i = vBoat; i < out.length; i += 3) {
      const k = Math.floor((i - vBoat) / 36);
      const x = rest[i] - gullC[0];
      const z = rest[i + 2] - gullC[1];
      out[i] = gullC[0] + x * c - z * sn;
      out[i + 2] = gullC[1] + x * sn + z * c;
      out[i + 1] = rest[i + 1] + 0.12 * Math.sin(t * 0.8 + k * 2);
    }
    pos.needsUpdate = true;
  };
  mini.update(0);
  return mini;
}
