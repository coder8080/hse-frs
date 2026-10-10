// Казанский кремль на холме над Казанкой: белые стены под деревянной кровлей,
// круглые башни с тесовыми шатрами, ярусная Спасская башня с часами, Кул-Шариф
// с четырьмя минаретами, красная падающая башня Сююмбике, пятиглавый
// Благовещенский собор, Губернаторский дворец с флагом Татарстана (анимирован)
// и лодка на реке (покачивается).
import * as THREE from 'three';
import { Builder, assemble, clipConvex, convexHull, groundShadow, mix, plinth, ringXZ, shade, type Col, type Miniature, type P2, type P3 } from './kit';
import { MOSQUE_DOME, ONION, roundTree, spire, tree } from './archi';

// ---------- палитра ----------
const WHITE = 'stoneWhite';
const WHITE_TOP = shade('stoneWhite', 0.86);
const WHITE_TRIM = shade('stoneWhite', 0.93);
const TEC = shade(mix('steel', 'wood', 0.25), 1.05); // тёс кровли стен и башен
const TEC_DARK = shade(TEC, 0.85);
const TURQ = mix(mix('water', 'roofGreen', 0.5), 'glass', 0.3); // бирюза Кул-Шарифа
const TURQ_DARK = shade(TURQ, 0.8);
const GLASS = mix('roofDark', 'glass', 0.35);
const HOLE = shade('roofDark', 0.8);
const RED = 'brickRed';
const RED_TOP = shade('brickRed', 0.82);
const BLUE = mix('roofBlue', 'kamazBlue', 0.4);
const PAVE = mix('stoneSand', 'stoneWhite', 0.35);
const GREEN_ROOF = 'roofGreen';

/** Гладкая луковица (больше точек профиля, чем в ONION). */
const ONION_S: P2[] = [
  [0.55, 0],
  [0.8, 0.1],
  [0.97, 0.24],
  [1, 0.36],
  [0.93, 0.5],
  [0.74, 0.64],
  [0.48, 0.77],
  [0.24, 0.88],
  [0.09, 0.96],
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

/** Окна по граням многогранного барабана (вершины как у lathe с тем же seg/phase). */
function ringWindows(b: Builder, r: number, seg: number, y: number, w: number, h: number, color: Col, phase = 0, every = 1): void {
  const ap = r * Math.cos(Math.PI / seg) + 0.012;
  for (let j = 0; j < seg; j += every) {
    const m = phase + ((j + 0.5) / seg) * Math.PI * 2;
    archWin(b, w, h, color, [Math.sin(m) * ap, y, Math.cos(m) * ap], m);
  }
}

/** Православный крест: стойка и перекладина. */
function cross(b: Builder, at: P3, s = 1): void {
  b.group({ at, s }, () => {
    b.box(0.03, 0.34, 0.03, 'gold', undefined);
    b.box(0.18, 0.03, 0.03, 'gold', { at: [0, 0.22, 0] });
  });
}

/** Полумесяц на шпиле: плоский серп в плоскости XY. */
function crescent(b: Builder, at: P3, r: number): void {
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
  b.profile(pts, 0.03, 'gold', { at, shadow: false });
}

/** Склон между двумя кольцами с одинаковым числом точек (холм, берег). */
function slope(b: Builder, lo: P2[], ylo: number, hi: P2[], yhi: number, color: Col): void {
  const n = lo.length;
  let cx = 0;
  let cz = 0;
  for (const [x, z] of hi) {
    cx += x / n;
    cz += z / n;
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ex = lo[j][0] - lo[i][0];
    const ez = lo[j][1] - lo[i][1];
    let px = ez;
    let pz = -ex;
    const mx = (lo[i][0] + lo[j][0]) / 2;
    const mz = (lo[i][1] + lo[j][1]) / 2;
    if (px * (mx - cx) + pz * (mz - cz) < 0) {
      px = -px;
      pz = -pz;
    }
    const pl = Math.hypot(px, pz) || 1;
    px /= pl;
    pz /= pl;
    const run = Math.max(0.02, (mx - (hi[i][0] + hi[j][0]) / 2) * px + (mz - (hi[i][1] + hi[j][1]) / 2) * pz);
    const want: P3 = [px * (yhi - ylo), run, pz * (yhi - ylo)];
    const a: P3 = [lo[i][0], ylo, lo[i][1]];
    const c: P3 = [lo[j][0], ylo, lo[j][1]];
    const d: P3 = [hi[j][0], yhi, hi[j][1]];
    const e: P3 = [hi[i][0], yhi, hi[i][1]];
    const shade2 = shade(color, 0.96 + 0.08 * Math.sin(i * 2.3));
    b.tri(a, c, d, shade2, want, { ao: false, shadow: false });
    b.tri(a, d, e, shade2, want, { ao: false, shadow: false });
  }
}

/** Сдвинуть точки многоугольника радиально наружу на d. */
function push(pts: P2[], d: number): P2[] {
  return pts.map(([x, z]) => {
    const l = Math.hypot(x, z) || 1;
    return [x + (x / l) * d, z + (z / l) * d];
  });
}

/** Разбить замкнутый многоугольник: на каждом ребре k промежуточных точек. */
function densify(pts: P2[], k: number): P2[] {
  const out: P2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[(i + 1) % pts.length];
    for (let s = 0; s <= k; s++) out.push([x0 + ((x1 - x0) * s) / (k + 1), z0 + ((z1 - z0) * s) / (k + 1)]);
  }
  return out;
}

