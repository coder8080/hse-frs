// Раифский Богородицкий монастырь: белые стены с башнями под золотистыми шатрами, высокая
// надвратная колокольня с медной луковицей и часами, Троицкий собор с пятью золотыми главами,
// собор Грузинской иконы с синим куполом и «шахматной» колоколенкой, братский корпус.
// Вокруг — сосновый лес заповедника и Раифское озеро с мостками и лодкой (лодка покачивается в update).
import * as THREE from 'three';
import { Builder, assemble, clipConvex, mix, plinth, ringXZ, shade, type Col, type Miniature, type P2, type P3 } from './kit';
import { ONION, MOSQUE_DOME, scaleProfile } from './archi';

const WHITE = 'stoneWhite';
const WTOP = shade(WHITE, 0.86);
const DARK = mix('roofDark', 'glass', 0.25);
const BLUE = mix('roofBlue', 'glass', 0.18);
const COPPER = mix('brickRed', 'gold', 0.45);
const TENT = mix('gold', 'stoneSand', 0.3);

/** Православный крест: стойка, перекладина, косая нижняя. */
function cross(b: Builder, at: P3, s = 1): void {
  b.group({ at, s, shadow: false }, () => {
    b.box(0.03, 0.4, 0.03, 'gold');
    b.box(0.2, 0.03, 0.03, 'gold', { at: [0, 0.27, 0] });
    b.box(0.13, 0.025, 0.03, 'gold', { at: [0, 0.1, 0], rz: -0.35 });
  });
}

/** Арочный проём (рама не нужна — белые стены): тёмный прямоугольник с полукругом. */
function arch(b: Builder, at: P3, ry: number, w: number, h: number, c: Col = DARK): void {
  b.group({ at, ry, shadow: false }, () => {
    b.rect(w, h - w / 2, c);
    b.disc(w / 2, 6, c, { at: [0, h - w / 2, 0], rz: Math.PI / 2 });
  });
}

/** Арки на всех четырёх гранях коробки со стороной a (центр в начале). */
function arches4(b: Builder, y: number, a: number, n: number, w: number, h: number, c: Col = DARK): void {
  for (let k = 0; k < 4; k++) {
    const ry = (k * Math.PI) / 2;
    const ox = Math.sin(ry);
    const oz = Math.cos(ry);
    for (let i = 0; i < n; i++) {
      const t = (i - (n - 1) / 2) * (a / (n + 0.6));
      arch(b, [ox * (a / 2 + 0.005) + oz * t, y, oz * (a / 2 + 0.005) - ox * t], ry, w, h, c);
    }
  }
}

/** Глава: барабан с окнами, луковица, крест. Возвращает высоту креста над at. */
function onionDome(b: Builder, at: P3, o: { r: number; h: number; drumR: number; drumH: number; color: Col; seg?: number; bands?: Col[] }): void {
  const seg = o.seg ?? 12;
  b.group(
    { at },
    () => {
      b.cyl(o.drumR, o.drumR, o.drumH, seg, WHITE, undefined, { top: false });
      b.cyl(o.drumR * 1.12, o.drumR * 1.12, 0.05, seg, WHITE, { at: [0, o.drumH - 0.05, 0] });
      const nw = Math.max(4, Math.round(seg / 2));
      for (let i = 0; i < nw; i++) {
        const a = (i / nw) * Math.PI * 2;
        arch(b, [Math.sin(a) * (o.drumR + 0.004), o.drumH * 0.22, Math.cos(a) * (o.drumR + 0.004)], a, o.drumR * 0.32, o.drumH * 0.55);
      }
      b.lathe(scaleProfile(ONION, o.r, o.h, o.drumH), seg, o.color, undefined, { bands: o.bands });
      b.cyl(0.02, 0.02, 0.12, 4, 'gold', { at: [0, o.drumH + o.h * 0.95, 0] });
      cross(b, [0, o.drumH + o.h + 0.06, 0], Math.max(0.55, o.r * 1.6));
    },
    { shadowGroup: true },
  );
}

