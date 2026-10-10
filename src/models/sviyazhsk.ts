// Свияжск: остров-град на холме среди Куйбышевского водохранилища. На плато —
// Успенский монастырь (белый собор с кокошниками и тёмной главой, корпуса под
// тёмными кровлями, колокольня), краснокирпичный Скорбященский собор с серебристым
// куполом, Никольская церковь с шатровой колокольней и деревянная Троицкая церковь.
// Ниже — терраса с домиками, дамба, пристань с теплоходом и лодкой (покачиваются),
// над островом кружат чайки.
import * as THREE from 'three';
import { Builder, assemble, convexHull, groundShadow, mix, plinth, shade, type Col, type Miniature, type P2, type P3 } from './kit';
import { HELMET, roundTree, tree } from './archi';

// ---------- палитра ----------
const WHITE = 'stoneWhite';
const WHITE_TOP = shade('stoneWhite', 0.86);
const WHITE_TRIM = shade('stoneWhite', 0.93);
const DARK_ROOF = mix('roofDark', 'steel', 0.25); // тёмно-серые кровли корпусов
const DOME_DARK = mix('roofDark', 'roofGreen', 0.35); // тёмная глава собора
const RED = 'brickRed';
const RED_TOP = shade('brickRed', 0.82);
const SILVER = mix('steel', 'stoneWhite', 0.45);
const GLASS = mix('roofDark', 'glass', 0.35);
const HOLE = shade('roofDark', 0.8);
const SAND = mix('stoneSand', 'stoneWhite', 0.15);
const GRASS = 'lowland';
const SHALLOW = mix('water', 'glass', 0.45);

/** Луковица. */
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

/** Окна по граням многогранного тела. */
function ringWindows(b: Builder, r: number, seg: number, y: number, w: number, h: number, color: Col, phase = 0, every = 1): void {
  const ap = r * Math.cos(Math.PI / seg) + 0.012;
  for (let j = 0; j < seg; j += every) {
    const m = phase + ((j + 0.5) / seg) * Math.PI * 2;
    archWin(b, w, h, color, [Math.sin(m) * ap, y, Math.cos(m) * ap], m);
  }
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
    let px = (lo[i][0] + lo[j][0] - hi[i][0] - hi[j][0]) / 2;
    let pz = (lo[i][1] + lo[j][1] - hi[i][1] - hi[j][1]) / 2;
    const run = Math.hypot(px, pz);
    if (run < 1e-6) {
      px = lo[i][0];
      pz = lo[i][1];
    }
    const pl = Math.hypot(px, pz) || 1;
    const want: P3 = [(px / pl) * (yhi - ylo), Math.max(run, 0.02), (pz / pl) * (yhi - ylo)];
    const c = shade(color(i), 0.95 + 0.07 * Math.sin(i * 2.3));
    const a: P3 = [lo[i][0], ylo, lo[i][1]];
    const bb: P3 = [lo[j][0], ylo, lo[j][1]];
    const d: P3 = [hi[j][0], yhi, hi[j][1]];
    const e: P3 = [hi[i][0], yhi, hi[i][1]];
    b.tri(a, bb, d, c, want, { ao: false, shadow: false });
    b.tri(a, d, e, c, want, { ao: false, shadow: false });
  }
}

// ---------- остров ----------
const N = 36;
const IC: P2 = [0.1, 0.15]; // центр острова
const PC: P2 = [-0.2, -0.3]; // центр плато (смещён на северо-запад — к крутому берегу)

/** Радиус береговой линии острова в направлении a (вытянутый, с неровностями). */
function R(a: number): number {
  const ca = Math.cos(a - 0.3);
  const sa = Math.sin(a - 0.3);
  const e = 1 / Math.sqrt((ca / 3.95) ** 2 + (sa / 3.05) ** 2);
  return e * (1 + 0.035 * Math.sin(3 * a + 1) + 0.025 * Math.sin(5 * a + 2));
}
function island(k: number, c: P2): P2[] {
  const out: P2[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = R(a) * k;
    out.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
  }
  return out;
}