// ---------- постройки ----------

/** Прясло стены: белая кладка, бойницы, двускатная тесовая кровля. */
function wallSpan(b: Builder, from: P2, to: P2, Y: number): void {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const ry = Math.atan2(-dz, dx);
  const H = 0.72;
  b.group(
    { at: [(from[0] + to[0]) / 2, Y, (from[1] + to[1]) / 2], ry },
    () => {
      b.box(len, H, 0.26, WHITE, undefined, { top: WHITE_TOP });
      b.box(len, 0.06, 0.32, WHITE_TRIM, { at: [0, H, 0] });
      b.gable(len, 0.36, 0.14, TEC, { at: [0, H + 0.06, 0] }, { ends: WHITE_TRIM });
      // бойницы с обеих сторон
      const n = Math.max(2, Math.floor(len / 0.42));
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * (len / n);
        b.rect(0.07, 0.12, HOLE, { at: [x, H - 0.24, 0.131] });
        b.rect(0.07, 0.12, HOLE, { at: [x, H - 0.24, -0.131], ry: Math.PI });
      }
    },
    { shadowGroup: true },
  );
}

/** Круглая угловая башня с бойницами и тесовым шатром. */
function roundTower(b: Builder, at: P3, r = 0.4, h = 1.15, flag = false): void {
  b.group(
    { at },
    () => {
      b.cyl(r * 1.04, r, h, 10, WHITE, undefined, { top: false });
      ringWindows(b, r, 10, h * 0.6, 0.06, 0.12, HOLE, 0, 2);
      // свес и шатёр
      b.lathe(
        [
          [r * 1.2, h - 0.02],
          [r * 1.06, h + 0.1],
          [0, h + r * 1.85],
        ],
        10,
        TEC,
        undefined,
        { bands: [TEC_DARK, TEC] },
      );
      b.cyl(r * 1.2, r * 1.2, 0.02, 10, TEC_DARK, { at: [0, h - 0.04, 0] }, { top: false, bottom: true });
      if (flag) {
        b.box(0.025, 0.4, 0.025, 'roofDark', { at: [0, h + r * 1.8, 0] });
        b.profile(
          [
            [0, 0],
            [0.22, 0.02],
            [0.22, 0.14],
            [0, 0.14],
          ],
          0.015,
          'roofDark',
          { at: [0.012, h + r * 1.8 + 0.24, 0], shadow: false },
        );
      }
    },
    { shadowGroup: true },
  );
}

/** Спасская башня: ворота, ярус с часами, восьмерик-звонница с арками, белый шатёр. */
function spasskaya(b: Builder, at: P3, ry: number): void {
  b.group(
    { at, ry },
    () => {
      // нижний четверик с воротами и пристроенным отводным объёмом
      b.box(1.05, 1.35, 1.05, WHITE, undefined, { top: WHITE_TOP });
      b.box(0.8, 0.85, 0.7, WHITE, { at: [0, 0, 0.75] }, { top: WHITE_TOP });
      b.gable(0.86, 0.76, 0.22, GREEN_ROOF, { at: [0, 0.85, 0.75], ry: Math.PI / 2 }, { ends: WHITE_TRIM });
      archWin(b, 0.34, 0.42, HOLE, [0, 0, 1.101]);
      b.box(1.12, 0.07, 1.12, WHITE_TRIM, { at: [0, 1.35, 0] });
      // второй четверик с часами
      b.box(0.82, 0.75, 0.82, WHITE, { at: [0, 1.42, 0] }, { top: WHITE_TOP });
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2;
        b.group({ ry: a }, () => {
          b.disc(0.2, 10, WHITE_TRIM, { at: [0, 1.82, 0.414] });
          b.disc(0.16, 10, mix('stoneWhite', 'roofDark', 0.12), {
            at: [0, 1.82, 0.418],
          });
          b.box(0.02, 0.12, 0.01, 'roofDark', {
            at: [0, 1.82, 0.425],
            shadow: false,
          });
          b.box(0.09, 0.02, 0.01, 'roofDark', {
            at: [0.04, 1.82, 0.425],
            shadow: false,
          });
        });
      }
      b.pyramid(1.0, 1.0, 0.18, GREEN_ROOF, { at: [0, 2.17, 0] });
      // восьмерик-звонница
      b.cyl(0.38, 0.38, 0.6, 8, WHITE, { at: [0, 2.2, 0] }, { phase: Math.PI / 8, top: WHITE_TOP });
      ringWindows(b, 0.38, 8, 2.3, 0.14, 0.26, HOLE, Math.PI / 8);
      b.cyl(0.43, 0.43, 0.06, 8, WHITE_TRIM, { at: [0, 2.8, 0] }, { phase: Math.PI / 8 });
      // верхний восьмерик и шатёр
      b.cyl(0.3, 0.3, 0.32, 8, WHITE, { at: [0, 2.86, 0] }, { phase: Math.PI / 8, top: false });
      ringWindows(b, 0.3, 8, 2.92, 0.08, 0.14, HOLE, Math.PI / 8, 2);
      b.lathe(
        [
          [0.34, 3.18],
          [0.04, 4.45],
        ],
        8,
        mix('stoneWhite', 'steel', 0.15),
        undefined,
        { phase: Math.PI / 8, capTop: false },
      );
      b.lathe(
        [
          [0.0, 4.43],
          [0.07, 4.5],
          [0.0, 4.58],
        ],
        6,
        'gold',
      );
      spire(b, [0, 4.55, 0], 0.3, 0.025);
      b.cone(0.09, 0.1, 5, 'gold', { at: [0, 4.82, 0], rx: Math.PI }); // звезда-навершие
      b.cone(0.09, 0.1, 5, 'gold', { at: [0, 4.82, 0] });
    },
    { shadowGroup: true },
  );
}

