// Альметьевск и Ромашкинское месторождение: три станка-качалки (балансир, кривошипы
// с противовесами, шатуны и канатная подвеска анимированы в update), штаб-квартира
// «Татнефти» — волнистая стеклянная башня и чёрный куб, резервуарный парк
// и памятник «Скважина № 3» на ступенчатом постаменте.
import * as THREE from 'three';
import { Builder, assemble, mix, plinth, shade, type Col, type Miniature, type P2, type P3 } from './kit';
import { roundTree, tree } from './archi';

// ---------- станок-качалка: размеры в локальных единицах станка ----------
const PIVOT: P2 = [0, 2.1]; // ось балансира на вершине стойки
const CRANK: P2 = [-1.3, 0.95]; // ось кривошипов над редуктором
const RC = 0.4; // радиус пальца кривошипа
const LR = 1.3; // задее плечо балансира
const HEAD_R = 1.42; // радиус дуги головки (центр — ось балансира)
const EQ: P2 = [-1.3, -0.2]; // точка подвеса шатунов на траверсе (относительно оси)
const CARRIER_Y = 1.2; // траверса канатной подвески в покое
const PZ = 0.42; // разнос шатунов по Z

interface Jack {
  x: number;
  z: number;
  ry: number;
  s: number;
  phase: number;
}

const JACKS: Jack[] = [
  { x: 0.35, z: -0.45, ry: 0.22, s: 0.95, phase: 0 },
  { x: -2.15, z: 1.25, ry: Math.PI + 0.38, s: 0.8, phase: 2.1 },
  { x: -1.0, z: 2.75, ry: 0.3, s: 0.7, phase: 4.0 },
];

const FRAME = mix('steel', 'kamazWhite', 0.45);
const DARK = mix('oilBlack', 'steel', 0.3);
const HEAD = mix('accent', 'brickRed', 0.25);
const BOX = mix('roofGreen', 'forest', 0.2);
const WEIGHT = mix('oilBlack', 'steel', 0.45);

/** Брус между двумя точками (локально): коробка t×t, ось по отрезку. */
function strut(b: Builder, p0: P3, p1: P3, t: number, color: Col): void {
  const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const len = Math.hypot(d[0], d[1], d[2]);
  const h = Math.hypot(d[0], d[2]);
  b.box(t, len, t, color, { at: p0, ry: Math.atan2(d[2], -d[0]), rz: Math.atan2(h, d[1]) });
}

function lerp3(a: P3, c: P3, t: number): P3 {
  return [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t];
}

