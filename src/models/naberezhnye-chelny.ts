// Набережные Челны: КАМАЗ. Синий бескапотный самосвал выезжает из ворот длинного
// заводского корпуса с пилообразной крышей; на площадке — новые машины с конвейера,
// по кольцевой трассе вдоль края подставки нарезает круги раллийный «КАМАЗ-мастер».
import * as THREE from 'three';
import { Builder, SUN, assemble, clipConvex, groundShadow, mix, plinth, ringXZ, shade, type Col, type Miniature, type P2, type P3 } from './kit';
import { roundTree, tree } from './archi';

const BLUE: Col = 'kamazBlue';
const BLUE_D = shade('kamazBlue', 0.78);
const WHITE: Col = 'kamazWhite';
const BLACK: Col = 'oilBlack';
const GLASS = mix('glass', 'roofDark', 0.45);
const LAMP = mix('kamazWhite', 'gold', 0.35);
const ORANGE = mix('accent', 'gold', 0.45);

const TRACK_R = 4.08; // средняя линия кольцевой трассы
const TRACK_W = 0.6;
const TRACK = mix('stoneSand', 'ridge', 0.4);

/** Колесо, ось вдоль Z: шина + диск снаружи. side — с какой стороны диск. */
function wheel(b: Builder, x: number, y: number, z0: number, r: number, w: number, side: 1 | -1, seg = 10): void {
  b.cyl(r, r, w, seg, BLACK, { at: [x, y, z0], rx: Math.PI / 2 }, { top: shade('oilBlack', 1.25), bottom: true, phase: Math.PI / seg });
  const zf = side > 0 ? z0 + w + 0.01 : z0 - 0.01;
  b.disc(r * 0.55, 8, mix('steel', 'kamazWhite', 0.3), { at: [x, y, zf], ry: side > 0 ? 0 : Math.PI });
  b.disc(r * 0.2, 6, shade('steel', 0.6), { at: [x, y, zf + side * 0.01], ry: side > 0 ? 0 : Math.PI });
}

/** Прямоугольник на боковой грани: side = +1 смотрит в +Z, −1 — в −Z. */
function sideRect(b: Builder, w: number, h: number, color: Col, x: number, y: number, z: number, side: 1 | -1): void {
  b.rect(w, h, color, { at: [x, y, z + side * 0.012], ry: side > 0 ? 0 : Math.PI });
}