/** Минарет Кул-Шарифа: восьмигранный ствол, два балкона с фонарями, бирюзовый шатёр. */
function kulMinaret(b: Builder, at: P3, h: number, r: number): void {
  b.group(
    { at },
    () => {
      const y1 = h * 0.5;
      const y2 = h * 0.7;
      b.cyl(r * 1.25, r * 1.2, 0.5, 8, WHITE, undefined, {
        top: WHITE_TOP,
        phase: Math.PI / 8,
      });
      b.lathe(
        [
          [r, 0.5],
          [r * 0.9, y1],
        ],
        8,
        WHITE,
        undefined,
        { capTop: false, phase: Math.PI / 8 },
      );
      // первый балкон и фонарь
      b.lathe(
        [
          [r * 0.9, y1 - 0.12],
          [r * 1.45, y1 + 0.02],
          [r * 0.82, y1 + 0.06],
        ],
        8,
        WHITE_TRIM,
        undefined,
        { capTop: false, bands: [WHITE, TURQ], phase: Math.PI / 8 },
      );
      b.cyl(r * 0.82, r * 0.78, y2 - y1 - 0.06, 8, WHITE, { at: [0, y1 + 0.06, 0] }, { top: false, phase: Math.PI / 8 });
      ringWindows(b, r * 0.82, 8, y1 + 0.18, 0.06, 0.2, GLASS, Math.PI / 8, 2);
      // второй балкон
      b.lathe(
        [
          [r * 0.78, y2 - 0.1],
          [r * 1.3, y2 + 0.02],
          [r * 0.7, y2 + 0.05],
        ],
        8,
        WHITE_TRIM,
        undefined,
        { capTop: false, bands: [WHITE, TURQ], phase: Math.PI / 8 },
      );
      const y3 = y2 + h * 0.08;
      b.cyl(r * 0.7, r * 0.68, y3 - y2 - 0.05, 8, WHITE, { at: [0, y2 + 0.05, 0] }, { top: false, phase: Math.PI / 8 });
      // бирюзовый шатёр с перехватом
      b.lathe(
        [
          [r * 0.95, y3],
          [r * 0.62, y3 + 0.14],
          [r * 0.5, y3 + 0.22],
          [r * 0.04, h],
        ],
        8,
        TURQ,
        undefined,
        { bands: [TURQ_DARK, TURQ, TURQ], phase: Math.PI / 8, capTop: false },
      );
      spire(b, [0, h - 0.04, 0], 0.32, 0.025);
      b.lathe(
        [
          [0, h + 0.08],
          [0.05, h + 0.12],
          [0, h + 0.17],
        ],
        5,
        'gold',
      );
    },
    { shadowGroup: true },
  );
}

