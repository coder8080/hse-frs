// Нижнекамск: нефтехимический комбинат — ректификационные колонны с площадками,
// открытая этажерка установки, полосатая и бетонная трубы (дым), градирни ТЭЦ (пар),
// шаровые и вертикальные резервуары в обваловании, эстакады труб, факел с пламенем,
// цистерны на подъездном пути и зелёная санитарная полоса.
import * as THREE from 'three';
import { Builder, assemble, mix, plinth, ringXZ, shade, type Col, type Miniature, type P2, type P3 } from './kit';
import { roundTree, tree } from './archi';

// ---------- локальные помощники ----------

type Motion = (t: number, m: THREE.Matrix4) => void;

/** Меш из частей, каждая двигается своей матрицей (вершины пересчитываются от покоя). */
class Animated {
  readonly b: Builder;
  private parts: { s: number; e: number; motion: Motion }[] = [];
  constructor(groundY: number) {
    this.b = new Builder(groundY);
  }
  part(motion: Motion, build: () => void): void {
    const s = this.b.triangles * 3;
    build();
    this.parts.push({ s, e: this.b.triangles * 3, motion });
  }
  bind(mesh: THREE.Mesh, pad: number): (t: number) => void {
    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const rest = Float32Array.from(pos.array as Float32Array);
    const out = pos.array as Float32Array;
    mesh.geometry.boundingSphere!.radius += pad;
    const m = new THREE.Matrix4();
    return (t: number) => {
      for (const p of this.parts) {
        m.identity();
        p.motion(t, m);
        const e = m.elements;
        for (let i = p.s * 3; i < p.e * 3; i += 3) {
          const x = rest[i];
          const y = rest[i + 1];
          const z = rest[i + 2];
          out[i] = e[0] * x + e[4] * y + e[8] * z + e[12];
          out[i + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
          out[i + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
        }
      }
      pos.needsUpdate = true;
    };
  }
}

/** Профиль шара радиуса r (низ в y = 0). */
function sphereProfile(r: number, n: number): P2[] {
  const p: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI;
    p.push([Math.cos(a) * r, r + Math.sin(a) * r]);
  }
  return p;
}

/** Ректификационная колонна: корпус, кольцевые площадки, лестница, обвязка, купол. */
function column(b: Builder, x: number, z: number, y: number, h: number, r: number, o: { rings?: number; color?: Col } = {}): void {
  const c = o.color ?? shade('steel', 1.12);
  const deck = mix('steel', 'roofDark', 0.35);
  const rail = 'gold';
  b.group(
    { at: [x, y, z] },
    () => {
      b.cyl(r * 1.25, r * 1.1, 0.35, 10, shade('steel', 0.8)); // юбка-опора
      b.lathe(
        [
          [r, 0.3],
          [r, h],
          [r * 0.75, h + r * 0.45],
          [0, h + r * 0.62],
        ],
        10,
        c,
        undefined,
        { bands: [c, shade(c, 0.97), shade(c, 0.97)] },
      );
      const n = o.rings ?? Math.max(2, Math.floor(h / 1.6));
      for (let i = 1; i <= n; i++) {
        const yy = 0.3 + (i / (n + 0.4)) * (h - 0.3);
        // площадка: тёмный настил, жёлтое ограждение по кромке
        b.cyl(r + 0.16, r + 0.16, 0.13, 8, rail, { at: [0, yy, 0] }, { top: deck });
      }
      // лестница и вертикальный трубопровод
      b.box(0.07, h - 0.1, 0.05, shade('roofDark', 1.1), { at: [0, 0.1, r + 0.04], shadow: false });
      b.cyl(0.05, 0.05, h * 0.92, 5, shade('steel', 0.9), { at: [r + 0.07, 0, 0], shadow: false });
    },
    { shadowGroup: true },
  );
}

/** Дымовая труба с поясами, площадками обслуживания и тёмным жерлом. */
function stack(b: Builder, x: number, z: number, y: number, h: number, r0: number, r1: number, bands: Col[], seg = 12): void {
  const prof: P2[] = [];
  const n = bands.length;
  for (let i = 0; i <= n; i++) prof.push([r0 + ((r1 - r0) * i) / n, (h * i) / n]);
  // жерло: край и стенка внутрь
  prof.push([r1 * 0.82, h], [r1 * 0.8, h - 0.4]);
  b.group(
    { at: [x, y, z] },
    () => {
      b.lathe(prof, seg, bands[0], undefined, { bands: [...bands, shade('roofDark', 0.9), 'oilBlack'], capTop: 'oilBlack' });
      for (const k of [0.55, 0.85]) {
        const r = r0 + (r1 - r0) * k + 0.12;
        b.cyl(r, r, 0.05, seg, mix('steel', 'roofDark', 0.4), { at: [0, h * k, 0] });
      }
      b.box(0.06, h * 0.95, 0.05, shade('roofDark', 1.1), { at: [0, 0, r0 + 0.02], shadow: false });
    },
    { shadowGroup: true },
  );
}

/** Градирня-гиперболоид с тёмным нутром. */
function coolingTower(b: Builder, x: number, z: number, y: number, r: number, h: number): void {
  const c = mix('stoneWhite', 'steel', 0.35);
  b.group(
    { at: [x, y, z] },
    () => {
      // ножки-колоннада у основания
      b.cyl(r * 1.02, r * 1.02, 0.12, 14, shade('roofDark', 1.05), undefined, { top: false });
      b.lathe(
        [
          [r, 0.12],
          [r * 0.88, h * 0.24],
          [r * 0.74, h * 0.52],
          [r * 0.64, h * 0.78],
          [r * 0.63, h * 0.9],
          [r * 0.67, h],
          [r * 0.6, h],
          [r * 0.58, h - 0.5],
        ],
        14,
        c,
        undefined,
        {
          bands: [shade(c, 0.97), c, shade(c, 1.02), mix('accent', 'stoneWhite', 0.2), shade(c, 1.02), shade(c, 1.05), shade('roofDark', 0.8)],
          capTop: shade('roofDark', 0.7),
        },
      );
    },
    { shadowGroup: true },
  );
}

/** Шаровой резервуар на опорах с экваториальным поясом и лесенкой. */
function sphereTank(b: Builder, x: number, z: number, y: number, r: number): void {
  const white = shade('kamazWhite', 0.98);
  b.group(
    { at: [x, y, z] },
    () => {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        b.box(0.08, r + 0.35, 0.08, shade('steel', 0.8), { at: [Math.sin(a) * r * 0.9, 0, Math.cos(a) * r * 0.9] });
      }
      b.lathe(sphereProfile(r, 6), 10, white, { at: [0, 0.35, 0] });
      b.cyl(r * 1.02, r * 1.02, 0.07, 10, mix('steel', 'roofDark', 0.3), { at: [0, 0.35 + r - 0.035, 0] });
      b.cyl(0.14, 0.14, 0.12, 6, shade('steel', 0.9), { at: [0, 0.35 + r * 2 - 0.02, 0] });
      // наклонная лестница к макушке
      b.box(0.1, r * 2.0, 0.04, shade('roofDark', 1.1), { at: [r * 0.55, 0.35, r * 0.75], rx: -0.45, ry: 0.6, shadow: false });
    },
    { shadowGroup: true },
  );
}