// ---------- постройки ----------

/** Кокошник-щипец (килевидный), смотрит в +Z; верхние кромки тёмные. */
function kokoshnik(b: Builder, at: P3, w: number, h: number, ry = 0): void {
  const pts: P2[] = [
    [-w, 0],
    [w, 0],
    [w, h * 0.35],
    [w * 0.5, h * 0.62],
    [0, h],
    [-w * 0.5, h * 0.62],
    [-w, h * 0.35],
  ];
  b.profile(pts, 0.1, WHITE, { at, ry }, { caps: WHITE, faces: [undefined, WHITE, DARK_ROOF, DARK_ROOF, DARK_ROOF, DARK_ROOF, WHITE] });
}

/** Успенский собор: высокий четверик с кокошниками, барабан с поясами, тёмная глава с «юбкой». */
function assumptionCathedral(b: Builder, at: P3, ry: number): void {
  b.group(
    { at, ry },
    () => {
      const W = 1.15;
      const H = 1.35;
      b.box(W, H, W, WHITE, undefined, { top: WHITE_TOP });
      b.box(W + 0.06, 0.06, W + 0.06, WHITE_TRIM, { at: [0, H - 0.06, 0] });
      for (let k = 0; k < 4; k++) {
        b.group({ ry: (k * Math.PI) / 2 }, () => {
          for (const x of [-0.37, 0, 0.37]) kokoshnik(b, [x, H, W / 2 - 0.05], 0.17, 0.42);
          for (const x of [-0.33, 0, 0.33]) b.rect(0.1, 0.18, GLASS, { at: [x, 0.75, W / 2 + 0.006] });
          b.rect(0.1, 0.16, GLASS, { at: [0.33, 0.3, W / 2 + 0.006] });
        });
      }
      archWin(b, 0.2, 0.3, HOLE, [-0.0, 0, W / 2 + 0.008]);
      b.pyramid(W - 0.1, W - 0.1, 0.25, DARK_ROOF, { at: [0, H, 0] });
      // восточная апсида (+X)
      b.cyl(0.38, 0.38, 0.95, 8, WHITE, { at: [W / 2, 0, 0] }, { top: DARK_ROOF });
      // барабан с поясами
      const dy = H + 0.12;
      b.cyl(0.33, 0.33, 0.62, 10, WHITE, { at: [0, dy, 0] }, { top: false });
      b.cyl(0.355, 0.355, 0.05, 10, WHITE_TRIM, { at: [0, dy + 0.22, 0] }, { top: false });
      b.cyl(0.355, 0.355, 0.05, 10, WHITE_TRIM, { at: [0, dy + 0.5, 0] }, { top: false });
      ringWindows(b, 0.33, 10, dy + 0.3, 0.05, 0.13, HOLE, 0, 2);
      // глава: свес-«юбка», луковица, шейка, малая главка, крест
      const gy = dy + 0.62;
      b.lathe(
        [
          [0.5, gy - 0.02],
          [0.36, gy + 0.1],
          [0.42, gy + 0.22],
          [0.44, gy + 0.34],
          [0.36, gy + 0.5],
          [0.2, gy + 0.64],
          [0.09, gy + 0.72],
        ],
        12,
        DOME_DARK,
        undefined,
        { capTop: false },
      );
      b.cyl(0.5, 0.5, 0.02, 12, shade(DOME_DARK, 0.8), { at: [0, gy - 0.04, 0] }, { top: false, bottom: true });
      b.cyl(0.08, 0.08, 0.12, 6, DOME_DARK, { at: [0, gy + 0.7, 0] }, { top: false });
      b.lathe(prof(ONION_S, 0.11, 0.2, gy + 0.8), 6, DOME_DARK);
      cross(b, [0, gy + 0.98, 0], 0.75);
    },
    { shadowGroup: true },
  );
}