/** Классический КАМАЗ-самосвал в «метрах»: перёд в +X, ширина по Z, колёса стоят на y = 0. */
function dumpTruck(b: Builder): void {
  // рама и колёса: передняя ось и задняя тележка (сдвоенные шины)
  b.box(6.3, 0.32, 0.9, BLACK, { at: [-0.25, 0.72, 0], shadow: false });
  for (const [x, w] of [
    [2.35, 0.42],
    [-1.05, 0.62],
    [-2.4, 0.62],
  ] as const) {
    wheel(b, x, 0.56, 1.18 - w, 0.56, w, 1);
    wheel(b, x, 0.56, -1.18, 0.56, w, -1);
  }
  // кабина: профиль сбоку с аркой переднего колеса, почти вертикальный перёд
  const cab: P2[] = [
    [1.6, 0.72],
    [1.68, 0.72],
    [1.76, 1.02],
    [2.0, 1.24],
    [2.35, 1.32],
    [2.7, 1.24],
    [2.94, 1.02],
    [3.02, 0.72],
    [3.56, 0.72],
    [3.63, 1.95],
    [3.43, 3.05],
    [3.3, 3.2],
    [1.6, 3.2],
  ];
  const arch = shade('oilBlack', 0.9);
  b.profile(cab, 2.36, BLUE, undefined, {
    caps: BLUE,
    faces: [BLUE_D, arch, arch, arch, arch, arch, arch, BLUE_D, BLUE, BLUE, BLUE, BLUE, BLUE_D],
  });
  const zc = 1.18;
  // лобовое стекло из двух половин (наклонено назад), козырёк, фонари на крыше
  for (const s of [-1, 1]) b.rect(1.02, 0.92, GLASS, { at: [3.628, 2.02, s * 0.55], ry: Math.PI / 2, rx: -0.18 });
  b.box(0.34, 0.06, 2.3, BLUE_D, { at: [3.5, 3.12, 0], rz: -0.25 });
  for (const z of [-0.45, 0, 0.45]) b.box(0.1, 0.08, 0.16, ORANGE, { at: [3.18, 3.2, z] });
  // решётка радиатора, логотип, бампер с круглыми фарами и поворотниками
  b.rect(1.6, 0.55, shade('oilBlack', 1.3), { at: [3.62, 1.22, 0], ry: Math.PI / 2, rx: 0.056 });
  for (const y of [1.33, 1.5, 1.66]) b.rect(1.5, 0.05, mix('steel', 'kamazWhite', 0.5), { at: [3.64, y, 0], ry: Math.PI / 2, rx: 0.056 });
  b.rect(0.55, 0.1, WHITE, { at: [3.64, 1.82, 0], ry: Math.PI / 2 });
  b.box(0.32, 0.46, 2.44, mix('steel', 'kamazWhite', 0.45), { at: [3.62, 0.42, 0] });
  for (const s of [-1, 1]) {
    for (const z of [0.72, 0.98]) b.disc(0.1, 6, LAMP, { at: [3.79, 0.66, s * z], ry: Math.PI / 2 });
    b.rect(0.22, 0.16, ORANGE, { at: [3.6, 1.0, s * 1.02], ry: Math.PI / 2 });
  }
  // бока кабины: окно двери, линия двери, белые молдинги, ступенька, зеркала
  for (const s of [-1, 1] as const) {
    sideRect(b, 0.9, 0.78, GLASS, 2.8, 2.18, s * zc, s);
    sideRect(b, 0.035, 1.75, BLUE_D, 2.25, 1.32, s * zc, s);
    sideRect(b, 1.7, 0.16, WHITE, 2.42, 1.62, s * zc, s);
    sideRect(b, 0.12, 0.05, shade('steel', 0.8), 2.4, 1.95, s * zc, s);
    b.box(0.4, 0.06, 0.3, BLACK, { at: [1.85, 0.62, s * 1.08] });
    b.box(0.06, 0.06, 0.34, 'steel', { at: [3.42, 2.75, s * 1.32] });
    b.box(0.08, 0.5, 0.22, BLACK, { at: [3.44, 2.4, s * 1.5] });
  }
  // за кабиной: выхлопная труба и воздухозаборник; топливный бак на раме
  b.cyl(0.08, 0.08, 2.75, 6, 'steel', { at: [1.48, 0.95, -0.95] });
  b.cyl(0.11, 0.11, 0.12, 6, shade('steel', 0.7), { at: [1.48, 3.62, -0.95] });
  b.cyl(0.17, 0.17, 2.3, 6, shade('oilBlack', 1.4), { at: [1.45, 1.0, 0.82] });
  b.cyl(0.24, 0.24, 0.16, 6, shade('oilBlack', 1.4), { at: [1.45, 3.3, 0.82] });
  b.cyl(0.3, 0.3, 1.1, 8, mix('steel', 'kamazWhite', 0.4), { at: [0.85, 0.72, -1.0], rz: Math.PI / 2 }, { bottom: true });
  // гидроцилиндр подъёма кузова
  b.cyl(0.13, 0.11, 1.4, 6, mix('steel', 'kamazWhite', 0.3), { at: [1.42, 1.05, 0], rz: 0.12 });
  // кузов-самосвал: борта с рёбрами, защитный козырёк над кабиной, задний борт
  const body = mix('kamazWhite', 'steel', 0.08);
  b.profile(
    [
      [-3.45, 1.15],
      [1.22, 1.15],
      [1.32, 2.62],
      [-3.36, 2.62],
    ],
    2.36,
    body,
    undefined,
    { caps: body, faces: [BLACK, body, shade('stoneSand', 0.9), shade(body, 0.88)] },
  );
  b.box(0.12, 0.62, 2.36, body, { at: [1.3, 2.62, 0] });
  b.box(0.95, 0.07, 2.36, BLUE, { at: [1.75, 3.24, 0], rz: -0.06 });
  for (const s of [-1, 1]) b.box(4.82, 0.18, 0.08, BLUE, { at: [-1.05, 2.5, s * 1.19] });
  b.box(0.1, 0.18, 2.44, BLUE, { at: [-3.4, 2.5, 0] });
  b.box(4.7, 0.12, 2.42, BLUE, { at: [-1.08, 1.15, 0] });
  for (const s of [-1, 1] as const) {
    for (const x of [-2.85, -1.9, -0.95, 0.0, 0.85]) b.box(0.1, 1.38, 0.06, BLUE, { at: [x, 1.15, s * 1.2] });
  }
  for (const y of [1.55, 2.05]) b.box(0.06, 0.08, 2.3, shade(body, 0.85), { at: [-3.46, y, 0] });
  for (const z of [-0.85, 0.85]) b.rect(0.18, 0.12, 'accent', { at: [-3.415, 0.78, z], ry: -Math.PI / 2 });
  // брызговики за задней тележкой
  for (const s of [-1, 1]) b.box(0.05, 0.5, 0.5, BLACK, { at: [-3.05, 0.25, s * 0.93] });
  // груз: песчаная горка
  b.pyramid(4.3, 2.1, 0.42, shade('stoneSand', 0.96), { at: [-1.05, 2.62, 0], shadow: false });
  b.pyramid(2.6, 1.5, 0.75, shade('stoneSand', 1.02), { at: [-1.25, 2.62, 0.05], shadow: false });
}