/** Неподвижная часть станка: рама, А-образная стойка, редуктор, двигатель, устье скважины. */
function jackFrame(b: Builder, j: Jack, G: number): void {
  b.group({ at: [j.x, G, j.z], ry: j.ry, s: j.s }, () => {
    // площадка из щебня и бетонный фундамент
    b.flat(
      [
        [-2.55, -0.75],
        [1.9, -0.75],
        [1.9, 0.75],
        [-2.55, 0.75],
      ],
      0.012,
      shade('stoneSand', 0.82),
    );
    b.box(3.3, 0.16, 0.8, DARK, { at: [-0.62, 0, 0] });
    b.box(0.6, 0.1, 0.6, shade('stoneWhite', 0.8), { at: [HEAD_R, 0, 0] });
    // А-образная стойка: четыре ноги и связи
    b.group(
      {},
      () => {
        const top = PIVOT[1] - 0.12;
        const legs: [P3, P3][] = [];
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            const p0: P3 = [sx * 0.6, 0.16, sz * 0.34];
            const p1: P3 = [sx * 0.06, top, sz * 0.12];
            legs.push([p0, p1]);
            strut(b, p0, p1, 0.09, FRAME);
          }
        }
        for (const t of [0.35, 0.68]) {
          const pts = legs.map(([a, c]) => lerp3(a, c, t));
          // порядок ног: (−,−) (−,+) (+,−) (+,+)
          strut(b, pts[0], pts[2], 0.05, FRAME);
          strut(b, pts[1], pts[3], 0.05, FRAME);
          strut(b, pts[0], pts[1], 0.05, FRAME);
          strut(b, pts[2], pts[3], 0.05, FRAME);
        }
        b.box(0.26, 0.14, 0.36, DARK, { at: [0, top - 0.04, 0] });
      },
      { shadowGroup: true },
    );
    // редуктор, вал кривошипов, двигатель с ремённым кожухом, шкаф управления
    b.box(0.6, CRANK[1] - 0.06, 0.5, BOX, { at: [CRANK[0], 0.16, 0] }, { top: shade(BOX, 1.1) });
    b.cyl(0.08, 0.08, 0.84, 6, DARK, { at: [CRANK[0], CRANK[1], -0.42], rx: Math.PI / 2 });
    b.box(0.42, 0.34, 0.36, 'roofBlue', { at: [-2.0, 0.16, 0.05] });
    b.box(0.75, 0.42, 0.06, shade(BOX, 0.9), { at: [-1.68, 0.3, -0.26], rz: 0.25 });
    b.box(0.2, 0.42, 0.3, shade('stoneWhite', 0.9), { at: [-2.35, 0.16, -0.5] });
    // устье скважины: обсадная колонна, крестовина с задвижками, сальник
    b.group({ at: [HEAD_R, 0.1, 0] }, () => {
      b.cyl(0.13, 0.13, 0.32, 6, FRAME);
      b.box(0.14, 0.14, 0.5, 'accent', { at: [0, 0.18, 0] });
      for (const s of [-1, 1]) b.disc(0.08, 6, 'accent', { at: [0, 0.25, s * 0.26], ry: s > 0 ? 0 : Math.PI });
      b.cyl(0.08, 0.06, 0.32, 6, FRAME, { at: [0, 0.32, 0] });
      b.box(0.5, 0.07, 0.07, FRAME, { at: [0.26, 0.2, 0] });
    });
  });
}

/** Подвижные части одного станка: каждая — отдельный диапазон вершин со своей матрицей. */
type Part = 'beam' | 'crank' | 'pitmanA' | 'pitmanB' | 'cable' | 'rod';

function jackParts(b: Builder, j: Jack, G: number, mark: (p: Part, fn: () => void) => void): void {
  b.group({ at: [j.x, G, j.z], ry: j.ry, s: j.s, ao: G }, () => {
    // балансир с головкой, траверсой и опорой — в покое, ось в начале группы
    mark('beam', () => {
      b.group({ at: [PIVOT[0], PIVOT[1], 0] }, () => {
        b.box(2.5, 0.22, 0.2, FRAME, { at: [-0.14, -0.11, 0] });
        b.box(0.34, 0.08, 0.26, FRAME, { at: [0.98, 0.08, 0] });
        const head: P2[] = [];
        for (let i = 0; i <= 7; i++) {
          const a = -0.52 + (i / 7) * 0.94;
          head.push([Math.cos(a) * HEAD_R, Math.sin(a) * HEAD_R]);
        }
        head.push([1.0, 0.3], [0.98, -0.22]);
        b.profile(head, 0.32, HEAD, undefined, { caps: HEAD });
        // окно в головке
        for (const s of [-1, 1]) {
          b.rect(0.16, 0.5, shade(HEAD, 0.65), { at: [1.17, -0.3, s * 0.162], ry: s > 0 ? 0 : Math.PI });
        }
        b.box(0.18, 0.14, 1.0, DARK, { at: [EQ[0], EQ[1] - 0.07, 0] });
        b.box(0.3, 0.16, 0.38, DARK, { at: [0, -0.26, 0] });
      });
    });
    // кривошипы с противовесами (в покое палец смотрит в +X)
    mark('crank', () => {
      for (const s of [-1, 1]) {
        b.group({ at: [CRANK[0], CRANK[1], s * 0.36] }, () => {
          b.box(0.62, 0.12, 0.06, DARK, { at: [0.2, -0.06, 0] });
          const w: P2[] = [];
          for (let i = 0; i <= 5; i++) {
            const a = -0.55 + (i / 5) * 1.1;
            w.push([Math.cos(a) * 0.66, Math.sin(a) * 0.66]);
          }
          for (let i = 5; i >= 0; i--) {
            const a = -0.45 + (i / 5) * 0.9;
            w.push([Math.cos(a) * 0.24, Math.sin(a) * 0.24]);
          }
          b.profile(w, 0.1, WEIGHT, { at: [0, 0, s * 0.02] }, { caps: shade(WEIGHT, 1.1) });
        });
      }
    });
    // шатуны: единичные брусья вдоль +Y, растягиваются в update
    mark('pitmanA', () => b.box(0.07, 1, 0.07, FRAME, { at: [0, 0, 0] }));
    mark('pitmanB', () => b.box(0.07, 1, 0.07, FRAME, { at: [0, 0, 0] }));
    // канатная подвеска: два каната единичной длины
    mark('cable', () => {
      for (const z of [-0.07, 0.07]) b.box(0.025, 1, 0.025, shade('oilBlack', 1.2), { at: [0, 0, z], shadow: false });
    });
    // полированный шток и траверса подвески
    mark('rod', () => {
      b.box(0.04, CARRIER_Y - 0.1, 0.04, mix('steel', 'kamazWhite', 0.6), { at: [HEAD_R, 0.1, 0], shadow: false });
      b.box(0.08, 0.05, 0.3, DARK, { at: [HEAD_R, CARRIER_Y, 0] });
    });
  });
}