/** Корпус с рядами окон и тёмной вальмовой кровлей. */
function block(b: Builder, at: P3, ry: number, len: number, dep: number, h: number, wall: Col = WHITE, roof: Col = DARK_ROOF): void {
  b.group(
    { at, ry },
    () => {
      b.box(len, h, dep, wall, undefined, { top: shade(wall, 0.88) });
      b.gable(len - dep * 0.6, dep + 0.08, 0.26, roof, { at: [dep * 0, h, 0] }, { ends: roof });
      b.pyramid(dep + 0.02, dep + 0.08, 0.26, roof, { at: [len / 2 - dep * 0.3 - 0.01, h, 0], s: [0.6, 1, 1] });
      b.pyramid(dep + 0.02, dep + 0.08, 0.26, roof, { at: [-len / 2 + dep * 0.3 + 0.01, h, 0], s: [0.6, 1, 1] });
      const n = Math.max(1, Math.floor(len / 0.24));
      for (const s of [1, -1]) {
        b.group({ ry: s > 0 ? 0 : Math.PI }, () => {
          for (let i = 0; i < n; i++) {
            const x = (i - (n - 1) / 2) * (len / n);
            b.rect(0.07, 0.13, GLASS, { at: [x, h * 0.55, dep / 2 + 0.006] });
            if (h > 0.6) b.rect(0.07, 0.11, GLASS, { at: [x, h * 0.15, dep / 2 + 0.006] });
          }
        });
      }
      // печные трубы
      b.box(0.06, 0.18, 0.06, WHITE, { at: [len * 0.2, h + 0.12, 0.05] });
      b.box(0.06, 0.18, 0.06, WHITE, { at: [-len * 0.25, h + 0.12, -0.05] });
    },
    { shadowGroup: true },
  );
}

/** Колокольня монастыря: ярусы-четверики, восьмерик со звоном, тёмная главка. */
function belfry(b: Builder, at: P3): void {
  b.group(
    { at },
    () => {
      b.box(0.62, 0.8, 0.62, WHITE, undefined, { top: WHITE_TOP });
      b.box(0.68, 0.05, 0.68, WHITE_TRIM, { at: [0, 0.8, 0] });
      b.box(0.5, 0.55, 0.5, WHITE, { at: [0, 0.85, 0] }, { top: WHITE_TOP });
      for (let k = 0; k < 4; k++)
        archWin(b, 0.16, 0.26, HOLE, [Math.sin((k * Math.PI) / 2) * 0.256, 0.95, Math.cos((k * Math.PI) / 2) * 0.256], (k * Math.PI) / 2);
      b.cyl(0.21, 0.21, 0.4, 8, WHITE, { at: [0, 1.4, 0] }, { phase: Math.PI / 8, top: false });
      ringWindows(b, 0.21, 8, 1.48, 0.07, 0.17, HOLE, Math.PI / 8, 2);
      b.lathe(prof(HELMET, 0.24, 0.3, 1.8), 8, DOME_DARK, undefined, { phase: Math.PI / 8 });
      b.cyl(0.05, 0.05, 0.12, 6, 'gold', { at: [0, 2.08, 0] }, { top: false });
      b.lathe(prof(ONION_S, 0.08, 0.15, 2.18), 6, 'gold');
      cross(b, [0, 2.32, 0], 0.6);
    },
    { shadowGroup: true },
  );
}

