// Чистополь: гигантские «Командирские» на площади (часовой завод «Восток», приехавший
// из Москвы в 1941-м; стрелки идут), дом Вавиловых (музей Пастернака), Дом учителя,
// корпус завода с трубой и Кама с пароходом, на котором прибывали эвакуированные.
import * as THREE from 'three';
import { Builder, assemble, clipConvex, mix, plinth, ringXZ, shade, type Col, type Miniature, type P2, type P3, type Place } from './kit';
import { tree } from './archi';

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

/** Вальмовая крыша w×d высотой h, конёк вдоль X. */
function hipRoof(b: Builder, w: number, d: number, h: number, color: Col, p: Place): void {
  const x = w / 2;
  const z = d / 2;
  const r = Math.max(0, x - z * 0.9);
  b.group(p, () => {
    const A: P3 = [-x, 0, z];
    const B: P3 = [x, 0, z];
    const C: P3 = [x, 0, -z];
    const D: P3 = [-x, 0, -z];
    const R0: P3 = [-r, h, 0];
    const R1: P3 = [r, h, 0];
    b.tri(A, B, R1, color, [0, z, h]);
    b.tri(A, R1, R0, color, [0, z, h]);
    b.tri(C, D, R0, color, [0, z, -h]);
    b.tri(C, R0, R1, color, [0, z, -h]);
    b.tri(B, C, R1, color, [h, x - r, 0]);
    b.tri(D, A, R0, color, [-h, x - r, 0]);
  });
}

/** Полуарка [x, y] радиуса r от y0 (для профилей). */
function arch(r: number, seg: number, y0: number): P2[] {
  const pts: P2[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI;
    pts.push([Math.cos(a) * r, y0 + Math.sin(a) * r]);
  }
  return pts;
}