/** Профиль «стрельчатого» лепестка памятника: ширина w, высота h. */
function ogive(w: number, h: number): P2[] {
  const pts: P2[] = [];
  const n = 5;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([(w / 2) * Math.cos((t * Math.PI) / 2) ** 0.7, h * Math.sin((t * Math.PI) / 2)]);
  }
  for (let i = n - 1; i >= 0; i--) {
    const [x, y] = pts[i];
    pts.push([-x, y]);
  }
  return pts;
}

/** Памятник «Скважина № 3»: ступенчатый постамент с лестницами, стела с двумя «фонтанами». */
function monument(b: Builder, at: P3, ry: number): void {
  const granite = mix('oilBlack', 'steel', 0.3);
  const stone = shade('stoneWhite', 0.78);
  b.group({ at, ry }, () => {
    b.flat(
      [
        [-1.05, -0.75],
        [1.05, -0.75],
        [1.05, 0.95],
        [-1.05, 0.95],
      ],
      0.012,
      mix('brickRed', 'stoneSand', 0.55),
    );
    b.box(1.6, 0.22, 1.1, granite, undefined, { top: shade('forest', 1.2) });
    b.box(1.0, 0.18, 0.8, granite, { at: [0, 0.22, -0.05] }, { top: shade('forest', 1.25) });
    b.box(0.5, 0.06, 0.04, shade('oilBlack', 0.8), { at: [0, 0.07, 0.56] });
    // две лестницы спереди
    for (const sx of [-0.55, 0.55]) {
      for (let i = 0; i < 4; i++) b.box(0.32, 0.1 * (i + 1), 0.11, shade(granite, 1.15), { at: [sx, 0, 0.82 - i * 0.11] });
    }
    // ограда наверху
    b.box(0.9, 0.08, 0.02, shade('steel', 1.1), { at: [0, 0.48, -0.42], shadow: false });
    // стела: два столба, сверху стрельчатые «фонтаны» из вложенных лепестков
    b.group(
      { at: [0, 0.4, -0.1] },
      () => {
        b.box(0.12, 2.0, 0.1, stone, { at: [-0.1, 0, 0] });
        b.box(0.12, 1.75, 0.1, stone, { at: [0.12, 0, 0] });
        b.box(0.3, 0.12, 0.13, shade('oilBlack', 1.2), { at: [0, 0.75, 0] });
        const plume = (x: number, y: number, k: number) => {
          for (let i = 0; i < 3; i++) {
            const w = (0.5 - i * 0.13) * k;
            const h = (1.1 - i * 0.25) * k;
            b.profile(ogive(w, h), 0.08 + i * 0.03, shade(stone, 1 - i * 0.06), { at: [x, y - i * 0.16 * k, 0] });
          }
        };
        plume(-0.13, 1.82, 1);
        plume(0.17, 1.55, 0.82);
      },
      { shadowGroup: true },
    );
  });
}