/** Маленький грузовик с конвейера (габарит ~1.1 длины): перёд в +X. */
function miniTruck(b: Builder, at: P3, ry: number, cabCol: Col, bodyCol: Col): void {
  b.group(
    { at, ry },
    () => {
      for (const x of [0.36, -0.2, -0.36]) {
        for (const s of [-1, 1]) b.cyl(0.1, 0.1, 0.08, 6, BLACK, { at: [x, 0.1, s > 0 ? 0.16 : -0.24], rx: Math.PI / 2 }, { bottom: true });
      }
      b.box(1.0, 0.08, 0.3, BLACK, { at: [0, 0.12, 0] });
      b.profile(
        [
          [0.2, 0.18],
          [0.56, 0.18],
          [0.58, 0.36],
          [0.53, 0.56],
          [0.2, 0.56],
        ],
        0.44,
        cabCol,
        undefined,
        { faces: [BLACK, cabCol, cabCol, cabCol, cabCol] },
      );
      b.rect(0.36, 0.15, GLASS, { at: [0.565, 0.38, 0], ry: Math.PI / 2, rx: -0.25 });
      b.box(0.07, 0.07, 0.46, mix('steel', 'kamazWhite', 0.45), { at: [0.57, 0.12, 0] });
      b.box(0.72, 0.36, 0.46, bodyCol, { at: [-0.18, 0.2, 0] }, { top: shade(bodyCol, 1.05) });
    },
    { shadowGroup: true },
  );
}