/** Надвратная колокольня: четыре яруса, часы, медная луковица. */
function bellTower(b: Builder): void {
  b.group(
    {},
    () => {
      // 1 ярус — проездные ворота
      b.box(0.96, 1.5, 0.96, WHITE, undefined, { top: WTOP });
      for (const s of [1, -1]) arch(b, [0, 0, s * 0.485], s > 0 ? 0 : Math.PI, 0.42, 0.9, mix('roofDark', 'wood', 0.3));
      for (const s of [1, -1]) arch(b, [s * 0.485, 0.55, 0], (s * Math.PI) / 2, 0.2, 0.55);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.09, 1.5, 0.09, shade(WHITE, 1.02), { at: [sx * 0.465, 0, sz * 0.465], shadow: false });
      b.box(1.08, 0.1, 1.08, WHITE, { at: [0, 1.5, 0] }, { top: WTOP });
      // 2 ярус — звон
      b.box(0.78, 1.05, 0.78, WHITE, { at: [0, 1.6, 0] }, { top: WTOP });
      arches4(b, 1.75, 0.78, 1, 0.3, 0.75);
      b.box(0.88, 0.08, 0.88, WHITE, { at: [0, 2.65, 0] }, { top: WTOP });
      // 3 ярус
      b.box(0.64, 0.85, 0.64, WHITE, { at: [0, 2.73, 0] }, { top: WTOP });
      arches4(b, 2.86, 0.64, 1, 0.22, 0.6);
      b.box(0.74, 0.07, 0.74, WHITE, { at: [0, 3.58, 0] }, { top: WTOP });
      // 4 ярус — часы
      b.cyl(0.33, 0.33, 0.6, 8, WHITE, { at: [0, 3.65, 0] }, { phase: Math.PI / 8, top: WTOP });
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2;
        const ap = 0.33 * Math.cos(Math.PI / 8) + 0.005;
        b.disc(0.12, 8, 'kamazWhite', { at: [Math.sin(a) * ap, 3.95, Math.cos(a) * ap], ry: a });
        b.disc(0.09, 8, mix('kamazWhite', 'gold', 0.3), { at: [Math.sin(a) * (ap + 0.004), 3.95, Math.cos(a) * (ap + 0.004)], ry: a });
        b.rect(0.015, 0.09, 'oilBlack', { at: [Math.sin(a) * (ap + 0.008), 3.95, Math.cos(a) * (ap + 0.008)], ry: a });
      }
    },
    { shadowGroup: true },
  );
  onionDome(b, [0, 4.25, 0], { r: 0.36, h: 0.78, drumR: 0.23, drumH: 0.28, color: COPPER, seg: 12 });
}