/** Вертикальный резервуар с плавающей крышей, поясом жёсткости и лестницей по стенке. */
function tank(b: Builder, x: number, z: number, y: number, r: number, h: number, c: Col): void {
  b.group(
    { at: [x, y, z] },
    () => {
      b.lathe(
        [
          [r, 0],
          [r, h],
          [r * 0.95, h],
          [r * 0.95, h - 0.12],
        ],
        14,
        c,
        undefined,
        { bands: [c, shade(c, 0.9), shade('steel', 0.85)], capTop: shade('steel', 0.95) },
      );
      b.cyl(r + 0.05, r + 0.05, 0.05, 14, shade('steel', 0.85), { at: [0, h * 0.82, 0] });
      b.cyl(r + 0.01, r + 0.01, 0.12, 14, mix('accent', 'gold', 0.3), { at: [0, h * 0.3, 0] });
      // лестница — наклонная полоса по касательной
      b.box(0.08, h * 1.25, 0.05, shade('roofDark', 1.1), { at: [0, 0, r + 0.03], rz: -0.75, shadow: false });
    },
    { shadowGroup: true },
  );
}

/** Ж/д цистерна: котёл со скруглёнными днищами на раме с тележками. */
function tankCar(b: Builder, x: number, z: number, y: number, c: Col): void {
  const L = 1.0;
  const r = 0.17;
  b.group(
    { at: [x, y, z] },
    () => {
      for (const s of [-1, 1]) b.box(0.22, 0.1, 0.26, 'oilBlack', { at: [s * 0.33, 0.02, 0] });
      b.box(L, 0.05, 0.28, shade('oilBlack', 1.2), { at: [0, 0.12, 0] });
      b.lathe(
        [
          [0, -L / 2 - 0.06],
          [r * 0.7, -L / 2 - 0.02],
          [r, -L / 2 + 0.06],
          [r, L / 2 - 0.06],
          [r * 0.7, L / 2 + 0.02],
          [0, L / 2 + 0.06],
        ],
        8,
        c,
        { at: [0, 0.17 + r, 0], rz: -Math.PI / 2 },
      );
      b.cyl(0.07, 0.07, 0.07, 6, c, { at: [0, 0.17 + r * 2 - 0.02, 0] });
    },
    { shadowGroup: true },
  );
}