/** Берёза: белый ствол и вытянутая светлая крона. */
function birch(b: Builder, x: number, z: number, y: number, s = 1): void {
  const k = 0.92 + (((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1) + 1) % 1 * 0.18;
  const leaf = mix('forest', 'plain', 0.42).multiplyScalar(k);
  b.group(
    { at: [x, y, z], s, ry: x * 2 + z },
    () => {
      b.cyl(0.07, 0.05, 0.9, 5, 'stoneWhite', undefined, { top: false });
      b.lathe(
        [
          [0, 0.5],
          [0.36, 0.72],
          [0.44, 1.1],
          [0.34, 1.5],
          [0, 1.75],
        ],
        6,
        leaf,
      );
    },
    { shadowGroup: true },
  );
}

/** Человечек-точка. */
function person(b: Builder, x: number, z: number, y: number, c: Col): void {
  b.group(
    { at: [x, y, z], ry: x * 5 },
    () => {
      b.cyl(0.055, 0.045, 0.17, 4, c);
      b.box(0.065, 0.065, 0.065, mix('stoneSand', 'accent', 0.25), { at: [0, 0.17, 0] });
    },
    { shadowGroup: true },
  );
}

/** Окно с белым наличником: рама, стекло, бровка сверху. */
function trimWindow(b: Builder, at: P3, w: number, h: number, glass: Col, trim: Col, ry = 0, brow = true): void {
  b.group({ at, ry }, () => {
    b.rect(w + 0.07, h + 0.07, trim, { at: [0, -0.035, 0] });
    b.rect(w, h, glass, { at: [0, 0, 0.006] });
    if (brow) b.box(w + 0.14, 0.05, 0.05, trim, { at: [0, h + 0.05, 0.01], shadow: false });
  });
}

/** Маленький деревянный дом с двускатной крышей (фоновая застройка). */
function cottage(b: Builder, at: P3, ry: number, wall: Col, roof: Col): void {
  b.group(
    { at, ry },
    () => {
      b.box(1.0, 0.5, 0.75, wall);
      b.gable(1.1, 0.85, 0.38, roof, { at: [0, 0.5, 0] }, { ends: shade(wall, 0.92) });
      for (const x of [-0.25, 0.25]) trimWindow(b, [x, 0.17, 0.38], 0.14, 0.2, 'roofDark', 'stoneWhite', 0, false);
    },
    { shadowGroup: true },
  );
}

// ---------- модель ----------

export function buildChistopol(): Miniature {
  const b = new Builder();
  const G = plinth(b, 'plain');
  const ring = ringXZ(4.66, 14);
  const steel = 'steel';
  const steelL = shade('steel', 1.18);
  const steelD = shade('steel', 0.78);

  // ---- Кама вдоль южного края: вода, отмель, набережная ----
  b.flat(
    clipConvex(
      [
        [-6, 2.95],
        [0, 2.75],
        [6, 2.55],
        [6, 6],
        [-6, 6],
      ],
      ring,
    ),
    G + 0.05,
    'water',
  );
  b.flat(
    clipConvex(
      [
        [-6, 3.6],
        [6, 3.3],
        [6, 6],
        [-6, 6],
      ],
      ring,
    ),
    G + 0.055,
    'river',
  );
  b.flat(
    clipConvex(
      [
        [-6, 2.55],
        [6, 2.15],
        [6, 2.65],
        [-6, 3.05],
      ],
      ring,
    ),
    G + 0.012,
    'stoneSand',
  );
  // улица вдоль набережной
  b.flat(
    clipConvex(
      [
        [-6, 1.75],
        [6, 1.45],
        [6, 1.9],
        [-6, 2.2],
      ],
      ring,
    ),
    G + 0.016,
    mix('steel', 'stoneSand', 0.45),
  );
  // пристань
  b.box(0.42, 0.06, 1.25, shade('wood', 0.95), { at: [1.85, G + 0.07, 3.05], ry: -0.03 });
  for (const z of [2.6, 3.1, 3.6]) {
    for (const x of [1.67, 2.03]) b.cyl(0.035, 0.035, 0.12, 4, shade('wood', 0.7), { at: [x, G + 0.02, z], shadow: false });
  }
  b.box(0.6, 0.32, 0.4, mix('stoneWhite', 'roofBlue', 0.15), { at: [1.85, G + 0.13, 3.55] });
  b.gable(0.68, 0.48, 0.18, 'roofBlue', { at: [1.85, G + 0.45, 3.55], ry: Math.PI / 2 }, { ends: 'stoneWhite' });

  // ящики с оборудованием на берегу (баржи завода пришли по Каме в 1941-м), фонари
  for (const [x, z, h, r] of [
    [2.45, 2.42, 0.2, 0.1],
    [2.7, 2.36, 0.24, -0.15],
    [2.56, 2.4, 0.16, 0.3],
  ] as [number, number, number, number][]) {
    b.box(0.22, h, 0.22, mix('wood', 'gold', 0.25), { at: [x, G + (x === 2.56 ? 0.21 : 0.012), z], ry: r });
  }
  for (const x of [-3.2, -1.6, 0.2, 2.9]) {
    const z = 2.27 - x * 0.024;
    b.box(0.03, 0.5, 0.03, 'oilBlack', { at: [x, G, z], shadow: false });
    b.box(0.08, 0.08, 0.08, mix('gold', 'kamazWhite', 0.5), { at: [x, G + 0.5, z], shadow: false });
  }

  // ---- площадь с гигантскими «Командирскими» ----
  const W: P3 = [-0.55, G, 0.75];
  const WRY = 0.14;
  const S = 1.12; // масштаб часов
  const yc = 1.5; // центр циферблата над площадью
  const zc = -0.98; // центр петли ремешка
  const rz = 1.0;
  const ry = 1.58;
  const th = 0.13;
  const plaza = mix('stoneSand', 'stoneWhite', 0.35);
  b.flat(ringXZ(2.05, 16, 0, W[0] + Math.sin(WRY) * zc, W[2] + zc * 0.6), G + 0.014, plaza);
  b.flat(
    [
      [W[0] - 0.35, W[2] + 1.0],
      [W[0] + 0.35, W[2] + 1.0],
      [W[0] + 0.3, 1.8],
      [W[0] - 0.4, 1.8],
    ],
    G + 0.015,
    plaza,
  );
  const strapC = mix('oilBlack', 'wood', 0.18);
  b.group(
    { at: W, ry: WRY, s: S },
    () => {
      // гранитный постамент
      b.lathe(
        [
          [1.32, 0],
          [1.3, 0.12],
          [1.2, 0.16],
        ],
        16,
        shade('roofDark', 1.25),
        { at: [0, 0, zc] },
        { capTop: shade('roofDark', 1.4) },
      );
      const y0 = 0.16;
      // ремешок-петля: две половины кольца в плоскости (z, y)
      for (const [a0, a1] of [
        [0, Math.PI],
        [Math.PI, Math.PI * 2],
      ]) {
        const pts: P2[] = [];
        const n = 14;
        for (let i = 0; i <= n; i++) {
          const a = a0 + ((a1 - a0) * i) / n;
          pts.push([zc + Math.cos(a) * rz, y0 + ry + Math.sin(a) * ry]);
        }
        for (let i = n; i >= 0; i--) {
          const a = a0 + ((a1 - a0) * i) / n;
          pts.push([zc + Math.cos(a) * (rz - th), y0 + ry + Math.sin(a) * (ry - th)]);
        }
        b.profile(pts, 0.98, strapC, { ry: -Math.PI / 2 });
      }
      // строчка по краям ремешка и пряжка на «затылке» петли
      b.box(1.12, 0.46, 0.26, steelL, { at: [0, y0 + ry - 0.23, zc - rz + 0.06] });
      b.box(0.86, 0.3, 0.28, strapC, { at: [0, y0 + ry - 0.15, zc - rz + 0.07] });
      for (let i = 0; i < 4; i++) {
        const a = Math.PI * 0.62 + i * 0.13;
        b.box(0.08, 0.03, 0.08, steelD, {
          at: [0, y0 + ry + Math.sin(a) * ry + 0.0, zc + Math.cos(a) * rz],
          rx: a - Math.PI / 2,
          shadow: false,
        });
      }

      // корпус: стальной «бочонок», вращающийся безель с красными точками
      b.group({ at: [0, y0 + yc - 0.16, 0.02] }, () => {
        // ушки ремешка
        for (const sy of [1, -1]) b.box(0.92, 0.32, 0.32, steel, { at: [0, sy > 0 ? 0.92 : -1.24, 0.12] });
        b.lathe(
          [
            [0.9, 0],
            [1.06, 0.08],
            [1.15, 0.24],
            [1.15, 0.36],
            [1.13, 0.47],
            [1.0, 0.52],
            [0.86, 0.5],
          ],
          24,
          steel,
          { rx: Math.PI / 2 },
          {
            bands: [steelD, steel, steelL, steelL, shade('steel', 1.05), shade('steel', 0.9)],
            capTop: mix('stoneWhite', 'stoneSand', 0.35),
          },
        );
        // заводная головка на «3»
        b.cyl(0.14, 0.14, 0.22, 8, steelL, { at: [1.1, 0, 0.26], rz: -Math.PI / 2 });
        b.cyl(0.07, 0.07, 0.12, 6, steel, { at: [1.06, 0, 0.26], rz: -Math.PI / 2 });
        // красные точки и риски безеля
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const p: P3 = [Math.sin(a) * 1.06, Math.cos(a) * 1.06, 0.512];
          if (i % 3 === 0) b.disc(0.05, 6, 'accent', { at: p });
          else b.rect(0.035, 0.09, 'accent', { at: [p[0], p[1] - 0.045, p[2]], rz: -a });
        }
        // циферблат: кольцо минутной шкалы, часовые метки, «12», звезда, окно даты
        const fz = 0.505;
        b.disc(0.86, 24, mix('roofDark', 'roofBlue', 0.25), { at: [0, 0, fz - 0.002] });
        b.disc(0.79, 24, mix('stoneWhite', 'stoneSand', 0.35), { at: [0, 0, fz + 0.002] });
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          if (i === 0) continue;
          const big = i % 3 === 0;
          const r = 0.6;
          b.rect(big ? 0.07 : 0.05, big ? 0.2 : 0.15, 'roofDark', { at: [Math.sin(a) * r, Math.cos(a) * r - (big ? 0.1 : 0.075), fz + 0.006], rz: -a });
        }
        // «12»: единица и двойка из штрихов
        b.rect(0.045, 0.2, 'roofDark', { at: [-0.08, 0.45, fz + 0.006] });
        b.rect(0.11, 0.04, 'roofDark', { at: [0.07, 0.61, fz + 0.006] });
        b.rect(0.04, 0.08, 'roofDark', { at: [0.11, 0.53, fz + 0.006] });
        b.rect(0.12, 0.04, 'roofDark', { at: [0.06, 0.45, fz + 0.006], rz: 0.6 });
        b.rect(0.12, 0.04, 'roofDark', { at: [0.07, 0.45, fz + 0.006] });
        b.disc(0.1, 5, 'accent', { at: [0, -0.38, fz + 0.006], rz: Math.PI / 2 });
        b.rect(0.16, 0.12, 'stoneWhite', { at: [0.45, -0.06, fz + 0.006] });
        b.rect(0.18, 0.025, 'roofDark', { at: [-0.0, 0.2, fz + 0.006] });
      });
    },
    { shadowGroup: true },
  );

  // ---- дом Вавиловых (музей Пастернака): оранжевый кирпич, белые наличники ----
  const brick = mix('brickRed', 'accent', 0.45);
  const white = 'stoneWhite';
  const roofBrown = mix('roofDark', 'wood', 0.35);
  b.group(
    { at: [2.55, G, 0.45], ry: -0.18 },
    () => {
      const w = 2.2;
      const d = 1.35;
      b.box(w, 0.62, d, brick);
      b.box(w + 0.06, 0.06, d + 0.06, shade(brick, 1.1), { at: [0, 0.6, 0] });
      b.box(w, 0.66, d, brick, { at: [0, 0.66, 0] });
      b.box(w + 0.14, 0.08, d + 0.14, white, { at: [0, 1.3, 0] });
      hipRoof(b, w + 0.18, d + 0.18, 0.5, roofBrown, { at: [0, 1.38, 0] });
      // нижний этаж — арочные окна, верхний — окна с «бровками»
      for (let i = 0; i < 4; i++) {
        const x = -0.78 + i * 0.52;
        trimWindow(b, [x, 0.14, d / 2 + 0.005], 0.22, 0.3, mix('glass', 'roofDark', 0.45), white, 0, false);
        b.disc(0.145, 6, white, { at: [x, 0.45, d / 2 + 0.004] });
        b.disc(0.11, 6, mix('glass', 'roofDark', 0.45), { at: [x, 0.45, d / 2 + 0.008] });
        trimWindow(b, [x, 0.78, d / 2 + 0.005], 0.22, 0.36, mix('glass', 'roofDark', 0.35), white);
      }
      for (let i = 0; i < 2; i++) {
        const z = -0.3 + i * 0.6;
        trimWindow(b, [-w / 2 - 0.005, 0.78, z], 0.22, 0.36, mix('glass', 'roofDark', 0.35), white, -Math.PI / 2);
        trimWindow(b, [-w / 2 - 0.005, 0.16, z], 0.22, 0.28, mix('glass', 'roofDark', 0.45), white, -Math.PI / 2, false);
      }
      // деревянный слуховой фронтон с полукруглым окном и трубы
      b.group({ at: [0, 1.38, 0.42] }, () => {
        b.box(0.62, 0.32, 0.3, shade('wood', 0.85));
        b.profile(arch(0.31, 6, 0), 0.3, shade('wood', 0.75), { at: [0, 0.32, 0] });
        b.rect(0.16, 0.2, 'roofDark', { at: [0, 0.1, 0.16] });
      });
      for (const x of [-0.75, 0.75]) {
        b.box(0.2, 0.55, 0.2, shade(brick, 0.85), { at: [x, 1.45, -0.15] });
        b.box(0.26, 0.06, 0.26, shade(brick, 0.7), { at: [x, 2.0, -0.15] });
      }
      // одноэтажный двор-флигель и кирпичная ограда
      b.box(0.9, 0.62, 1.0, shade(brick, 0.95), { at: [1.4, 0, -0.35] });
      b.gable(1.0, 1.1, 0.3, roofBrown, { at: [1.4, 0.62, -0.35], ry: Math.PI / 2 }, { ends: brick });
      b.box(0.08, 0.42, 0.9, shade(brick, 0.9), { at: [1.85, 0, 0.55] });
      // резные ворота слева
      b.box(0.5, 0.5, 0.06, mix('wood', 'gold', 0.4), { at: [-1.4, 0, 0.55] });
      b.box(0.62, 0.08, 0.12, shade('wood', 0.75), { at: [-1.4, 0.5, 0.55] });
    },
    { shadowGroup: true },
  );

  // ---- Дом учителя: розовый угловой дом со срезанным углом и балконом ----
  const pink = mix('stoneWhite', 'accent', 0.2);
  b.group(
    { at: [-2.85, G, 0.25], ry: Math.PI / 4 - 0.15 },
    () => {
      // два крыла под углом, угол — на зрителя
      const wing = (len: number, rot: number, side: number) =>
        b.group({ ry: rot }, () => {
          b.box(len, 1.2, 0.85, pink, { at: [len / 2 - 0.42, 0, 0] });
          b.box(len, 0.06, 0.88, shade(pink, 1.08), { at: [len / 2 - 0.42, 0.56, 0] });
          b.box(len + 0.06, 0.08, 0.95, white, { at: [len / 2 - 0.42, 1.18, 0] });
          hipRoof(b, len + 0.1, 0.98, 0.32, shade('steel', 0.85), { at: [len / 2 - 0.42, 1.26, 0] });
          for (let i = 0; i < 3; i++) {
            const x = 0.35 + i * 0.36;
            trimWindow(b, [x, 0.16, side * 0.43], 0.16, 0.28, 'roofDark', white, side < 0 ? Math.PI : 0, false);
            trimWindow(b, [x, 0.72, side * 0.43], 0.16, 0.32, 'roofDark', white, side < 0 ? Math.PI : 0);
          }
        });
      wing(1.7, 0, 1);
      wing(1.5, Math.PI / 2, -1);
      // срезанный угол: дверь, балкон на кронштейнах
      b.group({ at: [-0.34, 0, 0.34], ry: -Math.PI / 4 }, () => {
        b.box(0.62, 1.2, 0.3, pink);
        b.box(0.66, 0.08, 0.34, white, { at: [0, 1.18, 0] });
        b.rect(0.22, 0.42, shade('roofBlue', 0.6), { at: [0, 0, 0.155] });
        b.rect(0.2, 0.36, shade('roofBlue', 0.6), { at: [0, 0.68, 0.155] });
        b.box(0.74, 0.04, 0.3, white, { at: [0, 0.6, 0.25] });
        b.box(0.74, 0.14, 0.015, 'roofDark', { at: [0, 0.64, 0.39], shadow: false });
      });
    },
    { shadowGroup: true },
  );

  // ---- часовой завод «Восток»: корпус с ленточным остеклением, часы на башне, труба ----
  const factory = mix('stoneWhite', 'stoneSand', 0.3);
  b.group(
    { at: [-0.2, G, -3.05], ry: 0.06 },
    () => {
      b.box(3.8, 1.35, 1.0, factory, undefined, { top: shade('steel', 0.95) });
      b.box(3.86, 0.1, 1.06, shade(factory, 0.9), { at: [0, 1.35, 0] });
      for (const y of [0.18, 0.6, 1.0]) b.rect(3.5, 0.24, mix('glass', 'roofBlue', 0.25), { at: [0, y, 0.505] });
      for (let i = 0; i <= 7; i++) b.rect(0.06, 1.1, factory, { at: [-1.75 + i * 0.5, 0.15, 0.51] });
      // лестничная башня с часами
      b.box(0.8, 1.95, 1.1, shade(factory, 1.02), { at: [0.3, 0, 0.05] });
      b.box(0.86, 0.08, 1.16, shade(factory, 0.88), { at: [0.3, 1.95, 0.05] });
      b.disc(0.26, 12, 'roofDark', { at: [0.3, 1.55, 0.605] });
      b.disc(0.22, 12, 'kamazWhite', { at: [0.3, 1.55, 0.61] });
      b.rect(0.03, 0.18, 'roofDark', { at: [0.3, 1.55, 0.615] });
      b.rect(0.03, 0.13, 'roofDark', { at: [0.3, 1.55, 0.616], rz: -2.1 });
      b.rect(0.24, 0.9, mix('glass', 'roofBlue', 0.25), { at: [0.3, 0.2, 0.605] });
      // пристройка цеха с шедовой крышей
      b.group({ at: [-1.15, 1.45, 0] }, () => {
        for (let i = 0; i < 3; i++) {
          b.profile(
            [
              [0, 0],
              [0.42, 0],
              [0.42, 0.28],
            ],
            0.9,
            shade('steel', 0.92),
            { at: [-0.65 + i * 0.44, 0, 0] },
            { faces: [undefined, mix('glass', 'roofBlue', 0.3), undefined] },
          );
        }
      });
    },
    { shadowGroup: true },
  );
  // кирпичная труба котельной
  b.group(
    { at: [1.95, G, -3.35] },
    () => {
      b.box(0.8, 0.5, 0.8, shade('brickRed', 0.95), undefined, { top: shade('brickRed', 0.8) });
      b.lathe(
        [
          [0.32, 0.5],
          [0.27, 2.6],
          [0.22, 4.55],
          [0.26, 4.65],
          [0.26, 4.85],
        ],
        12,
        'brickRed',
        undefined,
        { bands: [shade('brickRed', 1.03), 'brickRed', shade('brickRed', 0.85), shade('oilBlack', 1.4)], capTop: 'oilBlack' },
      );
      b.cyl(0.29, 0.29, 0.08, 12, white, { at: [0, 3.6, 0] });
    },
    { shadowGroup: true },
  );

  // ---- фоновая застройка, деревья, люди ----
  cottage(b, [-3.1, G, -1.75], 0.4, mix('wood', 'gold', 0.3), 'roofGreen');
  cottage(b, [-2.1, G, -2.55], 0.25, mix('roofBlue', 'glass', 0.55), 'roofDark');
  cottage(b, [3.35, G, -1.55], -0.5, mix('stoneSand', 'gold', 0.25), 'brickRed');
  cottage(b, [2.8, G, -2.6], -0.35, mix('roofGreen', 'stoneSand', 0.5), 'roofDark');

  birch(b, 1.25, -0.8, G, 0.95);
  birch(b, 1.75, -1.55, G, 1.1);
  birch(b, 3.75, -0.3, G, 0.9);
  birch(b, -1.6, -1.95, G, 1.0);
  birch(b, -3.95, -0.85, G, 0.85);
  birch(b, -1.05, 2.25, G, 0.6);
  birch(b, 0.55, 2.3, G, 0.55);
  tree(b, 3.85, 1.05, G, 0.6);
  tree(b, -4.1, 0.95, G, 0.55);
  tree(b, 0.95, -2.1, G, 0.5);

  for (const [x, z, c] of [
    [0.75, 0.95, 'accent'],
    [-1.7, 1.25, 'roofBlue'],
    [0.95, 1.35, 'roofDark'],
    [-0.2, 1.95, 'kamazBlue'],
    [1.6, 2.4, 'brickRed'],
    [-2.6, 2.6, 'roofGreen'],
    [2.2, 1.65, 'gold'],
  ] as [number, number, Col][]) {
    person(b, x, z, G + 0.014, c);
  }

  // ---- анимация: стрелки часов и пароход на Каме ----
  const anim = new Animated(G);
  const a = anim.b;
  const qW = new THREE.Matrix4().compose(
    new THREE.Vector3(...W),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, WRY, 0)),
    new THREE.Vector3(S, S, S),
  );
  const pivot = new THREE.Vector3(0, 0.16 + yc - 0.16, 0.02 + 0.52).applyMatrix4(qW);
  const axis = new THREE.Vector3(Math.sin(WRY), 0, Math.cos(WRY));
  const tmpM = new THREE.Matrix4();
  const tmpT = new THREE.Matrix4();
  const hand = (speed: number, phase: number): Motion => (t, m) => {
    m.makeTranslation(pivot.x, pivot.y, pivot.z)
      .multiply(tmpM.makeRotationAxis(axis, -(phase + t * speed)))
      .multiply(tmpT.makeTranslation(-pivot.x, -pivot.y, -pivot.z));
  };
  const inWatch = (fn: () => void) =>
    a.group({ at: W, ry: WRY, s: S, shadow: false }, () => a.group({ at: [0, yc, 0.02] }, fn));
  const lume = mix('kamazWhite', 'gold', 0.15);
  anim.part(hand(Math.PI * 2 / 2400, 5.5), () =>
    inWatch(() => {
      a.rect(0.11, 0.42, 'roofDark', { at: [0, 0, 0.512] });
      a.rect(0.06, 0.26, lume, { at: [0, 0.12, 0.514] });
    }),
  );
  anim.part(hand(Math.PI * 2 / 200, 0.9), () =>
    inWatch(() => {
      a.rect(0.08, 0.64, 'roofDark', { at: [0, 0, 0.518] });
      a.rect(0.04, 0.44, lume, { at: [0, 0.16, 0.52] });
    }),
  );
  anim.part(hand(Math.PI * 2 / 20, 2.4), () =>
    inWatch(() => {
      a.rect(0.025, 0.86, 'accent', { at: [0, -0.18, 0.524] });
      a.disc(0.06, 8, 'accent', { at: [0, 0, 0.526] });
      a.disc(0.03, 6, steelL, { at: [0, 0, 0.528] });
    }),
  );

  // пароход: тёмный корпус, белые надстройки, красная труба, гребные колёса
  const B0: P3 = [-1.5, G + 0.05, 3.72];
  anim.part(
    (t, m) => {
      const bob = Math.sin(t * 1.6) * 0.03;
      const roll = Math.sin(t * 1.1 + 0.6) * 0.035;
      m.makeTranslation(B0[0] + Math.sin(t * 0.25) * 0.15, B0[1] + bob, B0[2])
        .multiply(tmpM.makeRotationX(roll))
        .multiply(tmpT.makeTranslation(-B0[0], -B0[1], -B0[2]));
    },
    () =>
      a.group({ at: B0, ry: 0.05, shadow: false }, () => {
        const hull: P2[] = [
          [-1.05, -0.26],
          [0.75, -0.26],
          [1.15, 0],
          [0.75, 0.26],
          [-1.05, 0.26],
          [-1.12, 0],
        ];
        a.extrude(hull, 0.2, shade('roofDark', 0.9), { at: [0, -0.06, 0] }, { top: shade('wood', 1.05) });
        a.extrude(hull.map(([x, z]) => [x * 1.01, z * 1.04] as P2), 0.05, 'accent', { at: [0, 0.1, 0] }, { top: shade('wood', 1.05) });
        a.box(1.3, 0.24, 0.42, 'kamazWhite', { at: [-0.2, 0.14, 0] }, { top: shade('steel', 1.1) });
        a.box(0.7, 0.2, 0.34, 'kamazWhite', { at: [-0.1, 0.38, 0] }, { top: shade('steel', 1.1) });
        a.box(0.26, 0.14, 0.26, mix('glass', 'kamazWhite', 0.3), { at: [0.35, 0.38, 0] });
        for (let i = 0; i < 6; i++) a.rect(0.1, 0.08, mix('glass', 'roofDark', 0.4), { at: [-0.75 + i * 0.22, 0.22, 0.212] });
        a.cyl(0.08, 0.08, 0.42, 8, 'accent', { at: [-0.25, 0.58, 0] }, { top: 'oilBlack' });
        a.cyl(0.085, 0.085, 0.08, 8, 'oilBlack', { at: [-0.25, 0.92, 0] });
        // кожухи гребных колёс
        for (const s of [1, -1]) {
          a.profile(arch(0.24, 5, 0), 0.12, 'kamazWhite', { at: [0.05, 0.08, s * 0.3] }, { caps: mix('kamazWhite', 'accent', 0.12) });
        }
        // флагшток на корме
        a.box(0.02, 0.35, 0.02, 'roofDark', { at: [-1.0, 0.14, 0] });
        a.rect(0.16, 0.1, 'accent', { at: [-0.92, 0.38, 0], ry: 0 });
      }),
  );

  const mini = assemble('chistopol', [b, a]);
  const mesh = mini.group.children[1] as THREE.Mesh;
  mini.update = anim.bind(mesh, 0.5);
  mini.update(0);
  return mini;
}
