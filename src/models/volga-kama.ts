// Слияние Волги и Камы (Куйбышевское водохранилище у Камского Устья): широкий плёс,
// высокий правый берег с обрывами (рыжие глины, белые известняки, травяные уступы), наверху —
// посёлок и сосновый бор; низкая песчаная стрелка с полосатым маяком. По воде идут теплоход,
// буксир с баржей, «Метеор» на подводных крыльях (кружит по плёсу) и парусник; бакены
// покачиваются, над водой летают чайки.
import * as THREE from 'three';
import { Builder, assemble, clipConvex, groundShadow, mix, ngon, plinth, ringXZ, shade, type Col, type Miniature, type P2 } from './kit';

/** Бровка обрыва (с запада на восток); плато — справа по ходу, к +X/−Z. */
const CLIFF: P2[] = [
  [-3.0, -4.6],
  [-2.2, -3.3],
  [-1.0, -2.6],
  [0.1, -1.7],
  [1.2, -1.2],
  [2.2, -0.3],
  [3.0, 0.6],
  [4.2, 1.2],
  [5.2, 1.5],
];
/** Направление вглубь плато. */
const IN: P2 = [0.6, -0.8];

const SPIT: P2[] = [
  [-4.8, 0.45],
  [-3.2, 1.0],
  [-2.1, 1.6],
  [-1.55, 1.95],
  [-2.1, 2.4],
  [-3.2, 2.6],
  [-4.8, 3.0],
];

/** Многоугольник плато, бровка сдвинута вглубь на off (с лёгкой «эрозией»). */
function plateau(off: number, layer: number, rim: P2[]): P2[] {
  const line = CLIFF.map(([x, z], i): P2 => {
    const o = off + (i > 0 && i < CLIFF.length - 1 ? Math.sin(i * 2.3 + layer * 1.7) * 0.07 : 0);
    return [x + IN[0] * o, z + IN[1] * o];
  });
  return clipConvex([...line, [6, 1.5], [6, -6], [-3.5, -6]], rim);
}

/** Многоугольник, раздутый от центра масс на d (для мелководья вокруг стрелки). */
function inflate(pts: P2[], d: number): P2[] {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map(([x, z]) => {
    const l = Math.hypot(x - cx, z - cz) || 1;
    return [x + ((x - cx) / l) * d, z + ((z - cz) / l) * d];
  });
}