/** Эстакада: стойки-рамы и пучок цветных труб между двумя точками (x, z). */
function rack(b: Builder, from: P2, to: P2, y: number, h: number, pipes: Col[]): void {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const ry = Math.atan2(-dz, dx);
  const frame = mix('steel', 'roofDark', 0.45);
  const w = 0.12 * pipes.length + 0.1;
  b.group({ at: [(from[0] + to[0]) / 2, y, (from[1] + to[1]) / 2], ry }, () => {
    const n = Math.max(1, Math.round(len / 1.1));
    for (let i = 0; i <= n; i++) {
      const x = -len / 2 + (i / n) * len;
      for (const s of [-1, 1]) b.box(0.06, h, 0.06, frame, { at: [x, 0, (s * w) / 2], shadow: false });
      b.box(0.06, 0.06, w + 0.06, frame, { at: [x, h - 0.06, 0], shadow: false });
    }
    pipes.forEach((c, i) => {
      const z = -w / 2 + 0.11 + i * 0.12;
      b.cyl(0.045, 0.045, len, 6, c, { at: [-len / 2, h + 0.04, z], rz: -Math.PI / 2, shadow: false });
    });
  });
  // одна общая тень-полоса эстакады
  b.castShadow(
    [
      [from[0], y + h, from[1]],
      [to[0], y + h, to[1]],
      [from[0], y + h + 0.08, from[1] + 0.02],
      [to[0], y + h + 0.08, to[1] + 0.02],
      [from[0], y, from[1]],
      [to[0], y, to[1]],
    ],
  );
}

// ---------- модель ----------