/** Раллийный «КАМАЗ-мастер» в «метрах» (масштабируется снаружи): перёд в +X. */
function rallyTruck(b: Builder): void {
  const white = WHITE;
  const blue = mix('kamazBlue', 'glass', 0.18);
  for (const x of [2.0, -1.55]) {
    wheel(b, x, 0.72, 0.62, 0.72, 0.56, 1, 8);
    wheel(b, x, 0.72, -1.18, 0.72, 0.56, -1, 8);
  }
  b.box(5.6, 0.4, 1.1, BLACK, { at: [0, 0.8, 0] });
  // кабина: белая сверху, синяя снизу
  b.profile(
    [
      [1.2, 1.1],
      [3.35, 1.1],
      [3.45, 2.0],
      [3.25, 3.05],
      [1.2, 3.05],
    ],
    2.3,
    white,
    undefined,
    { faces: [BLACK, blue, white, white, white] },
  );
  for (const s of [-1, 1] as const) {
    sideRect(b, 2.2, 0.7, blue, 2.3, 1.1, s * 1.15, s);
    sideRect(b, 0.75, 0.62, GLASS, 2.75, 2.15, s * 1.15, s);
  }
  b.rect(2.0, 0.85, GLASS, { at: [3.455, 2.08, 0], ry: Math.PI / 2, rx: -0.19 });
  // кенгурятник со светом
  b.box(0.12, 0.12, 2.4, blue, { at: [3.6, 1.55, 0] });
  for (const z of [-0.9, -0.54, -0.18, 0.18, 0.54, 0.9]) b.box(0.08, 0.2, 0.22, 'gold', { at: [3.62, 1.68, z] });
  b.box(0.3, 0.35, 2.4, blue, { at: [3.5, 0.75, 0] });
  // сервисный кузов с наклонной кормой и воздухозаборник на крыше
  b.profile(
    [
      [-3.25, 1.15],
      [1.12, 1.15],
      [1.12, 3.3],
      [-2.85, 3.3],
      [-3.35, 2.75],
    ],
    2.4,
    blue,
    undefined,
    { faces: [BLACK, blue, blue, blue, shade(blue, 0.9)] },
  );
  for (const s of [-1, 1] as const) sideRect(b, 0.9, 1.6, 'gold', 0.45, 1.5, s * 1.2, s);
  b.profile(
    [
      [-0.3, 3.3],
      [1.0, 3.3],
      [1.0, 3.95],
      [0.55, 3.95],
    ],
    1.4,
    blue,
    undefined,
    { faces: [blue, BLACK, blue, blue] },
  );
}

