// Старо-Татарская слобода: набережная озера Кабан, ряд ярких деревянных домов с резными
// наличниками и расписными воротами, за оградой — мечеть аль-Марджани (кремовые стены с белыми
// пилястрами, вальмовая зелёная кровля, восьмигранный минарет с балконом и полумесяцем).
// По озеру плавают лебеди (отдельный меш, сдвигается в update).
import * as THREE from 'three';
import { Builder, assemble, clipConvex, mix, plinth, ringXZ, shade, type Col, type Miniature, type P2, type P3, type Place } from './kit';

const CREAM = mix('stoneSand', 'stoneWhite', 0.12);
const GLASS = mix('roofDark', 'glass', 0.4);
const GREEN = 'roofGreen';

/** Вальмовая крыша w×d высотой h (конёк вдоль X). */
function hipRoof(b: Builder, w: number, d: number, h: number, color: Col, p: Place = {}): void {
  const x = w / 2;
  const z = d / 2;
  const r = Math.max(0, x - z);
  const run = x - r;
  b.group(
    p,
    () => {
      const A: P3 = [-x, 0, z];
      const B: P3 = [x, 0, z];
      const C: P3 = [x, 0, -z];
      const D: P3 = [-x, 0, -z];
      const R0: P3 = [-r, h, 0];
      const R1: P3 = [r, h, 0];
      b.tri(A, B, R1, color, [0, z, h]);
      if (r > 0) b.tri(A, R1, R0, color, [0, z, h]);
      b.tri(C, D, R0, color, [0, z, -h]);
      if (r > 0) b.tri(C, R0, R1, color, [0, z, -h]);
      const ce = shade(color, 0.96);
      b.tri(B, C, R1, ce, [h, run, 0]);
      b.tri(D, A, R0, ce, [-h, run, 0]);
    },
    { shadowGroup: true },
  );
}

/** Окно с резным наличником: белая рама, переплёт, треугольная «корона» с цветной вставкой. */
function carvedWindow(b: Builder, at: P3, ry: number, trim: Col, accent: Col, w = 0.26, h = 0.42): void {
  b.group({ at, ry, shadow: false }, () => {
    b.rect(w + 0.1, h + 0.08, trim, { at: [0, -0.04, 0] });
    b.rect(w, h, GLASS, { at: [0, 0, 0.004] });
    b.rect(0.03, h, trim, { at: [0, 0, 0.008] });
    b.rect(w, 0.03, trim, { at: [0, h * 0.62, 0.008] });
    b.rect(w + 0.16, 0.04, trim, { at: [0, -0.08, 0.01] });
    const e = w / 2 + 0.09;
    b.tri([-e, h + 0.03, 0.004], [e, h + 0.03, 0.004], [0, h + 0.2, 0.004], trim, [0, 0, 1]);
    b.tri([-e * 0.6, h + 0.06, 0.008], [e * 0.6, h + 0.06, 0.008], [0, h + 0.15, 0.008], accent, [0, 0, 1]);
  });
}

/** Арочное окно мечети: рама с полукруглым верхом и тёмное стекло. */
function archWindow(b: Builder, at: P3, ry: number, w: number, h: number, frame: Col): void {
  b.group({ at, ry, shadow: false }, () => {
    b.rect(w + 0.08, h, frame, { at: [0, -0.04, 0] });
    b.disc((w + 0.08) / 2, 6, frame, { at: [0, h - 0.04, 0], rz: Math.PI / 2 });
    b.rect(w, h - 0.06, GLASS, { at: [0, 0, 0.005] });
    b.disc(w / 2, 6, GLASS, { at: [0, h - 0.06, 0.005], rz: Math.PI / 2 });
  });
}

interface HouseOpts {
  w: number;
  d: number;
  wall: Col;
  roof: Col;
  accent: Col;
  trim?: Col;
  /** Каменный первый этаж (двухэтажный дом: низ — камень, верх — дерево). */
  lower?: Col;
  hip?: boolean;
  ry?: number;
}