/** Мечеть Кул-Шариф. */
function kulSharif(b: Builder, at: P3, ry: number): void {
  b.group({ at, ry }, () => {
    b.group(
      {},
      () => {
        // подиум-стилобат со скруглёнными углами
        b.extrude(ringXZ(1.7, 12, Math.PI / 12), 0.42, WHITE_TRIM, undefined, {
          top: mix('stoneWhite', 'stoneSand', 0.25),
        });
        ringWindows(b, 1.7, 12, 0.08, 0.16, 0.22, GLASS, Math.PI / 12, 2);
        // крестообразный объём со стрельчатыми щипцами: бирюзовые скаты
        const W = 0.95;
        const H = 1.35;
        const sec: P2[] = [
          [-W, 0],
          [W, 0],
          [W, H],
          [W * 0.55, H + 0.32],
          [0, H + 0.62],
          [-W * 0.55, H + 0.32],
          [-W, H],
        ];
        const faces: (Col | undefined)[] = [undefined, undefined, TURQ, TURQ, TURQ, TURQ, undefined];
        for (const r of [0, Math.PI / 2]) {
          b.profile(sec, 2.3, WHITE, { at: [0, 0.42, 0], ry: r }, { caps: WHITE, faces });
        }
        // большие стрельчатые окна в щипцах и боковые окна
        for (let k = 0; k < 4; k++) {
          b.group({ ry: (k * Math.PI) / 2 }, () => {
            archWin(b, 0.26, 1.0, GLASS, [0, 0.62, 1.152]);
            archWin(b, 0.13, 0.75, GLASS, [-0.48, 0.66, 1.152]);
            archWin(b, 0.13, 0.75, GLASS, [0.48, 0.66, 1.152]);
            // бирюзовая обводка щипца
            b.profile(
              [
                [W + 0.04, H],
                [W * 0.55, H + 0.34],
                [0, H + 0.68],
                [-W * 0.55, H + 0.34],
                [-W - 0.04, H],
                [-W, H - 0.04],
                [-W * 0.55, H + 0.26],
                [0, H + 0.56],
                [W * 0.55, H + 0.26],
                [W, H - 0.04],
              ],
              0.06,
              TURQ,
              { at: [0, 0.42, 1.16], shadow: false },
            );
          });
        }
        // угловые пилоны между щипцами
        for (const [x, z] of [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ] as P2[]) {
          b.box(0.36, H + 0.1, 0.36, WHITE, { at: [x * 0.82, 0.42, z * 0.82] }, { top: TURQ });
        }
        // барабан с окнами, корона арочек и большой купол
        const dy = 0.42 + H + 0.45;
        b.cyl(0.78, 0.74, 0.55, 16, WHITE, { at: [0, dy - 0.2, 0] }, { top: false });
        ringWindows(b, 0.74, 16, dy - 0.02, 0.1, 0.2, GLASS, 0, 2);
        for (let j = 0; j < 8; j++) {
          const m = (j / 8) * Math.PI * 2;
          b.tri(
            [Math.sin(m - 0.2) * 0.8, dy + 0.35, Math.cos(m - 0.2) * 0.8],
            [Math.sin(m + 0.2) * 0.8, dy + 0.35, Math.cos(m + 0.2) * 0.8],
            [Math.sin(m) * 0.8, dy + 0.62, Math.cos(m) * 0.8],
            WHITE_TRIM,
            [Math.sin(m), 0, Math.cos(m)],
          );
        }
        b.lathe(prof(MOSQUE_DOME, 0.88, 1.35, dy + 0.35), 16, TURQ, undefined, {
          bands: [TURQ, shade(TURQ, 1.05), TURQ, shade(TURQ, 1.06), TURQ],
        });
        spire(b, [0, dy + 1.65, 0], 0.4, 0.04);
        crescent(b, [0, dy + 2.12, 0], 0.11);
      },
      { shadowGroup: true },
    );
    // минареты
    for (const [x, z] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as P2[]) {
      kulMinaret(b, [x * 1.3, 0.42, z * 1.3], 6.2, 0.2);
    }
    // малые минареты-башенки у купола
    for (const [x, z] of [
      [-0.95, 0],
      [0.95, 0],
    ] as P2[]) {
      b.group({ at: [x, 0.42 + 1.35 + 0.2, z] }, () => {
        b.cyl(0.13, 0.12, 0.7, 8, WHITE, undefined, { top: false });
        b.lathe(prof(MOSQUE_DOME, 0.15, 0.25, 0.7), 8, TURQ);
        spire(b, [0, 0.93, 0], 0.18, 0.02);
      });
    }
  });
}