export function buildNaberezhnyeChelny(): Miniature {
  const b = new Builder();
  const G = plinth(b, 'plain', { seg: 20 });
  const inner = ringXZ(TRACK_R - TRACK_W / 2, 20);

  // кольцевая трасса из сегментов, с белыми бровками
  const n = 28;
  const ringPt = (r: number, i: number): P2 => [Math.cos((i / n) * Math.PI * 2) * r, Math.sin((i / n) * Math.PI * 2) * r];
  for (let i = 0; i < n; i++) {
    const r0 = TRACK_R - TRACK_W / 2;
    const r1 = TRACK_R + TRACK_W / 2;
    b.flat([ringPt(r0, i), ringPt(r1, i), ringPt(r1, i + 1), ringPt(r0, i + 1)], G + 0.012, TRACK);
    const rc = i % 2 ? WHITE : 'accent';
    b.flat([ringPt(r0 - 0.07, i), ringPt(r0, i), ringPt(r0, i + 1), ringPt(r0 - 0.07, i + 1)], G + 0.018, rc);
  }

  // асфальт: площадка перед корпусом и дорога от ворот к трассе
  const asphalt = mix('roofDark', 'steel', 0.25);
  b.flat(
    [
      [-2.75, -1.76],
      [2.45, -1.76],
      [2.45, -0.62],
      [-2.75, -0.62],
    ],
    G + 0.012,
    asphalt,
  );
  const dir: P2 = [-0.6, 0.8];
  const perp: P2 = [0.8, 0.6];
  const c0: P2 = [1.35, -1.0];
  const road = (w: number, t0: number, t1: number): P2[] => [
    [c0[0] + dir[0] * t0 - perp[0] * w, c0[1] + dir[1] * t0 - perp[1] * w],
    [c0[0] + dir[0] * t1 - perp[0] * w, c0[1] + dir[1] * t1 - perp[1] * w],
    [c0[0] + dir[0] * t1 + perp[0] * w, c0[1] + dir[1] * t1 + perp[1] * w],
    [c0[0] + dir[0] * t0 + perp[0] * w, c0[1] + dir[1] * t0 + perp[1] * w],
  ];
  b.flat(clipConvex(road(0.95, 0, 8), inner), G + 0.014, asphalt);
  for (let t = 0.9; t < 5; t += 0.75) {
    const piece = clipConvex(road(0.05, t, t + 0.38), ringXZ(TRACK_R - TRACK_W / 2 - 0.2, 20));
    if (piece.length >= 3) b.flat(piece, G + 0.02, WHITE);
  }
  // разметка стоянки
  for (const x of [-2.4, -1.7, -1.0, -0.3]) b.flat(
    [
      [x - 0.025, -1.72],
      [x + 0.025, -1.72],
      [x + 0.025, -1.0],
      [x - 0.025, -1.0],
    ],
    G + 0.02,
    WHITE,
  );

  // заводской корпус: длинный белый цех, лента окон, пилообразная крыша
  const hallC = shade('stoneWhite', 0.98);
  const x0 = -1.9;
  const x1 = 1.9;
  const zf = -1.85;
  const zb = -2.95;
  const H = 1.15;
  b.box(x1 - x0, H, zf - zb, hallC, { at: [(x0 + x1) / 2, G, (zf + zb) / 2] }, { top: shade('steel', 0.95) });
  b.rect(x1 - x0 - 0.1, 0.24, GLASS, { at: [(x0 + x1) / 2, G + 0.1, zf + 0.012] });
  for (let x = x0 + 0.3; x < x1 - 0.1; x += 0.4) b.rect(0.035, H - 0.05, mix('steel', 'stoneWhite', 0.5), { at: [x, G, zf + 0.016] });
  b.rect(x1 - x0 - 0.1, 0.24, GLASS, { at: [(x0 + x1) / 2, G + 0.55, zb - 0.012], ry: Math.PI });
  b.rect(zf - zb - 0.2, 0.24, GLASS, { at: [x1 + 0.012, G + 0.55, (zf + zb) / 2], ry: Math.PI / 2 });
  for (let x = x0 + 0.3; x < x1 - 0.1; x += 0.4) b.rect(0.035, H - 0.05, mix('steel', 'stoneWhite', 0.5), { at: [x, G, zb - 0.016], ry: Math.PI });
  // надпись «АВТОМОБИЛЬНЫЙ ЗАВОД» синими буквами
  for (let i = 0; i < 17; i++) {
    if (i === 11) continue;
    b.rect(0.07, 0.13, BLUE, { at: [-1.35 + i * 0.105, G + 0.64, zf + 0.02] });
  }
  {
    // пилообразная крыша: остеклённые вертикальные грани смотрят на восток (+X)
    const nT = 7;
    const tw = (x1 - x0) / nT;
    const pts: P2[] = [
      [x0, -0.03],
      [x0, 0],
    ];
    for (let i = 1; i <= nT; i++) pts.push([x0 + i * tw, 0.3], [x0 + i * tw, i === nT ? -0.03 : 0]);
    const faces: Col[] = pts.map((p, i) => {
      const q = pts[(i + 1) % pts.length];
      if (Math.abs(p[0] - q[0]) > 1e-6) return shade('steel', 0.92);
      return i > 1 && i < pts.length - 2 && q[1] < p[1] ? GLASS : hallC;
    });
    b.profile(pts, zf - zb - 0.1, shade('steel', 0.92), { at: [0, G + H, (zf + zb) / 2] }, { caps: hallC, faces });
  }
  // синий торец с логотипом KAMAZ
  {
    const bz0 = -2.75;
    const bz1 = -1.78;
    const bx = x0 - 0.24;
    b.box(0.5, 1.45, bz1 - bz0, BLUE, { at: [bx, G, (bz0 + bz1) / 2] }, { top: BLUE_D });
    for (let i = 0; i < 5; i++) b.rect(0.06, 0.2, WHITE, { at: [bx - 0.18 + i * 0.09, G + 0.95, bz1 + 0.012] });
    for (let i = 0; i < 5; i++) b.rect(0.06, 0.22, WHITE, { at: [bx - 0.262, G + 0.92, bz1 - 0.2 - i * 0.12], ry: -Math.PI / 2 });
  }
  // тёмная надстройка на крыше и красная решётчатая вышка
  b.box(1.0, 0.42, 0.55, mix('roofDark', 'oilBlack', 0.3), { at: [1.2, G + H, -2.5] });
  {
    const th = 1.3;
    const red = 'accent';
    b.group(
      { at: [-0.95, G + H, -2.25] },
      () => {
        for (const [sx, sz] of [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ]) b.box(0.05, th, 0.05, red, { at: [sx * 0.14, 0, sz * 0.14] });
        for (const y of [0.45, 0.9]) {
          b.box(0.33, 0.04, 0.04, red, { at: [0, y, 0.14] });
          b.box(0.33, 0.04, 0.04, red, { at: [0, y, -0.14] });
          b.box(0.04, 0.04, 0.33, red, { at: [0.14, y, 0] });
          b.box(0.04, 0.04, 0.33, red, { at: [-0.14, y, 0] });
        }
        b.box(0.5, 0.06, 0.4, red, { at: [0.1, th, 0] });
      },
      { shadowGroup: true },
    );
  }
  // ворота цеха и синий навес над проходной
  b.rect(0.7, 0.62, shade('roofDark', 0.9), { at: [1.35, G, zf + 0.022] });
  b.profile(
    [
      [-0.36, 0],
      [0.36, 0],
      [0.3, 0.1],
      [0, 0.17],
      [-0.3, 0.1],
    ],
    0.5,
    mix('kamazBlue', 'glass', 0.3),
    { at: [0.45, G + 0.42, zf + 0.25] },
  );
  for (const x of [0.13, 0.77]) b.box(0.04, 0.42, 0.04, 'steel', { at: [x, G, zf + 0.46] });

  // новые машины с конвейера на стоянке
  miniTruck(b, [-2.05, G, -1.22], -Math.PI / 2, BLUE, mix('kamazWhite', 'steel', 0.15));
  miniTruck(b, [-1.35, G, -1.22], -Math.PI / 2, BLUE, 'accent');
  miniTruck(b, [-0.65, G, -1.22], -Math.PI / 2, BLUE, mix('roofGreen', 'steel', 0.3));

  // главный герой: самосвал выезжает из ворот
  b.group({ at: [c0[0] + dir[0] * 2.5, G, c0[1] + dir[1] * 2.5], ry: Math.atan2(-0.8, -0.6), s: 0.62 }, () => dumpTruck(b), { shadowGroup: true });

  // фонари вдоль дороги
  for (const [x, z] of [
    [2.3, -0.3],
    [0.9, 1.6],
    [-2.65, -0.45],
  ] as P2[]) {
    b.cyl(0.03, 0.03, 1.15, 4, 'steel', { at: [x, G, z] });
    b.box(0.3, 0.04, 0.06, 'steel', { at: [x - 0.12, G + 1.15, z] });
    b.box(0.12, 0.05, 0.08, LAMP, { at: [x - 0.25, G + 1.1, z] });
  }

  // ели перед корпусом, лиственные деревья, зрители и флаг у трассы
  for (const [x, z, s] of [
    [2.25, -2.0, 0.45],
    [2.65, -1.45, 0.4],
    [2.98, -0.9, 0.42],
  ] as P3[]) tree(b, x, z, G, s);
  roundTree(b, -3.1, 0.15, G, 0.6);
  roundTree(b, -2.75, 1.05, G, 0.5);
  roundTree(b, -3.25, -0.9, G, 0.45);
  roundTree(b, 2.85, 0.75, G, 0.55);
  roundTree(b, 1.5, 3.1, G, 0.5);
  roundTree(b, 2.3, 2.6, G, 0.42);
  {
    const fx = 2.95;
    const fz = 1.75;
    b.cyl(0.025, 0.025, 1.05, 4, 'steel', { at: [fx, G, fz] });
    b.box(0.02, 0.26, 0.38, 'accent', { at: [fx, G + 0.75, fz + 0.2] });
    const shirts: Col[] = ['accent', 'roofBlue', 'gold', WHITE, 'roofGreen'];
    shirts.forEach((c, i) => {
      const a = 0.62 + i * 0.07;
      const r = TRACK_R - TRACK_W / 2 - 0.28 - (i % 2) * 0.12;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      b.box(0.08, 0.16, 0.08, c, { at: [x, G, z], ry: a });
      b.box(0.06, 0.06, 0.06, mix('stoneSand', 'accent', 0.2), { at: [x, G + 0.16, z], ry: a });
    });
  }

  // раллийный грузовик — отдельный меш, ездит по кольцу
  const rally = new Builder(G);
  const RS = 0.2;
  rally.flat(
    [
      [-0.78, -0.34],
      [0.78, -0.34],
      [0.78, 0.34],
      [-0.78, 0.34],
    ],
    G + 0.022,
    shade(groundShadow(TRACK), 1 / 1.04),
  );
  rally.group({ at: [0, G, 0], s: RS }, () => rallyTruck(rally));

  const mini = assemble('naberezhnye-chelny', [b, rally]);
  const mover = mini.group.children[1] as THREE.Mesh;
  const relight = relightOnSpin(mover);
  mini.update = (t: number) => {
    const a = t * 0.32;
    mover.position.set(Math.cos(a) * TRACK_R, 0, Math.sin(a) * TRACK_R);
    const ry = -a - Math.PI / 2;
    mover.rotation.y = ry;
    relight(ry);
  };
  mini.update(0);
  return mini;
}