/** Сосна. */
function pine(b: Builder, x: number, z: number, y: number, s: number): void {
  const k = 0.88 + (((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1) + 1) % 1 * 0.24;
  const cc = shade(mix('forest', 'roofGreen', 0.2), k);
  b.group(
    { at: [x, y, z], s, ry: x * 3 + z },
    () => {
      b.cyl(0.07, 0.05, 0.6, 4, mix('wood', 'brickRed', 0.35), undefined, { top: false });
      b.cone(0.46, 0.66, 6, cc, { at: [0, 0.4, 0] });
      b.cone(0.34, 0.58, 6, shade(cc, 1.06), { at: [0, 0.78, 0] });
      b.cone(0.22, 0.45, 6, shade(cc, 1.12), { at: [0, 1.12, 0] });
    },
    { shadowGroup: true },
  );
}

/** Ива на низком берегу. */
function willow(b: Builder, x: number, z: number, y: number, s: number): void {
  b.group(
    { at: [x, y, z], s, ry: x + z },
    () => {
      b.cyl(0.07, 0.06, 0.38, 4, 'wood', undefined, { top: false });
      b.lathe(
        [
          [0.2, 0.15],
          [0.5, 0.42],
          [0.55, 0.78],
          [0.32, 1.05],
          [0, 1.15],
        ],
        7,
        mix('forest', 'lowland', 0.5),
      );
    },
    { shadowGroup: true },
  );
}

/** Простая вальмовая крыша w×d (конёк вдоль X). */
function hipRoofLite(b: Builder, w: number, d: number, h: number, c: Col, at: [number, number, number]): void {
  const x = w / 2;
  const z = d / 2;
  const r = x - z;
  b.group(
    { at },
    () => {
      b.tri([-x, 0, z], [x, 0, z], [r, h, 0], c, [0, z, h]);
      b.tri([-x, 0, z], [r, h, 0], [-r, h, 0], c, [0, z, h]);
      b.tri([x, 0, -z], [-x, 0, -z], [-r, h, 0], c, [0, z, -h]);
      b.tri([x, 0, -z], [-r, h, 0], [r, h, 0], c, [0, z, -h]);
      b.tri([x, 0, z], [x, 0, -z], [r, h, 0], shade(c, 0.95), [h, z, 0]);
      b.tri([-x, 0, -z], [-x, 0, z], [-r, h, 0], shade(c, 0.95), [-h, z, 0]);
    },
    { shadowGroup: true },
  );
}

/** Сельский дом с двускатной крышей. */
function cottage(b: Builder, x: number, z: number, y: number, ry: number, wall: Col, roof: Col): void {
  b.group({ at: [x, y, z], ry }, () => {
    b.box(0.5, 0.32, 0.4, wall);
    b.gable(0.58, 0.48, 0.22, roof, { at: [0, 0.32, 0] }, { ends: wall });
    b.rect(0.1, 0.1, mix('roofDark', 'glass', 0.4), { at: [-0.12, 0.12, 0.202] });
    b.rect(0.1, 0.1, mix('roofDark', 'glass', 0.4), { at: [0.12, 0.12, 0.202] });
  });
}

/** Теплоход: тёмный корпус, три белые палубы с полосами окон, рубка, труба. Нос к +X. */
function cruiseShip(b: Builder): void {
  const hull = 'roofBlue';
  const wh = 'kamazWhite';
  const glass = mix('roofDark', 'glass', 0.35);
  b.profile(
    [
      [-1.45, 0],
      [1.15, 0],
      [1.6, 0.36],
      [-1.5, 0.36],
    ],
    0.72,
    hull,
    undefined,
    { caps: hull },
  );
  b.profile(
    [
      [-1.5, 0.36],
      [1.6, 0.36],
      [1.64, 0.44],
      [-1.5, 0.44],
    ],
    0.75,
    wh,
  );
  b.box(0.6, 0.012, 0.74, 'accent', { at: [-0.3, 0.2, 0] }, { top: hull });
  const decks: [number, number, number, number][] = [
    // y, длина, ширина, сдвиг по x
    [0.44, 2.45, 0.64, -0.15],
    [0.76, 2.0, 0.56, -0.25],
    [1.06, 1.3, 0.5, -0.1],
  ];
  for (const [y, len, w, x] of decks) {
    b.box(len, 0.3, w, wh, { at: [x, y, 0] }, { top: shade(wh, 0.92) });
    b.box(len + 0.06, 0.03, w + 0.06, shade(wh, 0.9), { at: [x, y + 0.3, 0] });
    for (const s of [1, -1]) b.rect(len - 0.12, 0.1, glass, { at: [x, y + 0.1, s * (w / 2 + 0.004)], ry: s > 0 ? 0 : Math.PI });
    b.rect(w - 0.1, 0.1, glass, { at: [x + len / 2 + 0.004, y + 0.1, 0], ry: Math.PI / 2 });
  }
  // рубка, труба, мачта, шлюпки
  b.box(0.42, 0.22, 0.5, wh, { at: [0.35, 1.36, 0] });
  b.rect(0.46, 0.08, glass, { at: [0.565, 1.47, 0], ry: Math.PI / 2 });
  b.cyl(0.11, 0.1, 0.36, 8, 'accent', { at: [-0.5, 1.36, 0] }, { top: 'roofDark' });
  b.box(0.23, 0.06, 0.23, wh, { at: [-0.5, 1.5, 0] }, { top: 'accent' });
  b.box(0.03, 0.45, 0.03, 'roofDark', { at: [0.62, 1.58, 0] });
  for (const s of [1, -1]) for (const x of [-0.75, 0.15]) b.box(0.28, 0.08, 0.1, 'accent', { at: [x, 0.98, s * 0.33] });
  b.box(0.05, 0.25, 0.03, 'accent', { at: [-1.48, 0.44, 0] });
  b.box(0.18, 0.12, 0.01, 'kamazWhite', { at: [-1.4, 0.58, 0] });
}

/** Метеор на подводных крыльях. Нос к +X; низ — у y = 0 (уровень воды). */
function meteor(b: Builder): void {
  const wh = 'kamazWhite';
  const dark = 'oilBlack';
  b.profile(
    [
      [-0.62, 0.1],
      [0.48, 0.1],
      [0.66, 0.2],
      [0.6, 0.27],
      [-0.64, 0.27],
    ],
    0.3,
    wh,
  );
  b.profile(
    [
      [-0.48, 0.27],
      [0.34, 0.27],
      [0.18, 0.4],
      [-0.42, 0.4],
    ],
    0.25,
    wh,
    undefined,
    { caps: wh },
  );
  for (const s of [1, -1]) {
    b.rect(0.7, 0.07, mix('roofDark', 'glass', 0.3), { at: [-0.1, 0.3, s * 0.127], ry: s > 0 ? 0 : Math.PI });
    b.rect(1.1, 0.03, 'accent', { at: [-0.05, 0.16, s * 0.152], ry: s > 0 ? 0 : Math.PI });
  }
  b.rect(0.2, 0.08, mix('roofDark', 'glass', 0.3), { at: [0.26, 0.3, 0], ry: Math.PI / 2, rx: -0.6 });
  // крылья и стойки
  for (const x of [0.32, -0.42]) {
    b.box(0.1, 0.02, 0.5, dark, { at: [x, 0.0, 0] });
    for (const s of [1, -1]) b.box(0.03, 0.1, 0.03, dark, { at: [x, 0.0, s * 0.18] });
  }
}

/** Буксир-толкач с баржей песка. Нос баржи к +X. */
function tugAndBarge(b: Builder): void {
  b.box(1.3, 0.16, 0.5, mix('brickRed', 'oilBlack', 0.3), undefined, { top: mix('roofDark', 'brickRed', 0.3) });
  b.lathe(
    [
      [0.3, 0.16],
      [0.18, 0.34],
      [0, 0.38],
    ],
    6,
    mix('stoneSand', 'gold', 0.2),
    { at: [0.1, 0, 0], s: [1.8, 1, 0.75] },
  );
  b.group({ at: [-0.93, 0, 0] }, () => {
    b.box(0.55, 0.18, 0.42, 'roofDark', undefined, { top: shade('roofDark', 1.1) });
    b.box(0.3, 0.22, 0.32, 'kamazWhite', { at: [-0.05, 0.18, 0] });
    b.box(0.22, 0.14, 0.28, 'kamazWhite', { at: [-0.02, 0.4, 0] });
    b.rect(0.24, 0.05, mix('roofDark', 'glass', 0.35), { at: [0.091, 0.47, 0], ry: Math.PI / 2 });
    b.cyl(0.04, 0.04, 0.14, 6, 'accent', { at: [-0.13, 0.4, 0] }, { top: 'oilBlack' });
  });
}

/** Полосатый маяк на стрелке. */
function lighthouse(b: Builder): void {
  const red = 'accent';
  const wh = 'kamazWhite';
  b.group(
    {},
    () => {
      b.cyl(0.42, 0.38, 0.22, 10, mix('stoneWhite', 'steel', 0.35));
      b.lathe(
        [
          [0.3, 0.22],
          [0.28, 0.62],
          [0.26, 1.02],
          [0.24, 1.42],
          [0.22, 1.82],
          [0.2, 2.22],
          [0.185, 2.55],
        ],
        10,
        wh,
        undefined,
        { bands: [red, wh, red, wh, red, wh], capTop: false },
      );
      for (const [y, a] of [
        [0.75, 0.4],
        [1.55, 0.4],
      ]) b.rect(0.07, 0.13, mix('roofDark', 'glass', 0.4), { at: [Math.sin(a) * 0.255, y, Math.cos(a) * 0.255], ry: a });
      b.cyl(0.34, 0.34, 0.06, 12, 'roofDark', { at: [0, 2.55, 0] });
      b.arc(0.3, 0.33, 0, Math.PI * 2, 0.12, 12, 'roofDark', { at: [0, 2.61, 0] });
      b.cyl(0.15, 0.15, 0.3, 8, mix('gold', 'kamazWhite', 0.45), { at: [0, 2.61, 0] }, { top: false });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        b.box(0.025, 0.3, 0.025, 'roofDark', { at: [Math.sin(a) * 0.15, 2.61, Math.cos(a) * 0.15], shadow: false });
      }
      b.lathe(
        [
          [0.22, 2.91],
          [0.16, 3.07],
          [0.04, 3.2],
          [0, 3.22],
        ],
        8,
        red,
      );
      b.cyl(0.015, 0.015, 0.2, 4, 'roofDark', { at: [0, 3.2, 0] });
    },
    { shadowGroup: true },
  );
  // домик смотрителя
  b.box(0.42, 0.3, 0.34, 'kamazWhite', { at: [-0.55, 0, 0.18] });
  b.gable(0.5, 0.42, 0.18, red, { at: [-0.55, 0.3, 0.18] }, { ends: 'kamazWhite' });
}