/** Скорбященский собор: красный кирпич, высокий барабан с окнами, серебристый купол, колокольня. */
function sorrowCathedral(b: Builder, at: P3, ry: number): void {
  b.group(
    { at, ry, s: 0.88 },
    () => {
      // крестообразный объём
      b.box(1.3, 0.9, 0.7, RED, undefined, { top: RED_TOP });
      b.box(0.7, 0.9, 1.3, RED, undefined, { top: RED_TOP });
      for (const r of [0, Math.PI / 2]) b.gable(1.36, 0.76, 0.22, SILVER, { at: [0, 0.9, 0], ry: r }, { ends: RED });
      for (let k = 0; k < 4; k++) {
        b.group({ ry: (k * Math.PI) / 2 }, () => {
          archWin(b, 0.14, 0.32, WHITE_TRIM, [0, 0.35, 0.656]);
          archWin(b, 0.1, 0.24, GLASS, [0, 0.38, 0.66]);
        });
      }
      // барабан и купол
      b.cyl(0.34, 0.34, 0.5, 12, RED, { at: [0, 1.0, 0] }, { top: false });
      ringWindows(b, 0.34, 12, 1.1, 0.06, 0.2, GLASS, 0, 1);
      b.cyl(0.37, 0.37, 0.05, 12, WHITE_TRIM, { at: [0, 1.5, 0] }, { top: false });
      b.lathe(
        [
          [0.37, 1.55],
          [0.36, 1.68],
          [0.3, 1.82],
          [0.19, 1.93],
          [0.06, 1.99],
          [0, 2.0],
        ],
        12,
        SILVER,
      );
      b.cyl(0.04, 0.04, 0.1, 5, 'gold', { at: [0, 1.98, 0] }, { top: false });
      b.lathe(prof(ONION_S, 0.07, 0.12, 2.06), 6, 'gold');
      cross(b, [0, 2.18, 0], 0.55);
      // четыре малые главки
      for (const [x, z] of [
        [-0.42, -0.42],
        [0.42, -0.42],
        [-0.42, 0.42],
        [0.42, 0.42],
      ] as P2[]) {
        b.cyl(0.1, 0.1, 0.25, 6, RED, { at: [x, 0.9, z] }, { top: false });
        b.lathe(prof(ONION_S, 0.12, 0.2, 1.15), 6, SILVER, { at: [x, 0, z] });
      }
      // колокольня с запада (−X)
      b.group({ at: [-0.95, 0, 0] }, () => {
        b.box(0.5, 1.2, 0.5, RED, undefined, { top: RED_TOP });
        b.box(0.54, 0.05, 0.54, WHITE_TRIM, { at: [0, 1.2, 0] });
        b.box(0.4, 0.45, 0.4, RED, { at: [0, 1.25, 0] }, { top: RED_TOP });
        for (let k = 0; k < 4; k++)
          archWin(b, 0.14, 0.22, HOLE, [Math.sin((k * Math.PI) / 2) * 0.206, 1.3, Math.cos((k * Math.PI) / 2) * 0.206], (k * Math.PI) / 2);
        b.pyramid(0.44, 0.44, 0.5, SILVER, { at: [0, 1.7, 0] });
        cross(b, [0, 2.18, 0], 0.5);
      });
    },
    { shadowGroup: true },
  );
}

/** Никольская церковь с шатровой колокольней. */
function nikolskaya(b: Builder, at: P3, ry: number): void {
  b.group(
    { at, ry },
    () => {
      b.box(0.8, 0.6, 0.6, WHITE, { at: [0.45, 0, 0] }, { top: WHITE_TOP });
      b.gable(0.86, 0.66, 0.22, 'roofGreen', { at: [0.45, 0.6, 0] }, { ends: WHITE });
      b.cyl(0.1, 0.1, 0.2, 6, WHITE, { at: [0.55, 0.75, 0] }, { top: false });
      b.lathe(prof(ONION_S, 0.13, 0.22, 0.95), 6, 'roofGreen', { at: [0.55, 0, 0] });
      cross(b, [0.55, 1.15, 0], 0.5);
      for (const s of [1, -1]) b.rect(0.08, 0.16, GLASS, { at: [0.45, 0.28, s * 0.306], ry: s > 0 ? 0 : Math.PI });
      // колокольня
      b.box(0.55, 0.85, 0.55, WHITE, undefined, { top: WHITE_TOP });
      b.box(0.44, 0.45, 0.44, WHITE, { at: [0, 0.85, 0] }, { top: WHITE_TOP });
      for (let k = 0; k < 4; k++)
        archWin(b, 0.14, 0.22, HOLE, [Math.sin((k * Math.PI) / 2) * 0.226, 0.92, Math.cos((k * Math.PI) / 2) * 0.226], (k * Math.PI) / 2);
      b.cyl(0.24, 0.24, 0.12, 8, WHITE_TRIM, { at: [0, 1.3, 0] }, { phase: Math.PI / 8 });
      b.lathe(
        [
          [0.27, 1.42],
          [0.03, 2.35],
        ],
        8,
        'roofGreen',
        undefined,
        { phase: Math.PI / 8, capTop: false },
      );
      b.lathe(prof(ONION_S, 0.06, 0.12, 2.32), 6, 'gold');
      cross(b, [0, 2.44, 0], 0.5);
    },
    { shadowGroup: true },
  );
}