export function buildNizhnekamsk(): Miniature {
  const b = new Builder();
  const G = plinth(b, mix('plain', 'lowland', 0.3), { side: shade('steel', 0.9) });
  const steel = 'steel';
  const steelD = shade('steel', 0.8);
  const white = 'kamazWhite';
  const red = 'accent';
  const concrete = mix('stoneSand', 'steel', 0.45);
  const asphalt = mix('roofDark', 'steel', 0.35);

  // ---- площадка, дороги, подъездной путь ----
  b.flat(ringXZ(4.05, 14, 0.1), G + 0.012, concrete);
  b.flat(
    [
      [-4.0, 0.62],
      [4.0, 0.62],
      [4.0, 0.95],
      [-4.0, 0.95],
    ],
    G + 0.018,
    asphalt,
  );
  b.flat(
    [
      [0.35, 0.95],
      [0.68, 0.95],
      [0.68, 4.0],
      [0.35, 4.0],
    ],
    G + 0.018,
    asphalt,
  );
  for (const z of [3.12, 3.32]) b.box(3.7, 0.03, 0.04, shade('steel', 0.7), { at: [-1.25, G + 0.012, z], shadow: false });
  for (let i = 0; i < 16; i++) {
    const x = -3.0 + i * 0.235;
    b.flat([[x - 0.03, 3.04], [x + 0.03, 3.04], [x + 0.03, 3.4], [x - 0.03, 3.4]], G + 0.022, shade('wood', 0.7));
  }

  // ---- трубы: высокая красно-белая и бетонная ----
  stack(b, -2.4, -2.85, G, 7.9, 0.42, 0.24, [white, red, white, red, white, red, white, red]);
  stack(b, -1.05, -3.65, G, 6.2, 0.34, 0.22, [concrete, shade(concrete, 1.05), concrete, shade(concrete, 1.05), red]);

  // ---- градирни ТЭЦ ----
  coolingTower(b, -3.0, -0.55, G, 1.05, 2.7);
  coolingTower(b, -3.15, 1.45, G, 0.82, 2.15);

  // ---- ректификационные колонны и этажерка установки ----
  column(b, 0.05, -2.65, G, 6.6, 0.36);
  column(b, 0.9, -3.15, G, 5.3, 0.3, { color: white });
  column(b, 0.75, -1.95, G, 4.3, 0.26);
  column(b, 1.55, -2.45, G, 5.9, 0.22, { color: white, rings: 3 });
  // перемычки-трубы с верхушек колонн
  b.cyl(0.05, 0.05, 0.9, 5, steelD, { at: [0.05, G + 4.9, -2.65], rz: -1.2, ry: 0.55, shadow: false });
  b.cyl(0.05, 0.05, 0.85, 5, steelD, { at: [0.9, G + 4.1, -3.15], rz: -1.0, ry: -1.0, shadow: false });

  // открытая стальная этажерка с аппаратами на ярусах
  b.group(
    { at: [-0.95, G, -1.55], ry: 0.05 },
    () => {
      const w = 1.4;
      const d = 1.0;
      const frame = mix('steel', 'roofDark', 0.4);
      for (const x of [-w / 2, 0, w / 2]) for (const z of [-d / 2, d / 2]) b.box(0.08, 2.75, 0.08, frame, { at: [x, 0, z] });
      for (const [y, c] of [
        [0.9, frame],
        [1.8, frame],
        [2.7, frame],
      ] as [number, Col][]) {
        b.box(w + 0.12, 0.06, d + 0.12, c, { at: [0, y, 0] });
        b.box(w + 0.12, 0.08, 0.02, 'gold', { at: [0, y + 0.06, d / 2 + 0.06], shadow: false });
      }
      // горизонтальные ёмкости и теплообменники
      b.lathe(sphereProfile(0.22, 4).map(([r, y]) => [r, y * 2.4] as P2), 8, white, { at: [0.3, 0.97 + 0.22, -0.55], rx: Math.PI / 2 });
      b.cyl(0.18, 0.18, 0.95, 8, shade('steel', 1.1), { at: [-0.45, 1.1, 0.4], rx: -Math.PI / 2 });
      b.cyl(0.14, 0.14, 0.95, 8, shade('steel', 1.1), { at: [-0.45, 2.0, 0.4], rx: -Math.PI / 2 });
      b.cyl(0.2, 0.2, 0.5, 8, mix('roofGreen', 'steel', 0.4), { at: [0.35, 1.86, 0.05] });
      b.box(0.55, 0.3, 0.45, mix('roofBlue', 'steel', 0.4), { at: [-0.35, 0, 0.05] });
      b.cyl(0.22, 0.22, 0.75, 8, white, { at: [0.35, 2.76, -0.05] });
      b.cyl(0.1, 0.1, 0.5, 6, steelD, { at: [-0.4, 2.76, 0.1] });
    },
    { shadowGroup: true },
  );

  // ---- факельная установка: решётчатая мачта, пламя (анимировано отдельно) ----
  const F: P3 = [3.05, G, -2.75];
  const FH = 6.9;
  b.group(
    { at: F },
    () => {
      const frame = mix('steel', 'roofDark', 0.4);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const lx = Math.sin(a) * 0.45;
        const lz = Math.cos(a) * 0.45;
        const len = Math.hypot(FH * 0.75, 0.37);
        b.box(0.06, len, 0.06, frame, { at: [lx, 0, lz], rx: -Math.atan2(0.37, FH * 0.75) * Math.cos(a), rz: Math.atan2(0.37, FH * 0.75) * Math.sin(a) });
      }
      for (const k of [0.25, 0.5, 0.72]) {
        const rr = 0.45 - 0.37 * (k / 0.75);
        b.cyl(rr + 0.03, rr + 0.03, 0.04, 6, frame, { at: [0, FH * k, 0] }, { top: false });
      }
      b.cyl(0.08, 0.06, FH, 6, shade('steel', 1.05), undefined, { top: 'oilBlack' });
      b.lathe(
        [
          [0.06, FH - 0.5],
          [0.06, FH - 0.25],
          [0.13, FH],
        ],
        6,
        red,
        undefined,
        { capTop: 'oilBlack' },
      );
    },
    { shadowGroup: true },
  );

  // ---- шаровые резервуары ----
  sphereTank(b, 1.75, -0.75, G, 0.6);
  sphereTank(b, 3.05, -0.8, G, 0.6);
  sphereTank(b, 2.45, -1.85, G, 0.52);

  // ---- резервуарный парк в обваловании ----
  const dike: P2[] = [
    [0.95, 1.2],
    [3.95, 1.2],
    [3.3, 2.65],
    [0.95, 2.95],
  ];
  b.flat(dike, G + 0.016, shade(concrete, 0.92));
  for (let i = 0; i < 4; i++) b.wall(dike[i], dike[(i + 1) % 4], 0.08, 0.14, shade(concrete, 1.08), { at: [0, G, 0], shadow: false });
  tank(b, 1.75, 2.05, G, 0.72, 0.9, white);
  tank(b, 3.0, 1.75, G, 0.55, 0.75, mix('kamazWhite', 'stoneSand', 0.35));

  // ---- эстакады труб ----
  rack(b, [-2.05, 0.3], [3.85, 0.3], G, 0.9, [steel, 'roofGreen', 'gold', red, shade('steel', 1.2)]);
  rack(b, [0.05, 0.25], [0.05, -1.35], G, 0.9, [steel, 'roofGreen', 'gold']);
  rack(b, [0.95, 0.85], [0.95, 1.35], G, 0.6, [steel, 'gold']);
  // подъём труб к этажерке и шарам
  b.cyl(0.05, 0.05, 1.0, 6, 'roofGreen', { at: [-0.4, G + 0.95, -1.05], shadow: false });
  b.cyl(0.045, 0.045, 1.2, 6, steel, { at: [2.4, G + 0.95, 0.3], rx: Math.PI / 2, shadow: false });

  // ---- заводоуправление и насосная ----
  b.group(
    { at: [-0.85, G, 1.95] },
    () => {
      b.box(1.9, 1.05, 0.8, white, undefined, { top: shade('steel', 0.95) });
      b.box(1.96, 0.08, 0.86, shade('roofBlue', 1.0), { at: [0, 1.0, 0] });
      for (const y of [0.15, 0.5]) b.rect(1.7, 0.22, mix('glass', 'roofBlue', 0.25), { at: [0, y, 0.405] });
      for (let i = 0; i <= 6; i++) b.rect(0.05, 0.62, white, { at: [-0.84 + i * 0.28, 0.12, 0.41] });
      b.box(0.5, 0.35, 0.3, shade('roofBlue', 1.0), { at: [0.3, 0, 0.55] });
      b.box(0.04, 0.6, 0.04, steelD, { at: [-0.75, 1.08, 0] });
      b.rect(0.4, 0.18, red, { at: [-0.75, 1.4, 0.03] });
    },
    { shadowGroup: true },
  );
  b.group(
    { at: [2.25, G, -0.1 + 0.55], ry: 0 },
    () => {
      b.box(0.7, 0.4, 0.38, mix('roofBlue', 'steel', 0.45), undefined, { top: shade('steel', 0.9) });
    },
    { shadowGroup: true },
  );

  // ---- цистерны на подъездном пути ----
  tankCar(b, -2.45, 3.22, G, 'oilBlack');
  tankCar(b, -1.35, 3.22, G, shade('oilBlack', 1.15));
  tankCar(b, -0.25, 3.22, G, mix('kamazWhite', 'steel', 0.3));

  // ---- санитарная зелёная полоса ----
  for (const [x, z, s] of [
    [-3.75, 2.75, 0.7],
    [-1.55, 4.1, 0.6],
    [1.35, 3.85, 0.65],
    [2.55, 3.4, 0.6],
    [3.85, 2.45, 0.6],
    [4.2, -1.3, 0.55],
    [-4.2, -2.0, 0.55],
    [-0.35, 4.2, 0.5],
  ] as [number, number, number][]) {
    roundTree(b, x, z, G, s);
  }
  tree(b, -2.75, 4.0, G, 0.55);
  tree(b, 0.05, 4.35, G, 0.45);
  tree(b, 3.55, -2.65, G, 0.5);

  // ---- анимация: пламя факела, дым из труб, пар над градирнями ----
  const anim = new Animated(G);
  const a = anim.b;
  const tmp = new THREE.Matrix4();
  const tmpS = new THREE.Matrix4();
  const tmpT = new THREE.Matrix4();
  const flameBase = new THREE.Vector3(F[0], F[1] + FH, F[2]);
  anim.part(
    (t, m) => {
      const sy = 1 + 0.28 * Math.sin(t * 13.0) + 0.12 * Math.sin(t * 29.0 + 1.3);
      const sx = 1 + 0.12 * Math.sin(t * 17.0 + 0.4);
      m.makeTranslation(flameBase.x, flameBase.y, flameBase.z)
        .multiply(tmp.makeRotationZ(-0.12 + 0.08 * Math.sin(t * 5.0)))
        .multiply(tmpS.makeScale(sx, sy, sx))
        .multiply(tmpT.makeTranslation(-flameBase.x, -flameBase.y, -flameBase.z));
    },
    () =>
      a.group({ at: [flameBase.x, flameBase.y, flameBase.z], shadow: false, ao: false }, () => {
        a.lathe(
          [
            [0.14, 0],
            [0.22, 0.18],
            [0.15, 0.5],
            [0, 0.85],
          ],
          6,
          shade(mix('accent', 'gold', 0.45), 1.45),
        );
        a.lathe(
          [
            [0.1, 0.02],
            [0.15, 0.16],
            [0.09, 0.4],
            [0, 0.58],
          ],
          6,
          shade(mix('gold', 'kamazWhite', 0.5), 1.5),
          { at: [0.03, 0, 0.12] },
        );
      }),
  );

  /** Клубы: растут, всплывают со сносом ветром и тают к концу цикла. */
  const puffs = (src: P3, n: number, rise: number, drift: P3, rMax: number, period: number, color: Col, seed: number) => {
    for (let i = 0; i < n; i++) {
      const center = new THREE.Vector3(...src);
      anim.part(
        (t, m) => {
          const ph = (((t / period + i / n + seed) % 1) + 1) % 1;
          const s = Math.max(0.001, Math.sin(Math.PI * ph) ** 0.8 * (0.45 + 0.55 * ph));
          m.makeTranslation(center.x + drift[0] * ph, center.y + rise * ph, center.z + drift[2] * ph)
            .multiply(tmp.makeRotationY(ph * 2 + i))
            .multiply(tmpS.makeScale(s, s * 0.85, s))
            .multiply(tmpT.makeTranslation(-center.x, -center.y, -center.z));
        },
        () => a.lathe(sphereProfile(rMax, 3), 7, color, { at: [src[0], src[1] - rMax, src[2]], shadow: false, ao: false, ry: i }),
      );
    }
  };
  const smoke = shade(mix('stoneWhite', 'steel', 0.3), 1.12);
  const steam = shade('kamazWhite', 1.2);
  puffs([-2.4, G + 7.95, -2.85], 5, 1.25, [1.0, 0, 0.15], 0.42, 6.0, smoke, 0);
  puffs([-1.05, G + 6.25, -3.65], 3, 1.1, [0.9, 0, 0.1], 0.32, 5.0, smoke, 0.37);
  puffs([-3.0, G + 2.75, -0.55], 5, 1.7, [0.7, 0, 0.1], 0.62, 7.0, steam, 0.15);
  puffs([-3.15, G + 2.2, 1.45], 4, 1.4, [0.6, 0, 0.1], 0.5, 6.5, steam, 0.6);

  const mini = assemble('nizhnekamsk', [b, a]);
  const mesh = mini.group.children[1] as THREE.Mesh;
  mini.update = anim.bind(mesh, 1.5);
  mini.update(0);
  return mini;
}
