// Елабуга: башня Чёртова городища на крутом холме над Камой (с деревянной лестницей),
// Спасский собор с ярусной колокольней, голубой дом Шишкиных с верандой, жёлтая
// деревянная усадьба Дуровой, бревенчатый дом Цветаевой, купеческая улица и лодка на реке.
import * as THREE from 'three';
import {
  Builder,
  SUN,
  assemble,
  clipConvex,
  convexHull,
  groundShadow,
  mix,
  plinth,
  ringXZ,
  shade,
  type Col,
  type Miniature,
  type P2,
  type P3,
  type Place,
} from './kit';
import { HELMET, ONION, roundTree, scaleProfile, spire, tree } from './archi';

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

/** Окно: светлый наличник и тёмное стекло (смотрит в +Z). */
function win(b: Builder, at: P3, w: number, h: number, trim: Col, glass: Col = mix('roofDark', 'glass', 0.25), ry = 0): void {
  b.group({ at, ry }, () => {
    b.rect(w + 0.06, h + 0.06, trim, { at: [0, -0.03, 0] });
    b.rect(w, h, glass, { at: [0, 0, 0.005] });
  });
}

/** Арочный проём: прямоугольник с полукруглым верхом. */
function archOpening(b: Builder, at: P3, w: number, h: number, c: Col, ry = 0): void {
  b.group({ at, ry }, () => {
    b.rect(w, h - w / 2, c);
    b.disc(w / 2, 6, c, { at: [0, h - w / 2, 0] });
  });
}

/** Человечек-точка. */
function person(b: Builder, x: number, z: number, y: number, c: Col): void {
  b.group(
    { at: [x, y, z], ry: x * 5 },
    () => {
      b.cyl(0.05, 0.04, 0.16, 4, c);
      b.box(0.06, 0.06, 0.06, mix('stoneSand', 'accent', 0.25), { at: [0, 0.16, 0] });
    },
    { shadowGroup: true },
  );
}

/** Портик: колонны, антаблемент и треугольный фронтон (фасад в +Z). */
function portico(b: Builder, at: P3, ry: number, w: number, h: number, n: number, white: Col): void {
  b.group({ at, ry }, () => {
    b.box(w + 0.1, 0.08, 0.42, shade(white, 0.92), { at: [0, 0, 0.18] });
    for (let i = 0; i < n; i++) b.cyl(0.05, 0.045, h, 6, white, { at: [-w / 2 + 0.06 + (i * (w - 0.12)) / (n - 1), 0.08, 0.3] });
    b.box(w + 0.06, 0.12, 0.45, white, { at: [0, h + 0.08, 0.17] });
    b.profile(
      [
        [-w / 2 - 0.04, 0],
        [w / 2 + 0.04, 0],
        [0, 0.26],
      ],
      0.45,
      shade(white, 0.97),
      { at: [0, h + 0.2, 0.17] },
    );
  });
}

// ---------- модель ----------