/** Бакен (низ у y = 0). */
function buoy(b: Builder, c: Col): void {
  b.cyl(0.12, 0.1, 0.08, 6, 'roofDark');
  b.cyl(0.1, 0.03, 0.34, 6, c, { at: [0, 0.08, 0] });
  b.box(0.04, 0.05, 0.04, 'kamazWhite', { at: [0, 0.4, 0] });
}

/** Парусник (низ у y = 0), нос к +X. */
function sailboat(b: Builder): void {
  b.profile(
    [
      [-0.26, 0],
      [0.2, 0],
      [0.34, 0.1],
      [-0.28, 0.1],
    ],
    0.16,
    'kamazWhite',
    undefined,
    { caps: 'kamazWhite' },
  );
  b.box(0.02, 0.62, 0.02, 'roofDark', { at: [0.02, 0.1, 0] });
  b.tri([0.03, 0.16, 0], [0.03, 0.7, 0], [0.3, 0.16, 0], 'kamazWhite', [0, 0, 1]);
  b.tri([0.03, 0.16, 0], [0.03, 0.7, 0], [0.3, 0.16, 0], 'kamazWhite', [0, 0, -1]);
  b.tri([0.0, 0.14, 0], [0.0, 0.66, 0], [-0.24, 0.14, 0], shade('kamazWhite', 0.92), [0, 0, 1]);
  b.tri([0.0, 0.14, 0], [0.0, 0.66, 0], [-0.24, 0.14, 0], shade('kamazWhite', 0.92), [0, 0, -1]);
}