/** Башня Сююмбике: семь ярусов красного кирпича с белыми карнизами, зелёный шатёр, наклон. */
function suyumbike(b: Builder, at: P3): void {
  b.group(
    { at, rz: -0.075, rx: -0.05 },
    () => {
      const tier = (w: number, h: number, y: number, holes: number, arch = true) => {
        b.box(w, h, w, RED, { at: [0, y, 0] }, { top: RED_TOP });
        b.box(w + 0.06, 0.05, w + 0.06, WHITE_TRIM, {
          at: [0, y + h - 0.03, 0],
        });
        for (let k = 0; k < 4; k++) {
          b.group({ ry: (k * Math.PI) / 2 }, () => {
            for (let i = 0; i < holes; i++) {
              const x = (i - (holes - 1) / 2) * (w / (holes + 0.5));
              if (arch) archWin(b, 0.09, 0.2, HOLE, [x, y + h * 0.3, w / 2 + 0.006]);
              else
                b.rect(0.08, 0.14, HOLE, {
                  at: [x, y + h * 0.35, w / 2 + 0.006],
                });
            }
          });
        }
      };
      tier(1.15, 1.0, 0, 0);
      archWin(b, 0.38, 0.45, HOLE, [0, 0, 0.581]); // проезд
      archWin(b, 0.38, 0.45, HOLE, [0.581, 0, 0], Math.PI / 2);
      tier(0.92, 0.82, 1.0, 2);
      tier(0.74, 0.72, 1.82, 1);
      // восьмерики
      b.cyl(0.36, 0.36, 0.55, 8, RED, { at: [0, 2.54, 0] }, { phase: Math.PI / 8, top: RED_TOP });
      ringWindows(b, 0.36, 8, 2.66, 0.08, 0.2, HOLE, Math.PI / 8);
      b.cyl(0.4, 0.4, 0.05, 8, WHITE_TRIM, { at: [0, 3.06, 0] }, { phase: Math.PI / 8 });
      b.cyl(0.28, 0.28, 0.45, 8, RED, { at: [0, 3.11, 0] }, { phase: Math.PI / 8, top: RED_TOP });
      ringWindows(b, 0.28, 8, 3.2, 0.06, 0.15, HOLE, Math.PI / 8, 2);
      b.cyl(0.32, 0.32, 0.04, 8, WHITE_TRIM, { at: [0, 3.56, 0] }, { phase: Math.PI / 8 });
      b.cyl(0.2, 0.2, 0.3, 8, RED, { at: [0, 3.6, 0] }, { phase: Math.PI / 8, top: false });
      b.lathe(
        [
          [0.26, 3.9],
          [0.03, 5.3],
        ],
        8,
        GREEN_ROOF,
        undefined,
        { phase: Math.PI / 8, capTop: false },
      );
      b.cyl(0.26, 0.26, 0.02, 8, shade(GREEN_ROOF, 0.8), { at: [0, 3.88, 0] }, { phase: Math.PI / 8, bottom: true, top: false });
      spire(b, [0, 5.25, 0], 0.4, 0.03);
      b.lathe(
        [
          [0, 5.38],
          [0.05, 5.42],
          [0, 5.47],
        ],
        5,
        'gold',
      );
      crescent(b, [0, 5.6, 0], 0.08);
    },
    { shadowGroup: true },
  );
}

/** Благовещенский собор: белый объём с закомарами, апсиды, золотая и четыре синие главы. */
function annunciation(b: Builder, at: P3, ry: number): void {
  b.group({ at, ry }, () => {
    b.group(
      {},
      () => {
        const L = 1.9;
        const D = 1.45;
        const H = 1.3;
        b.box(L, H, D, WHITE, undefined, { top: WHITE_TOP });
        // закомары по длинным сторонам и на торце
        const zak: P2[] = [];
        for (let i = 0; i <= 4; i++) {
          const a = Math.PI - (i / 4) * Math.PI;
          zak.push([Math.cos(a) * 0.3, Math.sin(a) * 0.3]);
        }
        for (const s of [1, -1]) {
          for (let i = 0; i < 3; i++) {
            b.profile(zak, 0.08, WHITE, { at: [-0.62 + i * 0.62, H, s * (D / 2 - 0.04)] }, { caps: WHITE_TRIM, faces: zak.map(() => 'roofDark') });
          }
        }
        for (let i = 0; i < 2; i++) {
          b.profile(zak, 0.08, WHITE, { at: [-L / 2 + 0.04, H, -0.36 + i * 0.72], ry: Math.PI / 2 }, { caps: WHITE_TRIM, faces: zak.map(() => 'roofDark') });
        }
        b.pyramid(L - 0.05, D - 0.05, 0.28, 'roofDark', { at: [0, H, 0] });
        // окна
        for (const s of [1, -1]) {
          b.group({ ry: s > 0 ? 0 : Math.PI }, () => {
            for (let i = 0; i < 3; i++) {
              archWin(b, 0.12, 0.3, GLASS, [-0.62 + i * 0.62, 0.72, D / 2 + 0.006]);
            }
          });
        }
        // три апсиды с востока (+X)
        for (const [z, r] of [
          [0, 0.38],
          [-0.48, 0.26],
          [0.48, 0.26],
        ] as P2[]) {
          b.cyl(r, r, H * 0.82, 8, WHITE, { at: [L / 2, 0, z] }, { top: 'roofDark' });
        }
        // западное крыльцо-притвор
        b.box(0.55, 0.8, 0.95, WHITE, { at: [-L / 2 - 0.27, 0, 0] }, { top: WHITE_TOP });
        b.gable(0.95, 0.6, 0.22, 'roofDark', { at: [-L / 2 - 0.27, 0.8, 0], ry: Math.PI / 2 }, { ends: WHITE_TRIM });
        archWin(b, 0.22, 0.4, HOLE, [-L / 2 - 0.552, 0, 0], -Math.PI / 2);
        // главы
        const head = (x: number, z: number, r: number, drumH: number, color: Col, y0: number, seg: number, shape: P2[]) => {
          b.group({ at: [x, y0, z] }, () => {
            b.cyl(r * 0.62, r * 0.62, drumH, seg, WHITE, undefined, {
              top: false,
            });
            if (seg > 8) ringWindows(b, r * 0.62, seg, drumH * 0.3, 0.05, drumH * 0.4, HOLE, 0, 2);
            b.lathe(prof(shape, r, r * 1.75, drumH), seg, color);
            cross(b, [0, drumH + r * 1.72, 0], r * 1.1);
          });
        };
        head(0, 0, 0.36, 0.6, 'gold', H + 0.2, 10, ONION_S);
        for (const [x, z] of [
          [-0.55, -0.42],
          [0.55, -0.42],
          [-0.55, 0.42],
          [0.55, 0.42],
        ] as P2[]) {
          head(x, z, 0.24, 0.42, BLUE, H + 0.12, 8, ONION);
        }
      },
      { shadowGroup: true },
    );
  });
}