/** Троицкий собор: белый куб с кокошниками, апсида, пять золотых глав. */
function trinityCathedral(b: Builder): void {
  const a = 1.5;
  const H = 1.3;
  b.box(a + 0.06, 0.15, a + 0.06, shade(WHITE, 0.82));
  b.box(a, H, a, WHITE, { at: [0, 0.15, 0] }, { top: WTOP });
  b.cyl(0.5, 0.5, H * 0.8, 10, WHITE, { at: [a / 2, 0.15, 0] }, { top: 'roofGreen' });
  b.cone(0.52, 0.2, 10, 'roofGreen', { at: [a / 2, 0.15 + H * 0.8, 0] });
  arches4(b, 0.45, a, 3, 0.18, 0.62);
  b.box(a + 0.1, 0.08, a + 0.1, WHITE, { at: [0, 0.15 + H, 0] }, { top: WTOP });
  // кокошники-фронтоны на каждой грани
  for (let k = 0; k < 4; k++) {
    b.group({ at: [0, 0.23 + H, 0], ry: (k * Math.PI) / 2 }, () => {
      b.gable(0.5, 0.8, 0.32, 'roofGreen', { at: [0, 0, a / 2 - 0.23], ry: Math.PI / 2 }, { ends: WHITE });
      b.disc(0.1, 6, DARK, { at: [0, 0.11, a / 2 + 0.026], rz: Math.PI / 2 });
    });
  }
  b.pyramid(a + 0.1, a + 0.1, 0.35, 'roofGreen', { at: [0, 0.23 + H, 0] });
  const y0 = 0.23 + H + 0.1;
  onionDome(b, [0, y0, 0], { r: 0.5, h: 0.95, drumR: 0.36, drumH: 0.62, color: 'gold', seg: 12 });
  for (const [x, z] of [
    [-0.5, -0.5],
    [0.5, -0.5],
    [-0.5, 0.5],
    [0.5, 0.5],
  ] as P2[]) {
    onionDome(b, [x, y0 - 0.08, z], { r: 0.28, h: 0.56, drumR: 0.19, drumH: 0.42, color: shade('gold', 0.94), seg: 10 });
  }
  // южное крыльцо во двор
  b.box(0.56, 0.85, 0.4, WHITE, { at: [0, 0.15, a / 2 + 0.15] }, { top: WTOP });
  b.gable(0.44, 0.66, 0.25, 'roofGreen', { at: [0, 1.0, a / 2 + 0.17], ry: Math.PI / 2 }, { ends: WHITE });
  arch(b, [0, 0.15, a / 2 + 0.355], 0, 0.28, 0.6, mix('roofDark', 'wood', 0.3));
}

/** Собор Грузинской иконы: белый объём, ротонда с синим куполом, трапезная. */
function georgianCathedral(b: Builder): void {
  const a = 1.35;
  b.box(a, 1.0, a, WHITE, undefined, { top: WTOP });
  arches4(b, 0.3, a, 2, 0.18, 0.5);
  b.box(a + 0.1, 0.08, a + 0.1, BLUE, { at: [0, 1.0, 0] }, { top: BLUE });
  for (let k = 0; k < 4; k++) {
    b.group({ at: [0, 1.08, 0], ry: (k * Math.PI) / 2 }, () => {
      b.gable(0.4, 0.85, 0.22, BLUE, { at: [0, 0, a / 2 - 0.18], ry: Math.PI / 2 }, { ends: WHITE });
    });
  }
  b.cyl(0.58, 0.58, 0.55, 14, WHITE, { at: [0, 1.08, 0] }, { top: false });
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * Math.PI * 2 + Math.PI / 8;
    arch(b, [Math.sin(t) * 0.585, 1.18, Math.cos(t) * 0.585], t, 0.14, 0.32);
  }
  b.cyl(0.64, 0.64, 0.06, 14, BLUE, { at: [0, 1.63, 0] });
  b.lathe(scaleProfile(MOSQUE_DOME, 0.62, 0.5, 1.69), 14, BLUE);
  b.cyl(0.08, 0.08, 0.14, 6, WHITE, { at: [0, 2.15, 0] }, { top: BLUE });
  b.lathe(
    [
      [0, 2.29],
      [0.06, 2.33],
      [0, 2.4],
    ],
    6,
    'gold',
  );
  cross(b, [0, 2.38, 0], 0.7);
  // трапезная к западу
  b.box(0.95, 0.8, 1.0, WHITE, { at: [-a / 2 - 0.47, 0, 0] }, { top: WTOP });
  b.gable(0.95, 1.1, 0.25, BLUE, { at: [-a / 2 - 0.47, 0.8, 0] }, { ends: WHITE });
  for (const s of [1, -1]) arch(b, [-a / 2 - 0.47, 0.2, s * 0.505], s > 0 ? 0 : Math.PI, 0.16, 0.42);
}