/** Деревянная Троицкая церковь (1551). */
function trinity(b: Builder, at: P3, ry: number): void {
  const log = shade('wood', 0.8);
  const shingle = mix('steel', 'wood', 0.4);
  b.group(
    { at, ry },
    () => {
      b.box(0.75, 0.5, 0.45, log, undefined, { top: shade(log, 0.9) });
      b.gable(0.82, 0.55, 0.3, shingle, { at: [0, 0.5, 0] }, { ends: log });
      b.pyramid(0.36, 0.36, 0.2, shingle, { at: [0.48, 0.42, 0] });
      b.box(0.3, 0.42, 0.3, log, { at: [0.48, 0, 0] });
      b.cyl(0.07, 0.07, 0.18, 6, log, { at: [-0.1, 0.72, 0] }, { top: false });
      b.lathe(prof(ONION_S, 0.12, 0.2, 0.88), 6, shingle, { at: [-0.1, 0, 0] });
      cross(b, [-0.1, 1.06, 0], 0.45);
    },
    { shadowGroup: true },
  );
}

/** Домик: сруб/каменный низ и двускатная кровля. */
function house(b: Builder, at: P3, ry: number, wall: Col, roof: Col, s = 1): void {
  b.group(
    { at, ry, s },
    () => {
      b.box(0.5, 0.32, 0.38, wall, undefined, { top: shade(wall, 0.9) });
      b.gable(0.56, 0.44, 0.2, roof, { at: [0, 0.32, 0] }, { ends: wall });
      b.rect(0.07, 0.09, GLASS, { at: [-0.1, 0.12, 0.191] });
      b.rect(0.07, 0.09, GLASS, { at: [0.1, 0.12, 0.191] });
    },
    { shadowGroup: true },
  );
}