/** Губернаторский дворец (резиденция Президента) с башенкой и флагштоком; возвращает точку флагштока. */
function palace(b: Builder, at: P3, ry: number): void {
  const wall = mix('stoneSand', 'stoneWhite', 0.35);
  const roof = GREEN_ROOF;
  b.group(
    { at, ry },
    () => {
      b.box(2.5, 0.95, 0.85, wall, undefined, { top: shade(wall, 0.9) });
      b.box(2.6, 0.06, 0.95, WHITE_TRIM, { at: [0, 0.95, 0] });
      b.gable(2.5, 0.9, 0.3, roof, { at: [0, 1.01, 0] }, { ends: wall });
      for (const s of [1, -1]) {
        b.group({ ry: s > 0 ? 0 : Math.PI }, () => {
          for (let i = 0; i < 7; i++) {
            const x = (i - 3) * 0.33;
            if (i === 3) continue;
            archWin(b, 0.1, 0.2, GLASS, [x, 0.55, 0.431]);
            b.rect(0.1, 0.18, GLASS, { at: [x, 0.16, 0.431] });
          }
        });
      }
      // центральный ризалит с шатровой кровлей
      b.box(0.7, 1.35, 0.95, wall, undefined, { top: shade(wall, 0.9) });
      archWin(b, 0.22, 0.45, GLASS, [0, 0.62, 0.481]);
      b.rect(0.24, 0.4, HOLE, { at: [0, 0, 0.481] });
      b.pyramid(0.78, 1.02, 0.5, roof, { at: [0, 1.35, 0] });
      b.box(0.03, 0.9, 0.03, 'steel', { at: [0, 1.75, 0] });
    },
    { shadowGroup: true },
  );
}

/** Длинный корпус с рядами окон (Юнкерское училище, Пушечный двор). */
function longBlock(b: Builder, at: P3, ry: number, len: number, wall: Col, roof: Col): void {
  b.group(
    { at, ry },
    () => {
      b.box(len, 0.75, 0.6, wall, undefined, { top: shade(wall, 0.9) });
      b.gable(len + 0.06, 0.68, 0.22, roof, { at: [0, 0.75, 0] }, { ends: wall });
      const n = Math.floor(len / 0.28);
      for (const s of [1, -1]) {
        b.group({ ry: s > 0 ? 0 : Math.PI }, () => {
          for (let i = 0; i < n; i++) {
            const x = (i - (n - 1) / 2) * 0.28;
            b.rect(0.09, 0.16, GLASS, { at: [x, 0.45, 0.301] });
            b.rect(0.09, 0.14, GLASS, { at: [x, 0.12, 0.301] });
          }
        });
      }
    },
    { shadowGroup: true },
  );
}

// ---------- анимация ----------

interface Anim {
  start: number;
  end: number;
  kind: 'flag' | 'boat';
  pivot: P3;
  dir?: number; // направление полотнища (угол в плоскости XZ)
  phase: number;
}