/** Колоколенка с «шахматной» сине-белой луковицей. */
function checkerTower(b: Builder): void {
  b.group(
    {},
    () => {
      b.box(0.55, 1.05, 0.55, WHITE, undefined, { top: WTOP });
      arches4(b, 0.3, 0.55, 1, 0.16, 0.42);
      b.box(0.62, 0.06, 0.62, BLUE, { at: [0, 1.05, 0] });
      b.cyl(0.21, 0.21, 0.55, 8, WHITE, { at: [0, 1.11, 0] }, { phase: Math.PI / 8, top: false });
      for (let k = 0; k < 8; k += 2) {
        const t = (k * Math.PI) / 4;
        b.rect(0.08, 0.3, BLUE, { at: [Math.sin(t) * 0.2, 1.22, Math.cos(t) * 0.2], ry: t });
      }
    },
    { shadowGroup: true },
  );
  const wh = 'kamazWhite';
  b.group({ at: [0, 1.66, 0] }, () => {
    b.lathe(scaleProfile(ONION, 0.27, 0.42, 0), 8, BLUE, undefined, { bands: [BLUE, wh, BLUE, wh, BLUE, wh] });
    b.cyl(0.09, 0.09, 0.2, 6, BLUE, { at: [0, 0.4, 0] });
    b.lathe(scaleProfile(ONION, 0.11, 0.2, 0.6), 6, 'gold');
    cross(b, [0, 0.8, 0], 0.55);
  });
}