export function buildSviyazhsk(): Miniature {
  const b = new Builder();
  const G = plinth(b, 'water', { side: shade('waterDeep', 0.9) });
  // отмель вокруг острова
  b.flat(island(1.1, [IC[0] - 0.02, IC[1]]), G + 0.006, SHALLOW);

  const TERR = G + 0.34; // нижняя терраса со слободой
  const Y = G + 1.25; // плато с монастырями
  const shore = island(1.0, IC);
  const beach = island(0.965, IC);
  const terrOut = island(0.875, IC);
  const terrIn = island(0.79, IC);
  const plateau = island(0.6, PC);
  slope(b, shore, G, beach, G + 0.07, () => mix('stoneSand', 'stoneWhite', 0.2));
  slope(b, beach, G + 0.07, terrOut, TERR - 0.03, (i) => (i % 5 === 2 ? mix(GRASS, 'stoneSand', 0.35) : GRASS));
  slope(b, terrOut, TERR - 0.03, terrIn, TERR, () => mix(GRASS, 'plain', 0.3));
  slope(b, terrIn, TERR, plateau, Y, (i) => (i % 7 === 3 ? mix('stoneSand', GRASS, 0.5) : mix(GRASS, 'forest', 0.3)));
  b.flat(plateau, Y, mix('plain', GRASS, 0.4));
  b.shadowPlane = { y: Y, poly: convexHull(plateau), color: groundShadow(mix('plain', GRASS, 0.4)) };

  // дорожки на плато
  b.flat(
    [
      [-1.75, 0.15],
      [1.4, -0.35],
      [1.45, -0.15],
      [-1.7, 0.38],
    ],
    Y + 0.01,
    SAND,
  );

  // Успенский монастырь: корпуса по периметру двора, собор, колокольня
  assumptionCathedral(b, [-0.75, Y, -0.95], 0.15);
  block(b, [-0.55, Y, -2.15], 0.12, 2.0, 0.5, 0.6);
  block(b, [-2.05, Y, -1.0], 0.12 + Math.PI / 2, 1.3, 0.48, 0.75);
  block(b, [0.55, Y, -1.25], 0.12 + Math.PI / 2, 0.9, 0.42, 0.5);
  belfry(b, [0.75, Y, -2.0]);
  // ограда монастыря с юга
  b.group({ at: [-0.85, Y, 0.0], ry: 0.12 }, () => {
    b.box(2.2, 0.28, 0.08, WHITE, undefined, { top: WHITE_TOP });
    b.box(0.4, 0.42, 0.14, WHITE, { at: [0.2, 0, 0] }, { top: WHITE_TOP });
    b.gable(0.44, 0.2, 0.1, DARK_ROOF, { at: [0.2, 0.42, 0] }, { ends: WHITE });
    archWin(b, 0.18, 0.22, HOLE, [0.2, 0, 0.072]);
  });

  sorrowCathedral(b, [1.4, Y, 0.3], -0.6);
  nikolskaya(b, [-1.35, Y, 0.95], 0.35);
  trinity(b, [-0.2, Y, 1.05], 0.2);

  // деревья на плато
  roundTree(b, 0.3, 0.75, Y, 0.45);
  roundTree(b, -2.0, 0.35, Y, 0.45);
  roundTree(b, 0.05, -0.25, Y, 0.4);
  tree(b, 2.1, -0.6, Y, 0.4);
  tree(b, -0.75, 1.55, Y, 0.4);

  // ---------- терраса и вода: отдельный меш со своей плоскостью теней ----------
  const t = new Builder();
  t.shadowPlane = { y: TERR, poly: convexHull(terrOut), color: groundShadow(GRASS) };
  // точка на террасе в направлении a
  const onTerr = (a: number, k = 0.83): P2 => [IC[0] + Math.cos(a) * R(a) * k, IC[1] + Math.sin(a) * R(a) * k];
  const roofs: Col[] = [
    'brickRed',
    'roofGreen',
    'roofBlue',
    'brickRed',
    'roofGreen',
    'brickRed',
    'roofBlue',
    'roofGreen',
    'brickRed',
    'roofGreen',
    'roofBlue',
    'brickRed',
    'roofGreen',
  ];
  const walls: Col[] = ['wood', SAND, 'wood', 'stoneWhite', shade('wood', 1.1), SAND, 'wood', 'stoneWhite', 'wood', SAND, 'wood', 'stoneWhite', SAND];
  const angles = [0.5, 0.72, 0.95, 1.3, 1.52, 3.4, 2.25, -0.25, -0.05, 2.55, 3.9, 4.6, 5.3];
  angles.forEach((a, i) => {
    const [x, z] = onTerr(a, i % 2 ? 0.84 : 0.82);
    house(t, [x, TERR, z], -a + Math.PI / 2, walls[i], roofs[i], i % 3 === 0 ? 1.1 : 0.95);
  });
  // краснокирпичный двухэтажный дом у пристани
  {
    const [x, z] = onTerr(1.78, 0.83);
    t.group(
      { at: [x, TERR, z], ry: -1.78 + Math.PI / 2 },
      () => {
        t.box(0.8, 0.55, 0.42, RED, undefined, { top: RED_TOP });
        t.pyramid(0.86, 0.48, 0.2, DARK_ROOF, { at: [0, 0.55, 0] });
        for (const xx of [-0.27, -0.09, 0.09, 0.27]) {
          t.rect(0.07, 0.12, GLASS, { at: [xx, 0.33, 0.212] });
          t.rect(0.07, 0.12, GLASS, { at: [xx, 0.1, 0.212] });
        }
      },
      { shadowGroup: true },
    );
  }
  // деревья на склонах (по поверхности склона между террасой и плато)
  const onSlope = (i: number, s: number): P3 => {
    const p = terrIn[i];
    const q = plateau[i];
    return [p[0] + (q[0] - p[0]) * s, TERR + (Y - TERR) * s, p[1] + (q[1] - p[1]) * s];
  };
  for (const [i, s, sc, round] of [
    [2, 0.35, 0.5, true],
    [5, 0.5, 0.45, false],
    [8, 0.3, 0.5, true],
    [11, 0.45, 0.45, true],
    [13, 0.3, 0.5, false],
    [16, 0.4, 0.45, true],
    [19, 0.35, 0.5, true],
    [22, 0.5, 0.45, false],
    [25, 0.3, 0.5, true],
    [28, 0.4, 0.45, true],
    [31, 0.35, 0.45, false],
    [34, 0.45, 0.5, true],
  ] as [number, number, number, boolean][]) {
    const [x, y, z] = onSlope(i, s);
    if (round) roundTree(t, x, z, y - 0.05, sc, i % 2 ? 'forest' : mix('forest', 'lowland', 0.3));
    else tree(t, x, z, y - 0.05, sc);
  }
  for (const a of [0.2, 1.1, 1.8, 2.8, 3.4, 4.2, 5.0, 5.6]) {
    const [x, z] = onTerr(a, 0.86);
    roundTree(t, x, z, TERR - 0.02, 0.4, mix('forest', 'lowland', 0.25));
  }

  // дамба с дорогой к западному берегу
  const da = Math.PI + 0.15;
  const [dx0, dz0] = onTerr(da, 0.95);
  const dLen = 4.7 - Math.hypot(dx0, dz0) - 0.02;
  t.group({ at: [dx0 + (Math.cos(da) * dLen) / 2, G, dz0 + (Math.sin(da) * dLen) / 2], ry: -da, shadow: false }, () => {
    t.box(dLen, 0.08, 0.5, mix('stoneSand', 'steel', 0.3), undefined, { top: mix(GRASS, 'stoneSand', 0.4) });
    t.box(dLen, 0.01, 0.22, mix('roofDark', 'steel', 0.4), { at: [0, 0.08, 0] });
  });

  // пристань
  const pa = 1.45;
  const [px, pz] = onTerr(pa, 1.02);
  t.group({ at: [px, G, pz], ry: -pa + Math.PI / 2, shadow: false }, () => {
    t.box(0.16, 0.06, 0.4, 'wood', { at: [0, 0, 0.1] }, { top: shade('wood', 1.1) });
    t.box(1.0, 0.1, 0.28, mix('stoneWhite', 'roofBlue', 0.15), { at: [0, 0, 0.42] }, { top: 'roofBlue' });
  });

  // ---------- анимированные: теплоход, лодка, чайки ----------
  const a = new Builder(G);
  const shipAt: P3 = [px + Math.cos(pa) * 0.76, G, pz + Math.sin(pa) * 0.76];
  a.group({ at: shipAt, ry: -pa + Math.PI / 2 }, () => {
    a.profile(
      [
        [-1.0, 0],
        [0.85, 0],
        [1.12, 0.18],
        [-1.05, 0.18],
      ],
      0.34,
      WHITE,
      undefined,
      { caps: WHITE_TRIM, faces: ['roofBlue', 'roofBlue', WHITE_TOP, 'roofBlue'] },
    );
    a.box(1.55, 0.14, 0.28, WHITE, { at: [-0.1, 0.18, 0] }, { top: WHITE_TOP });
    a.box(1.25, 0.13, 0.25, WHITE, { at: [-0.15, 0.32, 0] }, { top: WHITE_TOP });
    a.box(0.42, 0.1, 0.22, WHITE, { at: [0.22, 0.45, 0] }, { top: 'accent' });
    for (const s of [1, -1]) {
      a.group({ ry: s > 0 ? 0 : Math.PI }, () => {
        a.rect(1.45, 0.05, GLASS, { at: [-0.1 * s, 0.23, 0.142] });
        a.rect(1.15, 0.05, GLASS, { at: [-0.15 * s, 0.37, 0.127] });
      });
    }
  });
  const shipEnd = a.triangles;
  const boatAt: P3 = [-2.6, G, 3.25];
  a.group({ at: boatAt, ry: 0.5 }, () => {
    a.profile(
      [
        [-0.26, 0],
        [0.22, 0],
        [0.32, 0.09],
        [-0.3, 0.09],
      ],
      0.16,
      'wood',
      undefined,
      { caps: shade('wood', 0.8) },
    );
    a.box(0.05, 0.12, 0.05, 'accent', { at: [0, 0.05, 0] });
  });
  const boatEnd = a.triangles;
  const gullC: P2 = [-0.3, -0.5];
  const gulls: [number, number, number][] = [
    [2.0, Y + 3.3, 0.4],
    [2.4, Y + 3.7, 2.6],
    [1.7, Y + 4.0, 4.4],
  ];
  for (const [r, y, ph] of gulls) {
    a.group({ at: [gullC[0] + Math.cos(ph) * r, y, gullC[1] + Math.sin(ph) * r], ry: -ph }, () => {
      for (const sx of [1, -1]) {
        for (const ny of [1, -1]) a.tri([0, 0, -0.04], [0, 0, 0.06], [sx * 0.17, 0.05, -0.02], WHITE, [0, ny, 0], { shadow: false });
      }
    });
  }

  const mini = assemble('sviyazhsk', [b, t, a]);
  const mesh = mini.group.children[2] as THREE.Mesh;
  const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  const rest = Float32Array.from(pos.array as Float32Array);
  const out = pos.array as Float32Array;
  mesh.geometry.boundingSphere!.set(new THREE.Vector3(0, 2.5, 0), 5.5);
  const vShip = shipEnd * 9;
  const vBoat = boatEnd * 9;
  mini.update = (time: number) => {
    const bob = 0.02 * Math.sin(time * 1.3);
    const roll = 0.03 * Math.sin(time * 0.9 + 1);
    const ca = Math.cos(pa);
    const sa = Math.sin(pa);
    for (let i = 0; i < vShip; i += 3) {
      const across = (rest[i] - shipAt[0]) * ca + (rest[i + 2] - shipAt[2]) * sa;
      out[i + 1] = Math.max(0, rest[i + 1] + bob + roll * across);
    }
    const bob2 = 0.02 * Math.sin(time * 2.1 + 1.5);
    const pitch = 0.06 * Math.sin(time * 2.1);
    for (let i = vShip; i < vBoat; i += 3) out[i + 1] = Math.max(0, rest[i + 1] + bob2 + pitch * (rest[i] - boatAt[0]));
    const ang = time * 0.3;
    const c = Math.cos(ang);
    const sn = Math.sin(ang);
    for (let i = vBoat; i < out.length; i += 3) {
      const k = Math.floor((i - vBoat) / 36);
      const x = rest[i] - gullC[0];
      const z = rest[i + 2] - gullC[1];
      out[i] = gullC[0] + x * c - z * sn;
      out[i + 2] = gullC[1] + x * sn + z * c;
      out[i + 1] = rest[i + 1] + 0.12 * Math.sin(time * 0.8 + k * 2);
    }
    pos.needsUpdate = true;
  };
  mini.update(0);
  return mini;
}