/** Татарский дом: цоколь, бревенчатый сруб с угловыми лопатками, наличники, фриз, крыша щипцом или вальмой. */
function house(b: Builder, at: P3, o: HouseOpts): void {
  const trim = o.trim ?? 'stoneWhite';
  const { w, d } = o;
  const h1 = o.lower ? 0.72 : 0;
  const h2 = 0.92;
  b.group({ at, ry: o.ry ?? 0 }, () => {
    b.box(w + 0.06, 0.2, d + 0.06, shade('stoneSand', 0.8));
    let y = 0.2;
    const nWin = w > 1.45 ? 3 : 2;
    const step = w / (nWin + 0.4);
    if (o.lower) {
      b.box(w, h1, d, o.lower, { at: [0, y, 0] });
      for (let i = 0; i < nWin; i++) archWindow(b, [(i - (nWin - 1) / 2) * step, y + 0.14, d / 2 + 0.005], 0, 0.2, 0.36, trim);
      for (const s of [1, -1]) archWindow(b, [s * (w / 2 + 0.005), y + 0.14, 0], (s * Math.PI) / 2, 0.2, 0.36, trim);
      y += h1;
      b.box(w + 0.08, 0.06, d + 0.08, trim, { at: [0, y, 0] });
      y += 0.06;
    }
    b.box(w, h2, d, o.wall, { at: [0, y, 0] });
    // угловые лопатки и фриз под карнизом
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.07, h2, 0.07, trim, { at: [sx * (w / 2 - 0.02), y, sz * (d / 2 - 0.02)], shadow: false });
    b.box(w + 0.05, 0.1, d + 0.05, trim, { at: [0, y + h2 - 0.12, 0], shadow: false });
    for (let i = 0; i < nWin; i++) carvedWindow(b, [(i - (nWin - 1) / 2) * step, y + 0.2, d / 2 + 0.005], 0, trim, o.accent);
    for (const s of [1, -1]) {
      for (const zz of [-0.28, 0.28]) carvedWindow(b, [s * (w / 2 + 0.005), y + 0.2, zz * d], (s * Math.PI) / 2, trim, o.accent, 0.22, 0.4);
    }
    y += h2;
    if (o.hip) {
      hipRoof(b, w + 0.28, d + 0.28, 0.62, o.roof, { at: [0, y, 0] });
      // слуховое окно на скате
      b.group({ at: [0, y + 0.12, d / 2 + 0.05] }, () => {
        b.box(0.34, 0.3, 0.3, trim, { at: [0, 0, -0.1] });
        b.gable(0.42, 0.42, 0.16, o.roof, { at: [0, 0.3, -0.1], ry: Math.PI / 2 }, { ends: trim });
        b.rect(0.2, 0.2, GLASS, { at: [0, 0.05, 0.056] });
      });
    } else {
      b.gable(d + 0.3, w + 0.3, 0.72, o.roof, { at: [0, y, 0], ry: Math.PI / 2 }, { ends: o.wall });
      // фронтон: белая обшивка-рамка и светёлка-мезонин
      b.group({ at: [0, y, d / 2 + 0.152], shadow: false }, () => {
        b.rect(w + 0.3, 0.06, trim);
        b.rect(0.34, 0.34, trim, { at: [0, 0.1, 0.002] });
        b.rect(0.24, 0.24, GLASS, { at: [0, 0.14, 0.005] });
        b.tri([-0.24, 0.44, 0.004], [0.24, 0.44, 0.004], [0, 0.6, 0.004], o.accent, [0, 0, 1]);
      });
    }
    b.box(0.14, 0.42, 0.14, shade('brickRed', 0.9), { at: [w * 0.22, y + 0.2, -d * 0.2] }, { top: 'roofDark' });
  });
}

/** Расписные ворота с солярной розеткой и двускатным козырьком. */
function gate(b: Builder, at: P3, ry: number, w: number, color: Col, roof: Col): void {
  const trim = 'stoneWhite';
  b.group({ at, ry }, () => {
    for (const s of [-1, 1]) b.box(0.13, 1.2, 0.13, trim, { at: [s * (w / 2), 0, 0] });
    b.box(w - 0.12, 0.98, 0.05, color, { at: [0, 0.04, 0] });
    b.box(w + 0.12, 0.12, 0.09, trim, { at: [0, 1.0, 0] });
    for (const z of [0.03, -0.03]) {
      const ry2 = z > 0 ? 0 : Math.PI;
      b.disc(0.16, 8, 'gold', { at: [0, 0.6, z], ry: ry2 });
      b.disc(0.08, 6, 'accent', { at: [0, 0.6, z * 1.2], ry: ry2 });
      b.rect(w - 0.25, 0.05, 'gold', { at: [0, 0.22, z], ry: ry2 });
    }
    b.gable(w + 0.4, 0.38, 0.22, roof, { at: [0, 1.2, 0] });
  });
}