/** Сосна: высокий красноватый ствол и три яруса хвои. */
function pine(b: Builder, x: number, z: number, y: number, s: number, c: Col): void {
  const k = 0.88 + (((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1) + 1) % 1 * 0.24;
  const cc = shade(c, k);
  b.group(
    { at: [x, y, z], s, ry: x * 3 + z },
    () => {
      b.cyl(0.07, 0.05, 0.75, 4, mix('wood', 'brickRed', 0.35), undefined, { top: false });
      b.cone(0.48, 0.7, 6, cc, { at: [0, 0.5, 0] });
      b.cone(0.38, 0.62, 6, shade(cc, 1.05), { at: [0, 0.9, 0] });
      b.cone(0.26, 0.5, 6, shade(cc, 1.1), { at: [0, 1.28, 0] });
    },
    { shadowGroup: true },
  );
}

/** Ива/ольха у берега. */
function willow(b: Builder, x: number, z: number, y: number, s: number): void {
  b.group(
    { at: [x, y, z], s, ry: x + z },
    () => {
      b.cyl(0.07, 0.06, 0.4, 4, 'wood', undefined, { top: false });
      b.lathe(
        [
          [0.2, 0.18],
          [0.5, 0.45],
          [0.55, 0.8],
          [0.32, 1.1],
          [0, 1.2],
        ],
        7,
        mix('forest', 'lowland', 0.45),
      );
    },
    { shadowGroup: true },
  );
}

export function buildRaifa(): Miniature {
  const b = new Builder();
  const G = plinth(b, 'lowland');
  const rim = ringXZ(4.66, 14);

  // Раифское озеро у западной стены
  const lake: P2[] = [
    [-5, -3.2],
    [-3.3, -2.7],
    [-2.55, -1.4],
    [-2.4, 0.3],
    [-2.6, 1.7],
    [-3.3, 2.9],
    [-5, 3.4],
  ];
  b.flat(clipConvex(lake, rim), G + 0.05, 'water');
  b.flat(
    clipConvex(
      lake.map(([x, z]): P2 => [x - 0.45, z * 0.85]),
      ringXZ(4.35, 14),
    ),
    G + 0.055,
    mix('water', 'waterDeep', 0.45),
  );
  // кувшинки
  for (const [x, z] of [
    [-2.85, -1.6],
    [-2.7, -1.2],
    [-3.0, -0.9],
    [-2.75, 2.0],
    [-3.0, 2.25],
  ] as P2[]) {
    b.flat(ringXZ(0.09, 5, x * 3, x, z), G + 0.065, mix('lowland', 'forest', 0.4));
  }
  // мостки
  b.box(1.15, 0.05, 0.3, mix('wood', 'stoneSand', 0.3), { at: [-2.95, G + 0.1, 0.55] });
  for (const x of [-3.4, -2.9]) for (const z of [0.43, 0.67]) b.box(0.05, 0.12, 0.05, 'wood', { at: [x, G, z], shadow: false });

  // стены монастыря
  const x0 = -1.9;
  const x1 = 3.0;
  const z0 = -2.7;
  const z1 = 1.7;
  const gx = 0.55;
  b.flat(
    [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ],
    G + 0.012,
    mix('stoneSand', 'stoneWhite', 0.35),
  );
  // дорожки: от ворот и вдоль берега к мосткам
  b.flat(
    [
      [gx - 0.3, z1],
      [gx + 0.3, z1],
      [gx + 0.6, 4.6],
      [gx - 0.2, 4.6],
    ],
    G + 0.012,
    mix('stoneSand', 'lowland', 0.3),
  );
  b.flat(
    [
      [x0, 0.4],
      [-2.4, 0.4],
      [-2.4, 0.7],
      [x0, 0.7],
    ],
    G + 0.012,
    mix('stoneSand', 'lowland', 0.3),
  );
  const segs: [P2, P2][] = [
    [
      [x0, z0],
      [x1, z0],
    ],
    [
      [x1, z0],
      [x1, z1],
    ],
    [
      [x1, z1],
      [gx + 0.48, z1],
    ],
    [
      [gx - 0.48, z1],
      [x0, z1],
    ],
    [
      [x0, z1],
      [x0, z0],
    ],
  ];
  for (const [p, q] of segs) {
    b.wall(p, q, 0.2, 0.55, WHITE, { at: [0, G, 0] }, { top: WTOP });
    b.wall(p, q, 0.24, 0.07, shade(WHITE, 0.92), { at: [0, G + 0.55, 0] }, { top: shade('roofGreen', 1.1) });
  }
  const tower = (x: number, z: number, r: number, h: number) => {
    b.group(
      { at: [x, G, z] },
      () => {
        b.cyl(r, r * 0.95, h, 10, WHITE, undefined, { top: false });
        b.cyl(r * 1.12, r * 1.12, 0.08, 10, WHITE, { at: [0, h, 0] }, { top: WTOP });
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.4;
          b.rect(0.06, 0.16, DARK, { at: [Math.sin(a) * (r * 0.97 + 0.01), h * 0.6, Math.cos(a) * (r * 0.97 + 0.01)], ry: a });
        }
        b.cone(r * 1.15, h * 0.95, 8, TENT, { at: [0, h + 0.08, 0] });
        b.cyl(0.015, 0.015, 0.25, 4, 'oilBlack', { at: [0, h + 0.08 + h * 0.9, 0] });
        b.box(0.12, 0.06, 0.01, 'oilBlack', { at: [0.05, h + 0.08 + h * 0.9 + 0.18, 0] });
      },
      { shadowGroup: true },
    );
  };
  tower(x0, z0, 0.3, 1.0);
  tower(x1, z0, 0.3, 1.0);
  tower(x1, z1, 0.3, 1.0);
  tower(x0, z1, 0.3, 1.0);
  tower(x1, -0.5, 0.22, 0.8);
  tower(0.5, z0, 0.22, 0.8);

  // надвратная колокольня
  b.group({ at: [gx, G, z1] }, () => bellTower(b));
  // соборы
  b.group({ at: [-0.85, G, -1.0] }, () => trinityCathedral(b));
  b.group({ at: [2.15, G, -1.2] }, () => georgianCathedral(b));
  b.group({ at: [2.35, G, 0.75] }, () => checkerTower(b));
  // братский корпус вдоль северной стены
  b.group({ at: [-0.2, G, -2.25] }, () => {
    b.box(2.6, 0.95, 0.62, WHITE, undefined, { top: WTOP });
    b.gable(2.7, 0.74, 0.3, 'roofGreen', { at: [0, 0.95, 0] }, { ends: WHITE });
    for (let i = 0; i < 7; i++) {
      const x = -1.08 + i * 0.36;
      b.rect(0.12, 0.2, DARK, { at: [x, 0.18, 0.315] });
      b.rect(0.12, 0.2, DARK, { at: [x, 0.58, 0.315] });
    }
  });
  // паломники во дворе
  for (const [x, z, c] of [
    [0.3, 0.9, 'oilBlack'],
    [0.45, 1.0, 'roofBlue'],
    [1.1, 0.2, 'accent'],
    [0.9, 3.1, 'oilBlack'],
  ] as [number, number, Col][]) {
    b.group({ at: [x, G, z] }, () => {
      b.cyl(0.06, 0.045, 0.2, 5, c);
      b.box(0.065, 0.065, 0.065, mix('stoneSand', 'accent', 0.2), { at: [0, 0.2, 0] });
    }, { shadowGroup: true });
  }

  // сосновый бор заповедника
  const pines: [number, number, number][] = [
    [-1.2, -3.55, 0.95],
    [-0.1, -3.4, 1.05],
    [0.95, -3.75, 0.9],
    [2.0, -3.45, 1.0],
    [3.05, -3.35, 0.9],
    [-2.2, -3.0, 0.85],
    [-0.65, -4.2, 0.8],
    [1.5, -4.25, 0.75],
    [3.8, -2.2, 1.0],
    [3.75, -1.0, 0.95],
    [4.2, 0.0, 0.85],
    [3.7, 0.9, 1.05],
    [4.1, -1.65, 0.75],
    [3.65, 2.1, 0.9],
    [2.85, 2.75, 1.0],
    [1.85, 2.45, 0.8],
    [2.1, 3.6, 0.95],
    [-0.35, 2.55, 0.85],
    [-0.9, 3.55, 1.0],
    [0.25, 4.1, 0.8],
    [-1.75, 2.75, 0.9],
    [3.25, 3.1, 0.75],
    [1.45, 4.25, 0.7],
  ];
  pines.forEach(([x, z, s], i) => pine(b, x, z, G, s, i % 3 === 0 ? mix('forest', 'roofGreen', 0.3) : 'forest'));
  willow(b, -2.1, -2.2, G, 0.75);
  willow(b, -2.05, 2.2, G, 0.85);
  willow(b, -1.6, 3.4, G, 0.7);

  // лодка на озере — отдельный меш, покачивается и медленно дрейфует
  const boat = new Builder(0);
  boat.group({ shadow: false }, () => {
    boat.profile(
      [
        [-0.28, 0.02],
        [0.22, 0.02],
        [0.36, 0.12],
        [-0.33, 0.12],
      ],
      0.2,
      BLUE,
      undefined,
      { caps: shade(BLUE, 0.9) },
    );
    boat.box(0.5, 0.012, 0.16, mix('wood', 'stoneSand', 0.3), { at: [0, 0.1, 0] });
    boat.cyl(0.05, 0.04, 0.16, 5, 'accent', { at: [-0.08, 0.1, 0] });
    boat.box(0.06, 0.06, 0.06, mix('stoneSand', 'accent', 0.2), { at: [-0.08, 0.26, 0] });
    boat.box(0.03, 0.02, 0.5, 'wood', { at: [-0.05, 0.16, 0], rz: 0.15 });
  });
  const mini = assemble('raifa', [b, boat]);
  const m = mini.group.children[1] as THREE.Mesh;
  mini.update = (t: number) => {
    m.position.set(-3.55 + Math.sin(t * 0.21) * 0.25, G + 0.05 + Math.sin(t * 1.6) * 0.012, -0.5 + Math.cos(t * 0.17) * 0.35);
    m.rotation.set(Math.sin(t * 1.3) * 0.05, 0.6 + Math.sin(t * 0.21) * 0.25, Math.sin(t * 1.1 + 1) * 0.04);
  };
  mini.update(0);
  return mini;
}