export function buildElabuga(): Miniature {
  const b = new Builder();
  const grass = 'plain';
  const G = plinth(b, grass);
  const ring = ringXZ(4.66, 14);
  const white = 'stoneWhite';
  const wtop = shade(white, 0.88);

  // ---- Кама (Тойма) вдоль восточного края: вода, отмель ----
  b.flat(
    clipConvex(
      [
        [3.3, -6],
        [3.4, -2.6],
        [3.1, 0.2],
        [3.15, 2.0],
        [2.4, 6],
        [8, 6],
        [8, -6],
      ],
      ring,
    ),
    G + 0.05,
    'water',
  );
  b.flat(
    clipConvex(
      [
        [3.85, -6],
        [3.85, -1.5],
        [3.6, 1.0],
        [3.3, 6],
        [8, 6],
        [8, -6],
      ],
      ring,
    ),
    G + 0.055,
    'river',
  );
  b.flat(
    clipConvex(
      [
        [3.05, -6],
        [3.15, -2.6],
        [2.85, 0.2],
        [2.9, 2.0],
        [2.15, 6],
        [2.7, 6],
        [3.42, 2.0],
        [3.35, 0.2],
        [3.62, -2.6],
        [3.5, -6],
      ],
      ring,
    ),
    G + 0.014,
    'stoneSand',
  );

  // ---- холм городища: неровный, крутой к реке, с осыпью на обрыве ----
  const HC: P2 = [1.75, -2.05];
  const R = (a: number) => 1.78 * (1 + 0.08 * Math.sin(3 * a + 1) + 0.05 * Math.sin(5 * a + 2));
  const levels: [number, number, P2][] = [
    [1.0, 0, [0, 0]],
    [0.84, 0.5, [0.1, 0]],
    [0.66, 1.08, [0.22, 0.02]],
    [0.5, 1.5, [0.3, 0.03]],
    [0.44, 1.6, [0.32, 0.03]],
  ];
  const SEG = 16;
  const rings = levels.map(([f, h, sh]) => {
    const pts: P3[] = [];
    for (let j = 0; j < SEG; j++) {
      const a = (j / SEG) * Math.PI * 2;
      const r = R(a) * f;
      pts.push([HC[0] + sh[0] + Math.cos(a) * r, G + h, HC[1] + sh[1] + Math.sin(a) * r]);
    }
    return pts;
  });
  const meadow = mix('lowland', 'plain', 0.35);
  const cliff = mix('ridge', 'stoneSand', 0.35);
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const face = (A: P3, B: P3, C: P3) => {
    va.set(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
    vb.set(C[0] - A[0], C[1] - A[1], C[2] - A[2]);
    const n = va.clone().cross(vb);
    if (n.y < 0) n.negate();
    n.normalize();
    const steep = 1 - n.y;
    // осыпь — только на обрыве к реке, остальное — травянистые склоны
    const bare = Math.min(1, Math.max(0, (n.x - 0.25) * 2.2) * Math.min(1, steep * 2.2));
    const c = mix(shade(meadow, 0.9 + n.y * 0.12), cliff, bare);
    b.tri(A, B, C, c, [n.x, n.y, n.z], { shadow: false, ao: false });
  };
  for (let k = 0; k < rings.length - 1; k++) {
    for (let j = 0; j < SEG; j++) {
      const A = rings[k][j];
      const B = rings[k][(j + 1) % SEG];
      const C = rings[k + 1][(j + 1) % SEG];
      const D = rings[k + 1][j];
      face(A, B, C);
      face(A, C, D);
    }
  }
  const topRing = rings[rings.length - 1];
  const TOP = G + levels[levels.length - 1][1];
  const tc: P2 = [HC[0] + 0.32, HC[1] + 0.03];
  b.flat(
    topRing.map(([x, , z]) => [x, z] as P2),
    TOP,
    meadow,
  );

  // ---- башня Чёртова городища: расширенное книзу основание, низкий восьмискатный шатёр ----
  const stone = mix('stoneSand', 'steel', 0.32);
  const TW: P3 = [tc[0], TOP, tc[1]];
  const towerH = 1.75;
  // тень башни на макушке холма (тени на основную плоскость тут неуместны)
  {
    const pts: P2[] = [];
    const k = (towerH + 0.45) / SUN.y;
    for (const p of ringXZ(0.62, 10, 0, TW[0], TW[2])) pts.push(p, [p[0] - SUN.x * k * 0.55, p[1] - SUN.z * k * 0.55]);
    const hull = clipConvex(
      convexHull(pts),
      topRing.map(([x, , z]) => [x, z] as P2),
    );
    if (hull.length >= 3) b.flat(hull, TOP + 0.02, groundShadow(meadow));
  }
  b.group({ at: TW, ry: -0.75, shadow: false, ao: TOP }, () => {
    b.lathe(
      [
        [0.66, 0],
        [0.58, 0.22],
        [0.5, 0.62],
        [0.46, 1.2],
        [0.46, towerH],
      ],
      14,
      stone,
      undefined,
      { bands: [shade(stone, 0.95), stone, shade(stone, 1.04), shade(stone, 1.06)], capTop: false },
    );
    // белёные заплаты кладки
    b.cyl(0.58, 0.58, 0.07, 8, shade('wood', 1.25), { at: [0, towerH, 0] }, { phase: Math.PI / 8 });
    b.lathe(
      [
        [0.6, towerH + 0.07],
        [0.52, towerH + 0.16],
        [0, towerH + 0.42],
      ],
      8,
      mix('steel', 'roofDark', 0.35),
      undefined,
      { phase: Math.PI / 8 },
    );
    spire(b, [0, towerH + 0.38, 0], 0.22, 0.03, steelish());
    // дверь в кирпичном обрамлении и зарешёченное окно с кирпичной перемычкой
    b.rect(0.34, 0.48, 'brickRed', { at: [0, 0.02, 0.6], rx: -0.1 });
    archOpening(b, [0, 0.02, 0.615], 0.24, 0.42, mix('steel', 'roofBlue', 0.25));
    b.rect(0.28, 0.06, 'brickRed', { at: [0, 1.28, 0.465] });
    b.rect(0.22, 0.26, shade('roofDark', 0.8), { at: [0, 1.0, 0.468] });
  });
  // остатки крепостных стен по краю площадки
  for (const [a0, a1] of [
    [0.4, 1.3],
    [2.2, 2.9],
    [3.7, 4.6],
  ]) {
    b.arc(0.86, 0.98, a0, a1, 0.16, 4, shade(stone, 0.8), { at: [TW[0], TOP, TW[2]], shadow: false, ao: false }, { top: shade(stone, 0.95) });
  }

  // деревянная лестница с холма к городу
  {
    const dir = new THREE.Vector2(-0.72, 0.69).normalize();
    const th = Math.atan2(dir.y, dir.x);
    const prof = levels.map(([f, h, sh]) => [sh[0] * dir.x + sh[1] * dir.y + R(th) * f, h] as P2).reverse();
    const hAt = (d: number) => {
      for (let i = 0; i < prof.length - 1; i++) {
        const [d0, h0] = prof[i];
        const [d1, h1] = prof[i + 1];
        if (d >= d0 && d <= d1) return h0 + ((h1 - h0) * (d - d0)) / (d1 - d0);
      }
      return d < prof[0][0] ? prof[0][1] : 0;
    };
    const d0 = prof[0][0] - 0.05;
    const d1 = prof[prof.length - 1][0] + 0.15;
    const n = 13;
    const wood = shade('wood', 1.1);
    const ryS = Math.atan2(-dir.y, dir.x);
    for (let i = 0; i <= n; i++) {
      const d = d0 + ((d1 - d0) * i) / n;
      const y = hAt(d);
      b.box(0.14, 0.06, 0.34, wood, { at: [HC[0] + dir.x * d, G + y + 0.0, HC[1] + dir.y * d], ry: ryS, shadow: false, ao: false });
    }
    // перила: столбики через ступень
    for (let i = 0; i <= n; i += 2) {
      const d = d0 + ((d1 - d0) * i) / n;
      const y = hAt(d);
      for (const s of [-1, 1]) {
        const ox = -dir.y * 0.17 * s;
        const oz = dir.x * 0.17 * s;
        b.box(0.03, 0.18, 0.03, shade('wood', 0.8), { at: [HC[0] + dir.x * d + ox, G + y, HC[1] + dir.y * d + oz], shadow: false, ao: false });
      }
    }
  }

  // ёлки и берёзки на пологих склонах холма (без падающих теней — склон не плоскость)
  const hillY = (x: number, z: number) => {
    const dx = x - HC[0];
    const dz = z - HC[1];
    const d = Math.hypot(dx, dz);
    const th = Math.atan2(dz, dx);
    const prof = levels.map(([f, h, sh]) => [(sh[0] * dx + sh[1] * dz) / (d || 1) + R(th) * f, h] as P2).reverse();
    for (let i = 0; i < prof.length - 1; i++) {
      const [d0, h0] = prof[i];
      const [d1, h1] = prof[i + 1];
      if (d >= d0 && d <= d1) return h0 + ((h1 - h0) * (d - d0)) / (d1 - d0);
    }
    return d < prof[0][0] ? prof[0][1] : 0;
  };
  for (const [x, z, s, kind] of [
    [0.55, -2.75, 0.55, 0],
    [0.75, -1.35, 0.45, 1],
    [1.25, -3.35, 0.5, 0],
    [2.15, -0.75, 0.42, 1],
    [0.4, -2.05, 0.5, 0],
    [2.85, -3.35, 0.45, 0],
  ] as [number, number, number, number][]) {
    b.group({ shadow: false, ao: false }, () => {
      if (kind === 0) tree(b, x, z, G + hillY(x, z) - 0.05, s);
      else roundTree(b, x, z, G + hillY(x, z) - 0.05, s);
    });
  }
  person(b, TW[0] - 0.75, TW[2] + 0.35, TOP, 'accent');
  person(b, TW[0] - 0.55, TW[2] + 0.7, TOP, 'roofBlue');

  // пристань с лодками у берега
  b.box(0.85, 0.05, 0.26, shade('wood', 1.05), { at: [3.3, G + 0.07, 1.65], ry: 0.05 });
  for (const [x, z] of [
    [3.0, 1.55],
    [3.6, 1.52],
  ] as P2[]) {
    b.cyl(0.03, 0.03, 0.14, 4, shade('wood', 0.7), { at: [x, G + 0.02, z + 0.12], shadow: false });
  }
  for (const [x, z, r] of [
    [3.55, 1.98, -0.15],
    [3.85, 1.3, 0.35],
  ] as P3[]) {
    b.group({ at: [x, G + 0.03, z], ry: r }, () => {
      const hull: P2[] = [
        [-0.3, -0.09],
        [0.22, -0.1],
        [0.34, 0],
        [0.22, 0.1],
        [-0.3, 0.09],
      ];
      b.extrude(hull, 0.08, 'kamazWhite', undefined, { top: shade('wood', 1.15) });
      b.extrude(hull.map(([px, pz]) => [px * 1.03, pz * 1.1] as P2), 0.03, 'roofBlue', { at: [0, 0.06, 0] }, { top: shade('wood', 1.15) });
    });
  }

  // ---- Спасский собор: кубический объём с портиками, большой барабан и купол;
  //      трапезная и ярусная колокольня с золотым шпилем ----
  const green = 'roofGreen';
  b.group(
    { at: [-1.95, G, -1.55], ry: 0.12 },
    () => {
      // собор
      b.group(
        { at: [0.9, 0, 0] },
        () => {
          b.box(1.45, 1.3, 1.45, white, undefined, { top: wtop });
          b.box(1.53, 0.1, 1.53, shade(white, 0.93), { at: [0, 1.25, 0] });
          hipRoof(b, 1.5, 1.5, 0.3, green, { at: [0, 1.35, 0] });
          portico(b, [0, 0, 0.72], 0, 0.9, 0.85, 4, white);
          portico(b, [0.72, 0, 0], Math.PI / 2, 0.9, 0.85, 4, white);
          for (const x of [-0.5, 0.5]) {
            win(b, [x, 0.35, 0.73], 0.16, 0.36, white);
            win(b, [0.73, 0.35, x], 0.16, 0.36, white, undefined, Math.PI / 2);
          }
          // барабан с окнами, купол-«шлем», фонарик и золотая луковка
          b.cyl(0.52, 0.52, 0.6, 16, white, { at: [0, 1.5, 0] }, { top: false });
          b.cyl(0.56, 0.56, 0.07, 16, shade(white, 0.92), { at: [0, 2.08, 0] }, { top: false });
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
            archOpening(b, [Math.sin(a) * 0.525, 1.63, Math.cos(a) * 0.525], 0.12, 0.3, mix('roofDark', 'glass', 0.2), a);
          }
          b.lathe(scaleProfile(HELMET, 0.56, 0.55, 2.13), 16, green);
          b.cyl(0.1, 0.1, 0.2, 8, white, { at: [0, 2.6, 0] });
          b.lathe(scaleProfile(ONION, 0.14, 0.3, 2.78), 8, 'gold');
          spire(b, [0, 3.03, 0], 0.22, 0.03);
          // малые главки по углам
          for (const [x, z] of [
            [-0.55, -0.55],
            [0.55, -0.55],
            [-0.55, 0.55],
            [0.55, 0.55],
          ] as P2[]) {
            b.cyl(0.12, 0.12, 0.22, 8, white, { at: [x, 1.4, z] }, { top: false });
            b.lathe(scaleProfile(ONION, 0.14, 0.3, 1.62), 8, 'gold', { at: [x, 0, z] });
          }
        },
        { shadowGroup: true },
      );
      // трапезная
      b.group(
        { at: [-0.25, 0, 0] },
        () => {
          b.box(0.95, 0.8, 0.95, white, undefined, { top: wtop });
          b.box(1.0, 0.07, 1.0, shade(white, 0.93), { at: [0, 0.78, 0] });
          hipRoof(b, 1.02, 1.02, 0.25, green, { at: [0, 0.85, 0] });
          for (const x of [-0.22, 0.22]) archOpening(b, [x, 0.25, 0.48], 0.14, 0.38, mix('roofDark', 'glass', 0.2));
        },
        { shadowGroup: true },
      );
      // колокольня
      b.group(
        { at: [-1.25, 0, 0] },
        () => {
          const tiers: [number, number][] = [
            [0.95, 1.35],
            [0.78, 1.0],
            [0.62, 0.85],
          ];
          let y = 0;
          tiers.forEach(([w, h], k) => {
            b.box(w, h, w, white, { at: [0, y, 0] }, { top: wtop });
            b.box(w + 0.08, 0.08, w + 0.08, shade(white, 0.92), { at: [0, y + h - 0.04, 0] });
            for (const [cx, cz] of [
              [-1, -1],
              [1, -1],
              [-1, 1],
              [1, 1],
            ]) {
              b.box(0.07, h - 0.1, 0.07, shade(white, 1.02), { at: [(cx * w) / 2, y, (cz * w) / 2], shadow: false });
            }
            const ow = k === 0 ? 0.28 : 0.22;
            const oh = k === 0 ? 0.62 : h * 0.6;
            const oy = y + (k === 0 ? 0.0 : h * 0.18);
            const oc = k === 0 ? mix('wood', 'roofDark', 0.5) : shade('roofDark', 0.75);
            archOpening(b, [0, oy, w / 2 + 0.005], ow, oh, oc);
            archOpening(b, [-w / 2 - 0.005, oy, 0], ow, oh, oc, -Math.PI / 2);
            archOpening(b, [w / 2 + 0.005, oy, 0], ow, oh, oc, Math.PI / 2);
            y += h;
          });
          b.cyl(0.26, 0.26, 0.45, 12, white, { at: [0, y, 0] }, { top: false });
          b.cyl(0.3, 0.3, 0.06, 12, shade(white, 0.92), { at: [0, y + 0.42, 0] }, { top: false });
          b.lathe(scaleProfile(ONION, 0.3, 0.55, y + 0.47), 12, 'gold');
          spire(b, [0, y + 0.98, 0], 1.45, 0.07);
        },
        { shadowGroup: true },
      );
    },
  );

  // ---- улицы ----
  b.flat(
    clipConvex(
      [
        [-6, 0.75],
        [2.7, 0.62],
        [2.75, 1.08],
        [-6, 1.22],
      ],
      ring,
    ),
    G + 0.014,
    'stoneSand',
  );
  b.flat(
    [
      [0.72, 1.1],
      [1.12, 1.1],
      [1.2, 4.3],
      [0.8, 4.3],
    ],
    G + 0.015,
    'stoneSand',
  );

  // ---- дом Шишкиных: голубой, серый цоколь, белые наличники, деревянная веранда ----
  const blue = shade(mix('glass', 'roofBlue', 0.3), 1.08);
  b.group(
    { at: [-1.25, G, 2.05], ry: 0.04 },
    () => {
      const w = 2.0;
      const d = 0.95;
      b.box(w, 0.22, d, shade('steel', 0.82));
      b.box(w, 1.0, d, blue, { at: [0, 0.22, 0] });
      b.box(w + 0.04, 0.05, d + 0.04, white, { at: [0, 0.68, 0] });
      b.box(w + 0.12, 0.09, d + 0.12, white, { at: [0, 1.2, 0] });
      hipRoof(b, w + 0.14, d + 0.14, 0.32, shade('steel', 0.95), { at: [0, 1.29, 0] });
      for (let i = 0; i < 5; i++) {
        const x = -0.8 + i * 0.4;
        win(b, [x, 0.3, d / 2 + 0.005], 0.17, 0.3, white);
        win(b, [x, 0.8, d / 2 + 0.005], 0.17, 0.28, white);
      }
      for (const z of [-0.2, 0.2]) win(b, [-w / 2 - 0.005, 0.8, z], 0.17, 0.28, white, undefined, -Math.PI / 2);
      // балкончик
      b.box(0.5, 0.04, 0.2, shade('steel', 0.8), { at: [-0.6, 0.72, d / 2 + 0.1] });
      b.box(0.5, 0.12, 0.02, 'roofDark', { at: [-0.6, 0.76, d / 2 + 0.2], shadow: false });
      // веранда: белый дощатый низ, открытый верх на столбах, резное ограждение
      b.group({ at: [w / 2 + 0.38, 0, 0.05] }, () => {
        b.box(0.75, 0.22, 0.85, shade('steel', 0.82));
        b.box(0.75, 0.48, 0.85, mix(white, 'glass', 0.2), { at: [0, 0.22, 0] });
        win(b, [0, 0.3, 0.43], 0.4, 0.3, white);
        b.box(0.8, 0.06, 0.9, white, { at: [0, 0.7, 0] });
        b.box(0.8, 0.2, 0.9, white, { at: [0, 0.76, 0] }, { top: shade('wood', 0.9) });
        for (const [x, z] of [
          [-0.33, 0.4],
          [0.33, 0.4],
          [0.33, -0.4],
        ] as P2[]) {
          b.cyl(0.035, 0.035, 0.42, 5, mix('wood', 'accent', 0.3), { at: [x, 0.96, z] });
        }
        b.box(0.86, 0.06, 0.96, white, { at: [0, 1.36, 0] });
        hipRoof(b, 0.9, 1.0, 0.25, shade('steel', 0.95), { at: [0, 1.42, 0] });
      });
      // дощатые ворота с козырьком
      b.box(0.5, 0.55, 0.06, mix('wood', 'gold', 0.3), { at: [w / 2 + 1.05, 0, 0.3] });
      b.box(0.6, 0.06, 0.2, 'brickRed', { at: [w / 2 + 1.05, 0.58, 0.3] });
    },
    { shadowGroup: true },
  );

  // ---- усадьба Дуровой: жёлтый дощатый дом с фронтоном и полуциркульным окном,
  //      бревенчатый флигель на белёном цоколе ----
  const yellow = mix('wood', 'gold', 0.55);
  b.group(
    { at: [1.85, G, 2.25], ry: -0.3 },
    () => {
      b.box(0.95, 0.95, 1.0, yellow);
      b.gable(1.12, 1.08, 0.55, shade(yellow, 1.08), { at: [0, 0.95, 0], ry: Math.PI / 2 }, { ends: shade(yellow, 0.95) });
      b.profile(arch(0.2, 5, 0), 0.02, white, { at: [0, 1.0, 0.505] });
      b.profile(arch(0.16, 5, 0), 0.02, mix('roofDark', 'glass', 0.25), { at: [0, 1.0, 0.52] });
      for (const x of [-0.22, 0.22]) win(b, [x, 0.55, 0.505], 0.14, 0.16, white);
      // арочный козырёк над дверью
      b.rect(0.2, 0.38, shade('wood', 0.6), { at: [0, 0, 0.505] });
      b.profile(arch(0.17, 5, 0), 0.25, shade(yellow, 0.9), { at: [0, 0.4, 0.62] });
      // флигель
      b.group({ at: [0.95, 0, -0.15] }, () => {
        b.box(0.95, 0.28, 0.8, white);
        b.box(0.95, 0.42, 0.8, mix('wood', 'gold', 0.3), { at: [0, 0.28, 0] });
        for (let i = 0; i < 3; i++) b.box(0.97, 0.025, 0.82, shade('wood', 0.75), { at: [0, 0.38 + i * 0.12, 0], shadow: false });
        b.gable(1.05, 0.95, 0.35, shade(yellow, 1.08), { at: [0, 0.7, 0] }, { ends: yellow });
        for (const x of [-0.22, 0.22]) {
          win(b, [x, 0.38, 0.405], 0.14, 0.2, shade(yellow, 1.1));
          win(b, [x, 0.08, 0.405], 0.14, 0.13, shade('wood', 1.2));
        }
      });
    },
    { shadowGroup: true },
  );

  // ---- дом Цветаевой (Бродельщиковых): бревенчатый, на бутовом цоколе, бордовая крыша ----
  const logs = shade('wood', 0.78);
  const burgundy = mix('brickRed', 'oilBlack', 0.3);
  b.group(
    { at: [-3.25, G, 1.65], ry: 0.4 },
    () => {
      b.box(1.2, 0.14, 0.8, mix('stoneSand', 'stoneWhite', 0.2));
      b.box(1.12, 0.5, 0.74, logs, { at: [0, 0.14, 0] });
      for (let i = 0; i < 4; i++) b.box(1.14, 0.02, 0.76, shade(logs, 0.8), { at: [0, 0.22 + i * 0.11, 0], shadow: false });
      b.gable(1.3, 0.92, 0.42, burgundy, { at: [0, 0.64, 0] }, { ends: shade(logs, 1.1) });
      for (const x of [-0.38, 0.0, 0.38]) win(b, [x, 0.3, 0.375], 0.13, 0.2, mix('wood', 'gold', 0.4));
      b.box(0.12, 0.3, 0.12, burgundy, { at: [-0.35, 0.8, -0.1] });
    },
    { shadowGroup: true },
  );

  // ---- купеческие дома за улицей: каменный низ, цветной верх ----
  const merchant = (at: P3, ry: number, upper: Col, roof: Col) =>
    b.group(
      { at, ry },
      () => {
        b.box(1.3, 0.55, 0.9, white);
        b.box(1.3, 0.55, 0.9, upper, { at: [0, 0.55, 0] });
        b.box(1.36, 0.06, 0.96, white, { at: [0, 1.08, 0] });
        hipRoof(b, 1.42, 1.02, 0.35, roof, { at: [0, 1.14, 0] });
        for (let i = 0; i < 3; i++) {
          const x = -0.4 + i * 0.4;
          archOpening(b, [x, 0.12, 0.455], 0.16, 0.3, mix('roofDark', 'glass', 0.2));
          win(b, [x, 0.68, 0.455], 0.16, 0.28, white);
        }
      },
      { shadowGroup: true },
    );
  merchant([1.55, G, 0.3], -0.08, 'brickRed', 'roofDark');
  merchant([-3.55, G, 0.15], 0.25, mix('stoneSand', 'gold', 0.3), 'roofGreen');

  // ---- деревянные домики с палисадниками на окраине ----
  const cottage = (at: P3, ry: number, wall: Col, roof: Col) =>
    b.group(
      { at, ry },
      () => {
        b.box(0.85, 0.12, 0.62, mix('stoneSand', 'stoneWhite', 0.2));
        b.box(0.8, 0.38, 0.58, wall, { at: [0, 0.12, 0] });
        b.gable(0.95, 0.72, 0.32, roof, { at: [0, 0.5, 0] }, { ends: shade(wall, 1.08) });
        for (const x of [-0.2, 0.2]) win(b, [x, 0.22, 0.295], 0.12, 0.16, mix('stoneWhite', 'gold', 0.2));
      },
      { shadowGroup: true },
    );
  cottage([-1.85, G, 3.45], 0.15, shade('wood', 0.85), 'roofGreen');
  cottage([0.05, G, 3.85], -0.1, mix('roofBlue', 'glass', 0.5), 'brickRed');
  cottage([-3.6, G, -1.75], 0.6, mix('wood', 'gold', 0.3), 'roofDark');

  // ---- фонари, деревья, люди ----
  for (const x of [-2.4, -0.3, 1.6]) {
    b.box(0.03, 0.55, 0.03, 'oilBlack', { at: [x, G, 1.27], shadow: false });
    b.box(0.08, 0.08, 0.08, mix('gold', 'kamazWhite', 0.5), { at: [x, G + 0.55, 1.27], shadow: false });
  }
  roundTree(b, -4.0, -0.95, G, 0.8);
  roundTree(b, 0.4, 3.0, G, 0.55);
  roundTree(b, -2.75, 3.05, G, 0.65);
  roundTree(b, 0.3, 0.1, G, 0.6);
  roundTree(b, 2.75, -0.15, G, 0.55);
  roundTree(b, -4.15, 2.3, G, 0.6);
  roundTree(b, 2.85, 3.3, G, 0.55);
  tree(b, -0.1, -3.4, G, 0.7);
  tree(b, -0.75, -4.0, G, 0.55);
  tree(b, -2.8, -3.0, G, 0.6);
  tree(b, -1.05, 3.95, G, 0.5);
  for (const [x, z, c] of [
    [-1.7, 0.95, 'accent'],
    [-0.9, 0.85, 'roofBlue'],
    [0.95, 1.6, 'roofDark'],
    [0.95, 2.6, 'kamazBlue'],
    [-2.7, 1.0, 'roofGreen'],
    [2.1, 0.85, 'gold'],
  ] as [number, number, Col][]) {
    person(b, x, z, G + 0.014, c);
  }

  // ---- лодка на реке (покачивается) ----
  const anim = new Animated(G);
  const a = anim.b;
  const BT: P3 = [4.0, G + 0.05, -0.45];
  const tmp = new THREE.Matrix4();
  const tmpT = new THREE.Matrix4();
  anim.part(
    (t, m) => {
      m.makeTranslation(BT[0], BT[1] + Math.sin(t * 1.7) * 0.025, BT[2] + Math.sin(t * 0.3) * 0.25)
        .multiply(tmp.makeRotationZ(Math.sin(t * 1.3) * 0.06))
        .multiply(tmpT.makeTranslation(-BT[0], -BT[1], -BT[2]));
    },
    () =>
      a.group({ at: BT, ry: Math.PI / 2 + 0.25, shadow: false }, () => {
        const hull: P2[] = [
          [-0.42, -0.14],
          [0.3, -0.15],
          [0.5, 0],
          [0.3, 0.15],
          [-0.42, 0.14],
        ];
        a.extrude(hull, 0.13, 'kamazWhite', { at: [0, -0.04, 0] }, { top: shade('wood', 1.1) });
        a.extrude(
          hull.map(([x, z]) => [x * 1.02, z * 1.06] as P2),
          0.04,
          'roofBlue',
          { at: [0, 0.06, 0] },
          { top: shade('wood', 1.1) },
        );
        a.box(0.28, 0.14, 0.2, 'kamazWhite', { at: [-0.05, 0.09, 0] }, { top: 'roofBlue' });
        a.rect(0.2, 0.06, mix('glass', 'roofDark', 0.3), { at: [-0.05, 0.15, 0.101] });
        person(a, -0.3, 0, 0.09, 'accent');
      }),
  );

  const mini = assemble('elabuga', [b, a]);
  const mesh = mini.group.children[1] as THREE.Mesh;
  mini.update = anim.bind(mesh, 0.5);
  mini.update(0);
  return mini;
}

function steelish(): Col {
  return mix('steel', 'gold', 0.3);
}