/** Чайка: два крыла-треугольника. */
function gull(b: Builder): void {
  const c = 'kamazWhite';
  b.tri([0, 0, 0.0], [-0.06, 0.02, 0.18], [0.06, 0.0, 0.0], c, [0, 1, 0]);
  b.tri([0, 0, 0.0], [-0.06, 0.02, -0.18], [0.06, 0.0, 0.0], c, [0, 1, 0]);
  b.tri([0.06, 0, 0], [-0.06, 0.02, 0.18], [-0.08, 0.0, 0.0], shade(c, 0.85), [0, -1, 0]);
  b.tri([0.06, 0, 0], [-0.06, 0.02, -0.18], [-0.08, 0.0, 0.0], shade(c, 0.85), [0, -1, 0]);
}

/** Кильватерный след за кормой: светлый клин на воде (в координатах судна, корма у x0). */
function wake(b: Builder, x0: number, len: number, half: number, y: number): void {
  const c = mix('water', 'kamazWhite', 0.55);
  b.tri([x0, y, 0.05], [x0 - len, y, half], [x0 - len * 0.6, y, half * 0.45], c, [0, 1, 0], { shadow: false, ao: false });
  b.tri([x0, y, -0.05], [x0 - len, y, -half], [x0 - len * 0.6, y, -half * 0.45], c, [0, 1, 0], { shadow: false, ao: false });
  b.tri([x0 + 0.1, y, 0.12], [x0 - len * 0.5, y, 0.02], [x0 + 0.1, y, -0.12], mix('water', 'kamazWhite', 0.3), [0, 1, 0], { shadow: false, ao: false });
}