export function buildKazanKremlin(): Miniature {
  const b = new Builder();
  const G = plinth(b, 'lowland');
  const HILL = 0.55;
  const Y = G + HILL;

  // Казанка с севера: вода, песчаный урез
  const edge = ringXZ(4.66, 14);
  const river = clipConvex(
    [
      [-6, -2.2],
      [6, -5.4],
      [6, -8],
      [-6, -8],
    ],
    edge,
  );
  b.flat(river, G + 0.008, 'water');
  b.flat(
    clipConvex(
      [
        [-6, -1.95],
        [6, -5.15],
        [6, -5.4],
        [-6, -2.2],
      ],
      edge,
    ),
    G + 0.01,
    mix('stoneSand', 'lowland', 0.3),
  );
  // набережная-дорожка вдоль реки
  b.flat(
    clipConvex(
      [
        [-6, -1.65],
        [6, -4.85],
        [6, -5.05],
        [-6, -1.85],
      ],
      edge,
    ),
    G + 0.012,
    PAVE,
  );

  // стены (неправильный многоугольник), Спасская башня на юге
  const ring: P2[] = [
    [-2.95, 2.05],
    [-0.45, 3.3],
    [2.55, 2.0],
    [2.95, -0.75],
    [1.25, -2.85],
    [-1.75, -2.3],
    [-3.3, -0.35],
  ];
  // холм: склон от подошвы до плато внутри стен
  const dense = densify(ring, 2);
  const top = push(dense, 0.22);
  const foot = push(dense, 0.95);
  slope(b, foot, G, top, Y, shade('lowland', 0.9));
  b.flat(top, Y, mix('plain', 'lowland', 0.35));
  // тени на плато отсекаются выпуклой оболочкой его контура
  b.shadowPlane = {
    y: Y,
    poly: convexHull(top),
    color: groundShadow(mix('plain', 'lowland', 0.35)),
  };

  // мощёные площади и дорожки внутри кремля
  b.flat(
    [
      [-0.65, 3.05],
      [-0.2, 3.05],
      [0.5, 1.4],
      [1.6, 0.6],
      [1.4, 0.2],
      [0.2, 0.9],
      [-0.6, 1.2],
      [-1.0, 1.0],
      [-1.2, 1.5],
    ],
    Y + 0.01,
    PAVE,
  );
  b.flat(ringXZ(1.95, 12, Math.PI / 12, -0.35, -0.75), Y + 0.008, PAVE);
  // спуск-пандус от ворот
  b.flat(
    clipConvex(
      [
        [-0.75, 3.2],
        [-0.15, 3.2],
        [0.25, 5],
        [-0.35, 5],
      ],
      edge,
    ),
    G + 0.012,
    PAVE,
  );

  for (let i = 0; i < ring.length; i++) wallSpan(b, ring[i], ring[(i + 1) % ring.length], Y);
  ring.forEach(([x, z], i) => {
    if (i === 1) return;
    roundTower(b, [x, Y, z], i === 4 ? 0.46 : 0.4, i === 4 ? 1.35 : 1.15, i === 2);
  });
  // промежуточные башни-«полубашни» на длинных пряслах
  for (const [i, t] of [
    [2, 0.5],
    [5, 0.45],
    [6, 0.5],
  ] as [number, number][]) {
    const a = ring[i];
    const c = ring[(i + 1) % ring.length];
    b.group(
      {
        at: [a[0] + (c[0] - a[0]) * t, Y, a[1] + (c[1] - a[1]) * t],
        ry: Math.atan2(-(c[1] - a[1]), c[0] - a[0]),
      },
      () => {
        b.box(0.55, 1.0, 0.5, WHITE, undefined, { top: WHITE_TOP });
        b.pyramid(0.66, 0.6, 0.55, TEC, { at: [0, 1.0, 0] });
        b.rect(0.07, 0.12, HOLE, { at: [0, 0.55, 0.251] });
      },
      { shadowGroup: true },
    );
  }
  spasskaya(b, [ring[1][0], Y, ring[1][1]], -0.45);

  kulSharif(b, [-0.35, Y, -0.75], 0.12);
  suyumbike(b, [2.05, Y, -0.35]);
  annunciation(b, [-1.55, Y, 1.0], 0.3);
  palace(b, [0.85, Y, -1.95], -0.42);
  longBlock(b, [2.15, Y, 1.25], 0.42, 1.6, mix('stoneSand', 'accent', 0.12), GREEN_ROOF);
  longBlock(b, [-2.35, Y, -0.6], 1.15, 1.4, mix('stoneSand', 'stoneWhite', 0.4), 'roofDark');

  // деревья во дворах и на склоне
  roundTree(b, 0.95, 1.85, Y, 0.55);
  roundTree(b, 1.35, 1.55, Y, 0.5);
  roundTree(b, -2.35, 0.9, Y, 0.5);
  roundTree(b, -0.75, 2.3, Y, 0.5);
  tree(b, -2.1, 1.65, Y, 0.45);
  tree(b, -0.1, 2.05, Y, 0.42);
  roundTree(b, 3.7, 1.3, G, 0.55);
  roundTree(b, 3.3, 2.7, G, 0.5);
  roundTree(b, -3.6, 1.8, G, 0.55);
  roundTree(b, -2.4, 3.5, G, 0.5);
  tree(b, 1.3, 3.6, G, 0.45);
  tree(b, 3.85, -0.6, G, 0.45);

  // фигурки людей на площади
  const people: P2[] = [
    [0.1, 1.4],
    [0.35, 1.25],
    [-0.4, 2.6],
    [1.0, 0.75],
    [-0.9, 1.3],
    [0.2, 4.3],
    [-0.1, 4.0],
  ];
  people.forEach(([x, z], i) => {
    const y = z > 3.3 ? G : Y;
    const c = [mix('accent', 'stoneWhite', 0.2), 'roofBlue', 'kamazBlue', 'gold', 'accent', 'roofDark', 'roofBlue'][i] as Col;
    b.box(0.07, 0.14, 0.07, c, { at: [x, y, z], shadow: false });
  });

  // ---------- анимированные: флаг Татарстана и лодка ----------
  const a = new Builder(G);
  const anims: Anim[] = [];
  // флаг на флагштоке дворца: зелёная / белая / красная полосы
  {
    const ry = -0.42;
    const local: P3 = [0, 1.75 + 0.9, 0];
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    const pole: P3 = [0.85 + local[0] * c, Y + local[1], -1.95 - local[0] * s];
    const start = a.triangles;
    const fl = 0.5;
    const fh = 0.32;
    const stripes: [number, number, Col][] = [
      [0, fh * 0.42, 'brickRed'],
      [fh * 0.42, fh * 0.58, 'stoneWhite'],
      [fh * 0.58, fh, mix('roofGreen', 'forest', 0.3)],
    ];
    a.group({ at: [pole[0], pole[1] - fh, pole[2]], ry: 0.9 }, () => {
      for (const [y0, y1, cl] of stripes) {
        for (let k = 0; k < 4; k++) {
          const x0 = (k / 4) * fl;
          const x1 = ((k + 1) / 4) * fl;
          for (const nz of [1, -1]) {
            a.tri([x0, y0, 0], [x1, y0, 0], [x1, y1, 0], cl, [0, 0, nz], {
              shadow: false,
            });
            a.tri([x0, y0, 0], [x1, y1, 0], [x0, y1, 0], cl, [0, 0, nz], {
              shadow: false,
            });
          }
        }
      }
    });
    anims.push({
      start,
      end: a.triangles,
      kind: 'flag',
      pivot: pole,
      dir: 0.9,
      phase: 0,
    });
  }
  // прогулочный катер на Казанке
  {
    const at: P3 = [-1.4, G, -3.95];
    const start = a.triangles;
    a.group({ at, ry: 0.26 }, () => {
      a.profile(
        [
          [-0.6, 0],
          [0.5, 0],
          [0.75, 0.16],
          [-0.65, 0.16],
        ],
        0.32,
        WHITE,
        undefined,
        {
          caps: WHITE_TRIM,
          faces: ['roofBlue', 'roofBlue', WHITE_TOP, 'roofBlue'],
        },
      );
      a.box(0.65, 0.16, 0.24, WHITE, { at: [-0.1, 0.16, 0] }, { top: 'roofBlue' });
      for (let i = 0; i < 4; i++) a.rect(0.1, 0.07, GLASS, { at: [-0.35 + i * 0.16, 0.21, 0.121] });
      a.box(0.04, 0.12, 0.04, 'accent', { at: [-0.3, 0.32, 0] });
    });
    anims.push({
      start,
      end: a.triangles,
      kind: 'boat',
      pivot: at,
      phase: 0.7,
    });
  }

  const mini = assemble('kazan-kremlin', [b, a]);
  const mesh = mini.group.children[1] as THREE.Mesh;
  const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  const rest = Float32Array.from(pos.array as Float32Array);
  const out = pos.array as Float32Array;
  mesh.geometry.boundingSphere!.radius += 0.3;
  mini.update = (t: number) => {
    for (const an of anims) {
      for (let i = an.start * 3; i < an.end * 3; i++) {
        const x = rest[i * 3];
        const y = rest[i * 3 + 1];
        const z = rest[i * 3 + 2];
        if (an.kind === 'flag') {
          const dx = x - an.pivot[0];
          const dz = z - an.pivot[2];
          const d = Math.hypot(dx, dz);
          const w = 0.06 * d * 2 * Math.sin(t * 5 - d * 9);
          // смещение поперёк полотнища
          out[i * 3] = x + Math.sin(an.dir!) * w;
          out[i * 3 + 1] = y;
          out[i * 3 + 2] = z + Math.cos(an.dir!) * w;
        } else {
          const dz = x - an.pivot[0];
          const bob = 0.025 * Math.sin(t * 1.6 + an.phase) + 0.02 * Math.sin(t * 1.1) * dz;
          out[i * 3] = x;
          out[i * 3 + 1] = Math.max(0, y + bob);
          out[i * 3 + 2] = z;
        }
      }
    }
    pos.needsUpdate = true;
  };
  mini.update(0);
  return mini;
}