/**
 * Меш, вращающийся вокруг Y: пересчитать запечённый Ламберт под новый курс.
 * Цвета делятся на освещённость покоя и умножаются на освещённость под текущим солнцем.
 */
function relightOnSpin(mesh: THREE.Mesh): (ry: number) => void {
  const g = mesh.geometry;
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const colA = g.getAttribute('color') as THREE.BufferAttribute;
  const nTri = pos.count / 3;
  const nrm = new Float32Array(nTri * 3);
  const base = new Float32Array(colA.array.length);
  const a = new THREE.Vector3();
  const bb = new THREE.Vector3();
  const c = new THREE.Vector3();
  const light = (nx: number, ny: number, nz: number, sx: number, sz: number) =>
    0.5 + 0.55 * Math.max(0, nx * sx + ny * SUN.y + nz * sz) + 0.1 * (0.5 + 0.5 * ny);
  for (let i = 0; i < nTri; i++) {
    a.fromBufferAttribute(pos, i * 3);
    bb.fromBufferAttribute(pos, i * 3 + 1).sub(a);
    c.fromBufferAttribute(pos, i * 3 + 2).sub(a);
    const n = bb.cross(c).normalize();
    nrm.set([n.x, n.y, n.z], i * 3);
    const k = light(n.x, n.y, n.z, SUN.x, SUN.z);
    for (let j = i * 9; j < i * 9 + 9; j++) base[j] = (colA.array[j] as number) / k;
  }
  const out = colA.array as Float32Array;
  let last = NaN;
  return (ry: number) => {
    if (Math.abs(ry - last) < 0.01) return;
    last = ry;
    const cs = Math.cos(ry);
    const sn = Math.sin(ry);
    const sx = SUN.x * cs - SUN.z * sn;
    const sz = SUN.x * sn + SUN.z * cs;
    for (let i = 0; i < nTri; i++) {
      const k = light(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2], sx, sz);
      for (let j = i * 9; j < i * 9 + 9; j++) out[j] = Math.min(1, base[j] * k);
    }
    colA.needsUpdate = true;
  };
}