export function buildVolgaKama(): Miniature {
  const b = new Builder();
  // верх фишки — вода плёса; тени судов ложатся прямо на неё
  const G = plinth(b, 'water');
  const rim = ringXZ(4.7, 14);

  // глубокий фарватер, более тёмная камская вода в протоке и мелководья у берегов
  b.flat(clipConvex(ngon(2.6, 12, 0, 0.2, 1.4), ringXZ(4.3, 14)), G + 0.004, mix('water', 'waterDeep', 0.5));
  const kama = mix('waterDeep', 'roofGreen', 0.18);
  b.flat(
    clipConvex(
      [
        [-5, -3.6],
        [-0.4, -1.4],
        [-0.9, 0.9],
        [-5, 0.6],
      ],
      ringXZ(4.66, 14),
    ),
    G + 0.006,
    mix('water', kama, 0.45),
  );
  b.flat(
    clipConvex(
      [
        [-5, -3.6],
        [-1.9, -2.2],
        [-2.6, 0.75],
        [-5, 0.6],
      ],
      ringXZ(4.66, 14),
    ),
    G + 0.008,
    kama,
  );
  // рябь
  for (const [x, z, l] of [
    [0.6, 3.6, 0.35],
    [2.2, 3.0, 0.3],
    [-0.9, 2.9, 0.28],
    [3.3, 2.2, 0.25],
    [1.6, 1.0, 0.3],
    [-3.3, -0.4, 0.3],
    [-2.6, -1.6, 0.25],
    [0.0, 3.9, 0.22],
  ] as [number, number, number][]) {
    b.flat(
      [
        [x - l, z],
        [x + l, z - 0.02],
        [x + l * 0.8, z + 0.035],
        [x - l * 0.8, z + 0.035],
      ],
      G + 0.012,
      mix('water', 'kamazWhite', 0.25),
    );
  }
  b.flat(plateau(-0.55, 0, rim), G + 0.01, mix('water', 'stoneSand', 0.22));
  b.flat(clipConvex(inflate(SPIT, 0.32), rim), G + 0.01, mix('water', 'stoneSand', 0.22));

  // высокий правый берег: пляж, рыжие глины, белые известняки, травяной склон
  const ochre = mix('brickRed', 'stoneSand', 0.35);
  const chalk = mix('stoneWhite', 'stoneSand', 0.3);
  const ledge = mix('lowland', 'plain', 0.4);
  const slope = mix('lowland', 'forest', 0.35);
  b.extrude(plateau(-0.24, 0, rim), 0.06, 'stoneSand', { at: [0, G, 0], shadow: false });
  b.extrude(plateau(0, 1, rim), 0.5, ochre, { at: [0, G, 0], shadow: false }, { top: ledge });
  b.extrude(plateau(0.18, 2, rim), 0.45, chalk, { at: [0, G + 0.5, 0], shadow: false }, { top: ledge });
  b.extrude(plateau(0.34, 3, rim), 0.35, slope, { at: [0, G + 0.95, 0], shadow: false }, { top: 'lowland' });
  const T = G + 1.3; // верх плато
  const shadowCol = groundShadow('lowland');
  const blob = (x: number, z: number, r: number) => b.flat(ngon(r, 6, 0.3, x + r * 0.45, z - r * 0.4), T + 0.008, shadowCol);

  // дорога по плато
  const road: P2[] = [
    [-0.9, -3.2],
    [0.6, -2.55],
    [2.0, -1.85],
    [3.1, -1.0],
    [4.0, -0.2],
  ];
  for (let i = 0; i < road.length - 1; i++) {
    const [ax, az] = road[i];
    const [cx, cz] = road[i + 1];
    const l = Math.hypot(cx - ax, cz - az);
    const nx = (-(cz - az) / l) * 0.09;
    const nz = ((cx - ax) / l) * 0.09;
    b.flat(
      [
        [ax + nx, az + nz],
        [cx + nx, cz + nz],
        [cx - nx, cz - nz],
        [ax - nx, az - nz],
      ],
      T + 0.006,
      mix('stoneSand', 'lowland', 0.25),
    );
  }

  // посёлок Камское Устье
  const houses: [number, number, number, Col, Col][] = [
    [0.1, -3.05, 0.4, mix('stoneSand', 'stoneWhite', 0.4), 'brickRed'],
    [1.0, -2.95, 0.45, mix('glass', 'roofBlue', 0.3), 'steel'],
    [1.75, -2.45, 0.5, 'stoneSand', 'roofGreen'],
    [2.65, -1.9, 0.6, mix('stoneWhite', 'gold', 0.3), 'roofBlue'],
    [3.4, -1.35, 0.7, mix('stoneSand', 'stoneWhite', 0.4), 'brickRed'],
    [3.95, -0.75, 0.75, mix('roofGreen', 'glass', 0.4), 'steel'],
    [2.4, -3.0, 0.5, mix('stoneWhite', 'gold', 0.3), 'brickRed'],
    [3.3, -2.35, 0.6, mix('glass', 'roofBlue', 0.3), 'roofGreen'],
  ];
  for (const [x, z, ry, w, r] of houses) {
    cottage(b, x, z, T, ry, w, r);
    blob(x, z, 0.32);
  }
  // сельская мечеть с минаретом
  b.group({ at: [1.6, T, -1.85], ry: 0.55 }, () => {
    b.box(0.7, 0.42, 0.5, 'stoneWhite', undefined, { top: shade('stoneWhite', 0.9) });
    b.pyramid(0.78, 0.58, 0.2, 'roofGreen', { at: [0, 0.42, 0] });
    b.cyl(0.09, 0.09, 0.75, 8, 'stoneWhite', { at: [0.25, 0.42, 0] });
    b.cyl(0.13, 0.13, 0.04, 8, 'roofGreen', { at: [0.25, 0.85, 0] });
    b.cone(0.11, 0.35, 8, 'roofGreen', { at: [0.25, 1.17, 0] });
    b.cone(0.02, 0.15, 4, 'gold', { at: [0.25, 1.5, 0] });
  });
  blob(1.6, -1.85, 0.42);
  // беседка-смотровая и створный знак на бровке
  b.group({ at: [-0.25, T, -2.45] }, () => {
    b.box(0.03, 0.75, 0.03, 'roofDark');
    b.box(0.24, 0.34, 0.02, 'kamazWhite', { at: [0, 0.48, 0.02] });
    b.box(0.06, 0.34, 0.025, 'accent', { at: [0, 0.48, 0.022] });
  });
  // сосновый бор вдоль дальнего края плато
  const pines: [number, number, number][] = [
    [-1.9, -3.75, 0.8],
    [-1.25, -4.05, 0.9],
    [-0.5, -3.9, 0.8],
    [-0.15, -4.4, 0.75],
    [0.75, -4.2, 0.9],
    [1.55, -3.75, 0.8],
    [2.2, -3.75, 0.7],
    [3.0, -3.2, 0.85],
    [3.8, -2.45, 0.8],
    [4.25, -1.55, 0.75],
    [4.45, -0.45, 0.7],
    [-0.95, -3.4, 0.65],
    [-2.45, -3.85, 0.7],
    [-1.6, -4.4, 0.65],
    [0.3, -4.55, 0.6],
    [1.2, -4.45, 0.65],
    [1.95, -4.2, 0.6],
    [2.7, -3.85, 0.65],
    [3.45, -3.25, 0.6],
    [4.1, -2.55, 0.6],
    [4.5, -1.1, 0.55],
    [0.35, -3.75, 0.6],
  ];
  for (const [x, z, s] of pines) {
    pine(b, x, z, T, s);
    blob(x, z, 0.4 * s);
  }

  // низкая песчаная стрелка с ивами и маяком
  b.extrude(clipConvex(inflate(SPIT, 0.1), rim), 0.05, 'stoneSand', { at: [0, G, 0], shadow: false });
  b.extrude(clipConvex(inflate(SPIT, -0.12), rim), 0.04, mix('lowland', 'plain', 0.3), { at: [0, G + 0.05, 0], shadow: false });
  const S = G + 0.09;
  willow(b, -3.75, 1.75, S, 0.8);
  willow(b, -4.25, 2.35, S, 0.6);
  willow(b, -3.0, 2.0, S, 0.65);
  b.group({ at: [-1.95, S, 1.98], s: 0.88 }, () => lighthouse(b));

  // камыш по краю стрелки и валуны на пляже под обрывом
  for (const [x, z] of [
    [-1.75, 1.75],
    [-2.0, 2.3],
    [-2.6, 1.35],
    [-3.4, 1.0],
    [-2.9, 2.55],
  ] as P2[]) {
    for (let i = 0; i < 3; i++) b.cone(0.04, 0.32 + i * 0.06, 3, mix('lowland', 'gold', 0.25), { at: [x + i * 0.07, G + 0.05, z + (i % 2) * 0.06] });
  }
  for (const [x, z, r] of [
    [-1.55, -2.55, 0.12],
    [-0.45, -1.85, 0.1],
    [1.75, -0.65, 0.09],
    [3.35, 1.0, 0.12],
    [3.9, 1.45, 0.09],
  ] as [number, number, number][]) {
    b.cyl(r, r * 0.6, r * 0.9, 5, mix('stoneWhite', 'steel', 0.5), { at: [x, G + 0.04, z], ry: x * 2 });
  }
  // рыбацкая лодка у стрелки
  b.group({ at: [-2.85, G, 0.55], ry: 0.4 }, () => {
    b.profile(
      [
        [-0.25, 0.02],
        [0.2, 0.02],
        [0.32, 0.12],
        [-0.27, 0.12],
      ],
      0.18,
      mix('roofGreen', 'steel', 0.3),
      undefined,
      { caps: shade(mix('roofGreen', 'steel', 0.3), 0.9) },
    );
    b.cyl(0.05, 0.04, 0.15, 5, 'gold', { at: [-0.05, 0.1, 0] });
    b.box(0.06, 0.06, 0.06, mix('stoneSand', 'accent', 0.2), { at: [-0.05, 0.25, 0] });
    b.box(0.015, 0.015, 0.5, 'wood', { at: [0.05, 0.3, 0.15], rx: -0.9 });
  });

  // теплоход в протоке под обрывом, с кильватерным следом
  b.group({ at: [-0.95, G, -0.85], ry: -0.5, s: 0.74 }, () => {
    cruiseShip(b);
    wake(b, -1.45, 1.6, 0.7, 0.04);
  });
  // буксир с баржей у причала
  b.group({ at: [2.0, G, 0.4], ry: -0.73 }, () => tugAndBarge(b));
  b.group({ at: [2.42, G, -0.1], ry: -0.73 }, () => {
    b.box(0.14, 0.05, 0.62, mix('wood', 'stoneSand', 0.3), { at: [0.1, 0.12, 0.2] });
    for (const z of [0.0, 0.4]) b.box(0.04, 0.17, 0.04, 'wood', { at: [0.1, 0, z], shadow: false });
  });
  // дебаркадер у подножия обрыва и лестница на плато
  b.group({ at: [1.15, G, -0.72], ry: -0.43 }, () => {
    b.box(1.0, 0.1, 0.4, 'roofDark', undefined, { top: mix('wood', 'stoneSand', 0.4) });
    b.box(0.72, 0.26, 0.32, 'kamazWhite', { at: [0, 0.1, 0] });
    b.box(0.5, 0.2, 0.26, 'kamazWhite', { at: [0, 0.36, 0] });
    hipRoofLite(b, 0.6, 0.34, 0.12, 'roofBlue', [0, 0.56, 0]);
    for (const s of [1, -1]) {
      b.rect(0.6, 0.07, mix('roofDark', 'glass', 0.35), { at: [0, 0.2, s * 0.162], ry: s > 0 ? 0 : Math.PI });
      b.rect(0.4, 0.06, mix('roofDark', 'glass', 0.35), { at: [0, 0.44, s * 0.132], ry: s > 0 ? 0 : Math.PI });
    }
    b.rect(0.3, 0.06, 'accent', { at: [0, 0.29, 0.163] });
  });
  const st0: [number, number, number] = [0.47, G + 0.06, -1.24];
  const st1: [number, number, number] = [0.86, T, -1.78];
  {
    const dx = st1[0] - st0[0];
    const dy = st1[1] - st0[1];
    const dz = st1[2] - st0[2];
    const hor = Math.hypot(dx, dz);
    b.box(Math.hypot(hor, dy), 0.04, 0.12, mix('stoneSand', 'wood', 0.3), {
      at: [(st0[0] + st1[0]) / 2, (st0[1] + st1[1]) / 2, (st0[2] + st1[2]) / 2],
      ry: Math.atan2(-dz, dx),
      rz: Math.atan2(dy, hor),
      shadow: false,
    });
  }

  // покачивающиеся объекты: парусник, бакены, чайки — один меш, трансформы на CPU
  interface Bob {
    x: number;
    z: number;
    y: number;
    ry: number;
    kind: 'float' | 'gull';
    phase: number;
    r?: number;
  }
  const bobs: Bob[] = [
    { x: 1.0, z: 2.1, y: G, ry: 0.4, kind: 'float', phase: 0 },
    { x: -0.25, z: 0.55, y: G, ry: 0, kind: 'float', phase: 1.3 },
    { x: -0.4, z: 3.65, y: G, ry: 0, kind: 'float', phase: 2.2 },
    { x: 2.75, z: 3.5, y: G, ry: 0, kind: 'float', phase: 3.1 },
    { x: 0.6, z: 0.6, y: G + 2.9, ry: 0, kind: 'gull', phase: 0, r: 0.9 },
    { x: 0.6, z: 0.6, y: G + 3.2, ry: 0, kind: 'gull', phase: 2.4, r: 0.65 },
    { x: -2.2, z: 0.3, y: G + 2.6, ry: 0, kind: 'gull', phase: 4.0, r: 0.5 },
  ];
  const floats = new Builder(0);
  const ranges: [number, number][] = [];
  bobs.forEach((o, i) => {
    const s = floats.triangles;
    if (i === 0) sailboat(floats);
    else if (o.kind === 'float') buoy(floats, i === 3 ? 'roofGreen' : 'accent');
    else gull(floats);
    ranges.push([s * 3, floats.triangles * 3]);
  });

  // «Метеор» — отдельный меш, кружит по плёсу; тень едет вместе с ним
  const hydro = new Builder(0);
  hydro.shadowPlane = { y: 0, poly: ringXZ(1.2, 8), color: groundShadow('water') };
  meteor(hydro);
  wake(hydro, -0.62, 0.9, 0.4, 0.035);

  const mini = assemble('volga-kama', [b, floats, hydro]);
  const fm = mini.group.children[1] as THREE.Mesh;
  const hm = mini.group.children[2] as THREE.Mesh;
  fm.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, 0), 6.5);
  const pos = fm.geometry.getAttribute('position') as THREE.BufferAttribute;
  const rest = Float32Array.from(pos.array as Float32Array);
  const out = pos.array as Float32Array;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const hx = 1.0;
  const hz = 2.1;
  const hrx = 1.6;
  const hrz = 0.95;

  mini.update = (t: number) => {
    bobs.forEach((o, k) => {
      if (o.kind === 'float') {
        e.set(Math.sin(t * 1.4 + o.phase) * 0.08, o.ry, Math.sin(t * 1.1 + o.phase * 2) * 0.1, 'YXZ');
        v.set(o.x, o.y + Math.sin(t * 1.7 + o.phase) * 0.02, o.z);
      } else {
        const a = t * 0.5 + o.phase;
        const flap = Math.sin(t * 6 + o.phase) * 0.35;
        e.set(0, -a - Math.PI / 2, flap * 0.3, 'YXZ');
        v.set(o.x + Math.cos(a) * o.r!, o.y + Math.sin(t * 0.8 + o.phase) * 0.15, o.z + Math.sin(a) * o.r!);
      }
      m.compose(v, q.setFromEuler(e), one);
      const [s, end] = ranges[k];
      for (let i = s; i < end; i++) {
        v.fromArray(rest, i * 3).applyMatrix4(m);
        out[i * 3] = v.x;
        out[i * 3 + 1] = v.y;
        out[i * 3 + 2] = v.z;
      }
    });
    pos.needsUpdate = true;

    const a = t * 0.22;
    hm.position.set(hx + Math.cos(a) * hrx, G, hz + Math.sin(a) * hrz);
    hm.rotation.y = -Math.atan2(Math.cos(a) * hrz, -Math.sin(a) * hrx);
  };
  mini.update(0);
  return mini;
}