/** Волнистая стеклянная башня «Татнефти». */
function wavyTower(b: Builder, at: P3, r: number, h: number): void {
  const glass = mix('roofBlue', 'oilBlack', 0.35);
  const pts: P2[] = [];
  const n = 28;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 + 0.1 * Math.cos(a * 7));
    pts.push([Math.cos(a) * rr * 1.08, -Math.sin(a) * rr * 0.9]);
  }
  b.group({ at, ry: 0.3 }, () => {
    b.extrude(pts, h, glass, undefined, { top: mix(glass, 'roofDark', 0.4) });
    b.extrude(
      pts.map(([x, z]) => [x * 0.98, z * 0.98] as P2),
      0.08,
      shade(glass, 0.75),
      { at: [0, h * 0.33, 0] },
    );
    b.box(0.5, 0.2, 0.4, shade('steel', 0.75), { at: [-0.1, h, 0.05] });
    b.cyl(0.03, 0.03, 0.6, 4, 'steel', { at: [0.2, h + 0.25, 0] });
  });
}

export function buildAlmetyevsk(): Miniature {
  const b = new Builder();
  const G = plinth(b, 'plain', { seg: 20 });

  for (const j of JACKS) jackFrame(b, j, G);

  // штаб-квартира «Татнефти»: волнистая башня и чёрный стеклянный куб с вывеской
  wavyTower(b, [-2.4, G, -2.1], 0.78, 3.4);
  {
    const glass = mix('oilBlack', 'roofBlue', 0.28);
    b.group({ at: [-0.15, G, -3.15], ry: -0.12 }, () => {
      b.box(2.1, 1.75, 1.2, glass, undefined, { top: shade('steel', 0.7) });
      b.box(0.45, 1.75, 0.04, shade('oilBlack', 0.9), { at: [-0.8, 0, 0.61] });
      for (let i = 0; i < 7; i++) b.rect(0.09, 0.13, 'kamazWhite', { at: [-0.2 + i * 0.14, 1.42, 0.612] });
      b.rect(0.08, 0.16, 'accent', { at: [-0.36, 1.4, 0.612] });
      for (let i = 0; i < 3; i++) b.box(0.18, 0.14, 0.18, shade('steel', 0.85), { at: [0.3 + i * 0.3, 1.75, -0.3] });
      for (let i = 1; i < 6; i++) b.rect(1.55, 0.015, shade(glass, 1.35), { at: [0.27, i * 0.29, 0.611] });
    });
    // площадь перед штабом: полосы мощения, скульптура
    for (let i = 0; i < 5; i++) {
      const x = -1.25 + i * 0.32;
      b.flat(
        [
          [x, -2.45],
          [x + 0.16, -2.45],
          [x + 0.16, -1.75],
          [x, -1.75],
        ],
        G + 0.013,
        i % 2 ? shade('stoneWhite', 0.85) : shade('steel', 0.85),
      );
    }
    b.box(0.3, 0.16, 0.3, shade('oilBlack', 1.3), { at: [0.55, G, -2.1] });
    b.cone(0.16, 0.38, 5, shade('oilBlack', 1.1), { at: [0.55, G + 0.16, -2.1] });
  }

  // резервуарный парк в обваловании
  b.flat(
    [
      [1.6, -3.6],
      [3.7, -2.3],
      [4.05, -0.3],
      [2.6, -1.0],
      [1.55, -1.85],
    ],
    G + 0.011,
    shade('stoneSand', 0.9),
  );
  const tank = (x: number, z: number, r: number, h: number) => {
    b.group(
      { at: [x, G, z] },
      () => {
        b.cyl(r, r, h, 14, 'kamazWhite', undefined, { top: false });
        b.cyl(r * 1.005, r * 1.005, 0.14, 14, 'accent', { at: [0, h * 0.72, 0] }, { top: false });
        b.cone(r * 1.02, r * 0.22, 14, mix('steel', 'kamazWhite', 0.4), { at: [0, h, 0] });
        // лестница по стенке и перила по кромке
        for (let i = 0; i < 6; i++) {
          const a = 2.2 + i * 0.16;
          b.box(0.12, 0.05, 0.14, DARK, { at: [Math.sin(a) * (r + 0.06), (h * (i + 0.5)) / 6, Math.cos(a) * (r + 0.06)], ry: a });
        }
      },
      { shadowGroup: true },
    );
  };
  tank(2.55, -2.45, 0.8, 1.35);
  tank(3.45, -1.05, 0.58, 1.05);
  // трубопроводы на опорах от скважин к парку
  const pipe = (pts: P2[], y = 0.18) => {
    for (let i = 0; i < pts.length - 1; i++) {
      b.wall(pts[i], pts[i + 1], 0.07, 0.07, 'steel', { at: [0, G + y, 0], shadow: false });
      const [x, z] = pts[i + 1];
      b.box(0.05, y, 0.05, DARK, { at: [x, G, z], shadow: false });
    }
  };
  {
    const wh = (j: Jack): P2 => {
      const d = HEAD_R * j.s + 0.25 * j.s;
      return [j.x + Math.cos(j.ry) * d, j.z - Math.sin(j.ry) * d];
    };
    // от каждой скважины — выкидная линия к блоку замера (АГЗУ), от него — к парку
    const shed = (x: number, z: number, ry: number) => {
      b.box(0.55, 0.34, 0.36, 'kamazWhite', { at: [x, G, z], ry });
      b.gable(0.6, 0.42, 0.14, mix('steel', 'kamazWhite', 0.3), { at: [x, G + 0.34, z], ry }, { ends: 'kamazWhite' });
      b.rect(0.14, 0.24, 'roofBlue', { at: [x + Math.sin(ry) * 0.185, G, z + Math.cos(ry) * 0.185], ry });
    };
    shed(2.45, -0.35, -0.2);
    pipe([wh(JACKS[0]), [2.45, -0.75], [2.45, -1.35], [2.95, -1.75]]);
    shed(-3.15, 2.5, 0.4);
    pipe([wh(JACKS[1]), [-3.25, 2.25]]);
    shed(0.85, 3.3, 0.2);
    pipe([wh(JACKS[2]), [0.6, 2.4], [0.8, 3.05]]);
  }

  // памятник «Скважина № 3»
  monument(b, [2.0, G, 2.35], 0.35);

  // ели у штаба, берёзы и лиственные по краю полей
  for (const [x, z, s] of [
    [-0.95, -1.75, 0.5],
    [-3.55, -0.75, 0.55],
    [-3.25, -2.85, 0.5],
    [-1.4, -3.6, 0.45],
    [1.15, -3.5, 0.42],
  ] as P3[]) tree(b, x, z, G, s);
  for (const [x, z, s] of [
    [-3.95, 0.45, 0.55],
    [3.9, 1.0, 0.5],
    [3.35, 0.15, 0.42],
    [0.95, 1.25, 0.45],
    [-0.15, 4.05, 0.42],
  ] as P3[]) roundTree(b, x, z, G, s, mix('forest', 'lowland', 0.3));

  // подвижные части станков — отдельный меш, каждая часть со своей матрицей (CPU)
  const moving = new Builder(G);
  const ranges: Record<Part, [number, number]>[] = [];
  for (const j of JACKS) {
    const r = {} as Record<Part, [number, number]>;
    jackParts(moving, j, G, (p, fn) => {
      const s0 = moving.triangles * 3;
      fn();
      r[p] = [s0, moving.triangles * 3];
    });
    ranges.push(r);
  }
  // сигнальный огонь на башне
  const beaconStart = moving.triangles * 3;
  moving.box(0.1, 0.1, 0.1, 'accent', { at: [-2.4 + Math.cos(0.3) * 0.2, G + 3.4 + 0.85, -2.1 - Math.sin(0.3) * 0.2], shadow: false, ao: false });
  const beaconEnd = moving.triangles * 3;

  const mini = assemble('almetyevsk', [b, moving]);
  const mesh = mini.group.children[1] as THREE.Mesh;
  const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  const colA = mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
  const rest = Float32Array.from(pos.array as Float32Array);
  const beaconCol = Float32Array.from((colA.array as Float32Array).slice(beaconStart * 3, beaconEnd * 3));
  mesh.geometry.boundingSphere!.radius += 1; // запас на качание
  const out = pos.array as Float32Array;

  const J = JACKS.map((j) => new THREE.Matrix4().compose(new THREE.Vector3(j.x, G, j.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), j.ry), new THREE.Vector3(j.s, j.s, j.s)));
  const Jinv = J.map((m) => m.clone().invert());
  const L = new THREE.Matrix4();
  const M = new THREE.Matrix4();
  const T = new THREE.Matrix4();
  const tmp = new THREE.Vector3();
  const apply = (k: number, [s, e]: [number, number]) => {
    M.multiplyMatrices(J[k], L).multiply(Jinv[k]);
    for (let i = s; i < e; i++) {
      tmp.fromArray(rest, i * 3).applyMatrix4(M);
      out[i * 3] = tmp.x;
      out[i * 3 + 1] = tmp.y;
      out[i * 3 + 2] = tmp.z;
    }
  };
  const rotAbout = (p: P2, ang: number) =>
    L.makeTranslation(p[0], p[1], 0).multiply(T.makeRotationZ(ang)).multiply(new THREE.Matrix4().makeTranslation(-p[0], -p[1], 0));

  mini.update = (t: number) => {
    JACKS.forEach((j, k) => {
      const r = ranges[k];
      const phi = t * 1.6 + j.phase;
      const a = -Math.asin((RC * Math.sin(phi)) / LR);
      rotAbout(PIVOT, a);
      apply(k, r.beam);
      rotAbout(CRANK, phi);
      apply(k, r.crank);
      // шатуны: от пальца кривошипа к траверсе
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const ex = PIVOT[0] + EQ[0] * ca - EQ[1] * sa;
      const ey = PIVOT[1] + EQ[0] * sa + EQ[1] * ca;
      const px = CRANK[0] + RC * Math.cos(phi);
      const py = CRANK[1] + RC * Math.sin(phi);
      const len = Math.hypot(ex - px, ey - py);
      const ang = Math.atan2(-(ex - px), ey - py);
      for (const [part, z] of [
        ['pitmanA', PZ],
        ['pitmanB', -PZ],
      ] as const) {
        L.makeTranslation(px, py, z).multiply(T.makeRotationZ(ang)).multiply(new THREE.Matrix4().makeScale(1, len, 1));
        apply(k, r[part]);
      }
      // подвеска: траверса поднимается на длину намотанной на дугу дуги
      const lift = HEAD_R * a;
      const cy = CARRIER_Y + lift;
      L.makeTranslation(HEAD_R + 0.02, cy, 0).multiply(new THREE.Matrix4().makeScale(1, PIVOT[1] - cy, 1));
      apply(k, r.cable);
      L.makeTranslation(0, lift, 0);
      apply(k, r.rod);
    });
    pos.needsUpdate = true;
    // мигающий огонь
    const on = Math.sin(t * 3) > 0 ? 1.25 : 0.45;
    const c = colA.array as Float32Array;
    for (let i = 0; i < beaconCol.length; i++) c[beaconStart * 3 + i] = Math.min(1, beaconCol[i] * on);
    colA.needsUpdate = true;
  };
  mini.update(0);
  return mini;
}