/** Фонарь набережной. */
function lamp(b: Builder, x: number, z: number, y: number): void {
  b.group(
    { at: [x, y, z] },
    () => {
      b.cyl(0.035, 0.025, 0.72, 4, 'oilBlack', undefined, { top: false });
      b.box(0.24, 0.025, 0.025, 'oilBlack', { at: [0, 0.68, 0] });
      for (const s of [-1, 1]) b.box(0.07, 0.1, 0.07, mix('gold', 'kamazWhite', 0.5), { at: [s * 0.11, 0.58, 0] });
    },
    { shadowGroup: true },
  );
}

/** Человечек-фишка. */
function person(b: Builder, x: number, z: number, y: number, c: Col): void {
  b.group(
    { at: [x, y, z], ry: x * 5 },
    () => {
      b.cyl(0.065, 0.045, 0.2, 5, c);
      b.box(0.07, 0.07, 0.07, mix('stoneSand', 'accent', 0.25), { at: [0, 0.2, 0] });
    },
    { shadowGroup: true },
  );
}

/** Лиственное дерево: ствол и крона из семигранного тела вращения. */
function leafy(b: Builder, x: number, z: number, y: number, s: number, c: Col = 'forest'): void {
  const k = 0.92 + (((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1) + 1) % 1 * 0.2;
  b.group(
    { at: [x, y, z], s, ry: x * 2 + z },
    () => {
      b.cyl(0.07, 0.06, 0.45, 4, 'wood', undefined, { top: false });
      b.lathe(
        [
          [0, 0.32],
          [0.36, 0.42],
          [0.5, 0.72],
          [0.44, 1.05],
          [0.24, 1.28],
          [0, 1.36],
        ],
        7,
        shade(c, k * 1.08),
      );
    },
    { shadowGroup: true },
  );
}

/** Мечеть аль-Марджани: локальные координаты, длинная ось — X, фасад к +Z. */
function mosque(b: Builder): void {
  const W = 3.4;
  const D = 1.9;
  const H = 1.55;
  const white = 'stoneWhite';
  b.box(W + 0.08, 0.2, D + 0.08, shade('stoneSand', 0.75));
  b.box(W, H, D, CREAM, { at: [0, 0.2, 0] });
  const top = 0.2 + H;
  // пилястры
  const nx = 8;
  for (let i = 0; i < nx; i++) {
    const x = -W / 2 + 0.06 + (i * (W - 0.12)) / (nx - 1);
    for (const s of [1, -1]) b.box(0.12, H, 0.05, white, { at: [x, 0.2, s * (D / 2 + 0.02)], shadow: false });
  }
  for (const s of [1, -1]) for (const z of [-D / 2 + 0.06, 0, D / 2 - 0.06]) b.box(0.05, H, 0.12, white, { at: [s * (W / 2 + 0.02), 0.2, z], shadow: false });
  // междуэтажный пояс и карниз
  b.box(W + 0.06, 0.06, D + 0.06, white, { at: [0, 0.2 + H * 0.47, 0], shadow: false });
  b.box(W + 0.16, 0.1, D + 0.16, white, { at: [0, top, 0] });
  // два ряда арочных окон между пилястрами
  for (let i = 0; i < nx - 1; i++) {
    const x = -W / 2 + 0.06 + ((i + 0.5) * (W - 0.12)) / (nx - 1);
    for (const y of [0.34, 0.2 + H * 0.55]) {
      archWindow(b, [x, y, D / 2 + 0.005], 0, 0.2, 0.42, white);
      archWindow(b, [x, y, -D / 2 - 0.005], Math.PI, 0.2, 0.42, white);
    }
  }
  for (const s of [1, -1]) {
    for (const z of [-D / 4, D / 4]) for (const y of [0.34, 0.2 + H * 0.55]) archWindow(b, [s * (W / 2 + 0.005), y, z], (s * Math.PI) / 2, 0.2, 0.42, white);
  }
  // вальмовая крыша
  hipRoof(b, W + 0.36, D + 0.36, 0.9, GREEN, { at: [0, top + 0.1, 0] });
  // входной портик под минаретом
  b.group({ at: [-0.85, 0, D / 2] }, () => {
    b.box(0.9, 1.15, 0.36, white, { at: [0, 0.2, 0.12] });
    b.rect(0.34, 0.6, mix('wood', 'oilBlack', 0.3), { at: [0, 0.2, 0.305] });
    b.disc(0.17, 6, mix('wood', 'oilBlack', 0.3), { at: [0, 0.8, 0.305], rz: Math.PI / 2 });
    hipRoof(b, 1.04, 0.5, 0.3, GREEN, { at: [0, 1.35, 0.12] });
  });
  minaret(b, [-0.85, top + 0.1, 0]);
}

/** Восьмигранный минарет: постамент из кровли, ствол, балкон с решёткой, верхний ярус, шатёр, полумесяц. */
function minaret(b: Builder, at: P3): void {
  const white = 'stoneWhite';
  const ph = Math.PI / 8;
  const slits = (r: number, y: number, h: number, n: number[]) => {
    const ap = r * Math.cos(ph) + 0.004;
    for (const k of n) {
      const a = (k * Math.PI) / 4;
      b.rect(0.07, h, GLASS, { at: [Math.sin(a) * ap, y, Math.cos(a) * ap], ry: a });
    }
  };
  b.group(
    { at },
    () => {
      b.cyl(0.44, 0.44, 1.0, 8, white, undefined, { phase: ph });
      b.cyl(0.5, 0.5, 0.08, 8, white, { at: [0, 1.0, 0] }, { phase: ph });
      b.cyl(0.36, 0.34, 1.3, 8, white, { at: [0, 1.08, 0] }, { phase: ph, top: false });
      slits(0.35, 1.45, 0.24, [0, 2, 6]);
      b.cyl(0.36, 0.36, 0.05, 8, GREEN, { at: [0, 1.08, 0] }, { phase: ph });
      // балкон на консолях
      b.lathe(
        [
          [0.34, 2.22],
          [0.58, 2.38],
        ],
        12,
        shade(white, 0.9),
        undefined,
        { capTop: true },
      );
      b.cyl(0.6, 0.6, 0.05, 12, white, { at: [0, 2.38, 0] });
      b.arc(0.54, 0.58, 0, Math.PI * 2, 0.2, 14, 'roofDark', { at: [0, 2.43, 0] }, { top: 'gold' });
      // верхний ярус
      b.cyl(0.28, 0.27, 0.7, 8, white, { at: [0, 2.43, 0] }, { phase: ph, top: false });
      slits(0.275, 2.65, 0.22, [0, 2, 4, 6]);
      b.cyl(0.35, 0.35, 0.07, 8, white, { at: [0, 3.13, 0] }, { phase: ph });
      b.cone(0.37, 1.5, 8, GREEN, { at: [0, 3.2, 0] }, ph);
      // золотое навершие с полумесяцем
      b.lathe(
        [
          [0, 4.62],
          [0.07, 4.68],
          [0.06, 4.76],
          [0, 4.8],
        ],
        6,
        'gold',
      );
      b.cyl(0.02, 0.02, 0.4, 4, 'gold', { at: [0, 4.78, 0] });
      b.arc(0.08, 0.12, Math.PI + 0.45, Math.PI * 2 - 0.45, 0.025, 6, 'gold', { at: [0, 5.3, 0.012], rx: Math.PI / 2 });
    },
    { shadowGroup: true },
  );
}

/** Угловая башенка ограды с шатриком. */
function gateTower(b: Builder, x: number, z: number, y: number): void {
  const ph = Math.PI / 8;
  b.group(
    { at: [x, y, z] },
    () => {
      b.cyl(0.19, 0.19, 0.78, 8, CREAM, undefined, { phase: ph });
      b.cyl(0.21, 0.21, 0.06, 8, 'stoneWhite', { at: [0, 0.4, 0] }, { phase: ph });
      b.cone(0.25, 0.22, 8, GREEN, { at: [0, 0.78, 0] }, ph);
      b.cyl(0.11, 0.11, 0.18, 8, CREAM, { at: [0, 0.9, 0] }, { phase: ph });
      b.cone(0.15, 0.2, 8, GREEN, { at: [0, 1.08, 0] }, ph);
      b.cone(0.03, 0.32, 4, 'gold', { at: [0, 1.22, 0] });
    },
    { shadowGroup: true },
  );
}

/** Лебедь, клювом к +X. */
function swan(b: Builder, x: number, z: number, s: number): void {
  const wh = 'kamazWhite';
  b.group({ at: [x, 0, z], s, shadow: false }, () => {
    b.profile(
      [
        [-0.16, 0],
        [0.12, 0],
        [0.17, 0.06],
        [0.02, 0.1],
        [-0.2, 0.13],
      ],
      0.13,
      wh,
    );
    b.box(0.035, 0.2, 0.035, wh, { at: [0.13, 0.05, 0], rz: -0.15 });
    b.box(0.08, 0.04, 0.035, wh, { at: [0.17, 0.24, 0] });
    b.box(0.05, 0.025, 0.025, 'accent', { at: [0.23, 0.245, 0] });
  });
}

export function buildStaroTatarskayaSloboda(): Miniature {
  const b = new Builder();
  const G = plinth(b, 'plain');
  const rim = ringXZ(4.66, 14);

  // озеро Нижний Кабан вдоль переднего края, гранитный парапет набережной
  const shore: P2[] = [
    [-5, 2.45],
    [-1.6, 2.95],
    [1.8, 3.15],
    [5, 2.95],
  ];
  const lake = clipConvex([...shore, [5, 6], [-5, 6]], rim);
  b.flat(lake, G + 0.05, 'water');
  b.flat(clipConvex([...shore.map(([x, z]): P2 => [x, z + 0.32]), [5, 6], [-5, 6]], ringXZ(4.4, 14)), G + 0.055, mix('water', 'waterDeep', 0.35));
  const granite = mix('stoneWhite', 'steel', 0.45);
  for (let i = 0; i < shore.length - 1; i++) {
    const a = shore[i];
    const c = shore[i + 1];
    const cl = clipConvex([a, c, [c[0], c[1] - 0.01], [a[0], a[1] - 0.01]], ringXZ(4.62, 14));
    if (cl.length < 3) continue;
    const xs = cl.map((p) => p[0]);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const zAt = (x: number) => a[1] + ((x - a[0]) / (c[0] - a[0])) * (c[1] - a[1]);
    b.wall([x0, zAt(x0)], [x1, zAt(x1)], 0.12, 0.16, granite, { at: [0, G, 0] }, { top: shade(granite, 1.08) });
  }
  // набережная-променад и улица вдоль домов
  b.flat(
    clipConvex(
      [
        [-5, 1.95],
        [5, 1.95],
        ...[...shore].reverse(),
      ],
      ringXZ(4.62, 14),
    ),
    G + 0.012,
    mix('stoneSand', 'stoneWhite', 0.25),
  );
  // проход к воротам мечети
  b.flat(
    [
      [-0.55, -0.6],
      [-0.15, -0.6],
      [0.0, 0.65],
      [-0.4, 0.65],
    ],
    G + 0.012,
    mix('stoneSand', 'stoneWhite', 0.25),
  );

  // мечеть аль-Марджани за оградой
  b.group({ at: [0.45, G, -2.05] }, () => mosque(b));

  // ограда двора с воротами и башенками
  const fenceZ = -0.62;
  const gx = -0.4;
  const fence = (x0: number, x1: number) => {
    b.wall([x0, fenceZ], [x1, fenceZ], 0.1, 0.36, CREAM, { at: [0, G, 0] }, { top: GREEN });
    const n = Math.max(1, Math.round((x1 - x0) / 0.7));
    for (let i = 0; i <= n; i++) b.box(0.13, 0.46, 0.13, 'stoneWhite', { at: [x0 + ((x1 - x0) * i) / n, G, fenceZ] }, { top: GREEN });
  };
  fence(-2.9, gx - 0.42);
  fence(gx + 0.42, 3.2);
  gateTower(b, gx - 0.42, fenceZ, G);
  gateTower(b, gx + 0.42, fenceZ, G);
  b.box(0.62, 0.62, 0.03, 'oilBlack', { at: [gx, G, fenceZ] });
  b.box(0.7, 0.06, 0.05, 'oilBlack', { at: [gx, G + 0.62, fenceZ] });

  // ряд домов вдоль набережной
  const blue = mix('roofBlue', 'glass', 0.2);
  const mint = mix('roofGreen', 'glass', 0.35);
  const yellow = mix('gold', 'stoneSand', 0.25);
  const teal = mix('roofGreen', 'roofBlue', 0.5);
  const brownRoof = mix('brickRed', 'wood', 0.5);
  house(b, [-3.15, G, 1.3], { w: 1.4, d: 1.3, wall: mint, roof: shade(GREEN, 1.15), accent: 'accent', ry: 0.1 });
  gate(b, [-2.08, G, 1.88], 0.05, 0.62, 'roofBlue', shade(GREEN, 1.15));
  house(b, [-0.95, G, 1.3], { w: 1.62, d: 1.3, wall: blue, roof: GREEN, accent: 'gold', lower: mix(CREAM, 'stoneSand', 0.4), hip: true });
  gate(b, [0.2, G, 1.9], 0, 0.6, 'roofGreen', GREEN);
  house(b, [1.35, G, 1.3], { w: 1.5, d: 1.3, wall: yellow, roof: brownRoof, accent: 'roofGreen', ry: -0.03 });
  gate(b, [2.42, G, 1.86], -0.1, 0.56, 'accent', brownRoof);
  house(b, [3.38, G, 1.15], { w: 1.15, d: 1.2, wall: teal, roof: shade(GREEN, 1.15), accent: 'gold', ry: -0.28 });

  // фонари и гуляющие на набережной
  for (const x of [-3.3, -1.5, 0.4, 2.3]) lamp(b, x, 2.42 + (x + 3.3) * 0.08, G);
  person(b, -2.6, 2.3, G, 'roofBlue');
  person(b, -2.45, 2.38, G, 'accent');
  person(b, -0.6, 2.45, G, 'kamazWhite');
  person(b, 1.0, 2.55, G, 'gold');
  person(b, 1.15, 2.5, G, 'roofDark');
  person(b, 2.9, 2.5, G, 'roofGreen');
  person(b, -0.25, 0.1, G, 'stoneWhite');

  // деревья во дворах и у мечети
  leafy(b, -2.15, 0.15, G, 0.8);
  leafy(b, 0.45, 0.05, G, 0.7, mix('forest', 'lowland', 0.3));
  leafy(b, 2.45, 0.2, G, 0.85);
  leafy(b, -3.2, -0.15, G, 0.75, mix('forest', 'lowland', 0.3));
  leafy(b, 3.45, -0.6, G, 0.8);
  leafy(b, -2.4, -1.75, G, 0.95);
  leafy(b, -3.3, -1.0, G, 0.7, mix('forest', 'lowland', 0.25));
  leafy(b, 2.95, -2.3, G, 0.85, mix('forest', 'lowland', 0.2));
  leafy(b, -1.6, -3.4, G, 0.75);
  leafy(b, 1.6, -3.75, G, 0.7, mix('forest', 'lowland', 0.3));
  leafy(b, 3.8, 1.85, G, 0.55);

  // лебеди на Кабане: отдельный меш, плывут по вытянутому эллипсу
  const swans = new Builder(0);
  swan(swans, 0, 0, 1);
  swan(swans, -0.32, 0.17, 0.95);
  swan(swans, -0.55, -0.05, 0.6);
  const mini = assemble('staro-tatarskaya-sloboda', [b, swans]);
  const flock = mini.group.children[1] as THREE.Mesh;
  flock.position.y = G + 0.05;
  const cx = 0.3;
  const cz = 3.95;
  const rx = 1.45;
  const rz = 0.22;
  mini.update = (t: number) => {
    const a = t * 0.12;
    flock.position.x = cx + Math.cos(a) * rx;
    flock.position.z = cz + Math.sin(a) * rz;
    // курс — касательная к эллипсу (лебеди смотрят по +X локально)
    flock.rotation.y = -Math.atan2(Math.cos(a) * rz, -Math.sin(a) * rx);
    flock.position.y = G + 0.05 + Math.sin(t * 1.3) * 0.006;
  };
  mini.update(0);
  return mini;
}
