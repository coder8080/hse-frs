// Иннополис: главный корпус университета — длинный клин с медными ламелями, крыша
// поднимается к консоли над входом и парадной лестницей; эллиптический технопарк
// им. А. С. Попова из стекла и дерева, «трапециевидные» жилые дома, сквер с соснами,
// берег Свияги. По кольцу вокруг сквера ездит беспилотное такси.
import * as THREE from 'three';
import { Builder, SUN, assemble, groundShadow, mix, plinth, ringXZ, shade, type Col, type Miniature, type P2, type P3 } from './kit';
import { roundTree, tree } from './archi';

const WHITE: Col = 'kamazWhite';
const GLASS = mix('glass', 'roofBlue', 0.3);
const GLASS_D = mix('glass', 'roofDark', 0.45);
const COPPER = mix('wood', 'gold', 0.35);
const WOOD = mix('wood', 'stoneSand', 0.15);
const STONE = shade('stoneWhite', 0.9);
const ASPHALT = mix('roofDark', 'steel', 0.3);

// кольцевая дорога вокруг сквера (эллипс)
const LOOP_C: P2 = [-0.05, 0.75];
const LOOP_A = 1.5;
const LOOP_B = 0.98;
const LOOP_W = 0.36;

/** Брус между двумя точками в плоскости (x, y) при фиксированном z. */
function barXY(b: Builder, x0: number, y0: number, x1: number, y1: number, z: number, t: number, d: number, color: Col): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  b.box(t, len, d, color, { at: [x0, y0, z], rz: -Math.atan2(x1 - x0, y1 - y0) });
}

/** Главный корпус Университета Иннополис (в локальных координатах, фасад в +Z). */
function university(b: Builder): void {
  const D = 1.45;
  const xw = -2.75; // западный торец
  const xr = 1.05; // начало консоли
  const xp = 2.5; // низ носа консоли
  const xt = 2.72; // верх носа
  const yW = 1.15; // высота крыши на западе
  const yT = 2.45; // высота носа
  const yR = 0.72; // низ консоли у входа
  const yP = 1.05; // низ носа
  const roofY = (x: number) => yW + ((x - xw) / (xt - xw)) * (yT - yW);
  const botY = (x: number) => (x <= xr ? 0 : yR + ((x - xr) / (xp - xr)) * (yP - yR));
  // подиум и парадная лестница
  b.box(xt - xw + 0.5, 0.2, D + 0.7, STONE, { at: [(xw + xt) / 2 + 0.1, 0, 0.2] });
  for (let i = 0; i < 4; i++) b.box(2.2, 0.05 * (i + 1), 0.13, shade(STONE, 1.05), { at: [1.6, 0, 1.08 - i * 0.13 + 0.55] });
  b.group({ at: [0, 0.2, 0] }, () => {
    const pts: P2[] = [
      [xw, 0],
      [xr, 0],
      [xr, yR],
      [xp, yP],
      [xt, yT],
      [xw, yW],
    ];
    b.profile(pts, D, GLASS, undefined, {
      caps: GLASS,
      faces: [shade('roofDark', 0.8), GLASS_D, COPPER, GLASS, shade('steel', 1.05), COPPER],
    });
    // медные ламели на фасадах (спереди часто, сзади реже)
    for (const [side, step] of [
      [1, 0.13],
      [-1, 0.26],
    ] as const) {
      for (let x = xw + 0.08; x < xt - 0.05; x += step) {
        const y0 = botY(x);
        const y1 = roofY(x) - 0.02;
        if (y1 - y0 < 0.1) continue;
        b.box(0.045, y1 - y0, 0.1, COPPER, { at: [x, y0, side * (D / 2 + 0.05)], shadow: false });
      }
      // медная окантовка: карниз по крыше и кромка консоли
      barXY(b, xw, yW - 0.08, xt, yT - 0.08, side * (D / 2 + 0.06), 0.14, 0.14, COPPER);
      barXY(b, xr, yR, xp, yP, side * (D / 2 + 0.06), 0.1, 0.14, COPPER);
      // стекло входа под консолью
      b.rect(xp - xr - 0.15, yR - 0.05, GLASS_D, { at: [(xr + xp) / 2, 0.02, side * (D / 2 - 0.25)], ry: side > 0 ? 0 : Math.PI });
    }
    // окантовка носа
    barXY(b, xp, yP, xt, yT, D / 2 + 0.06, 0.12, 0.14, COPPER);
    barXY(b, xp, yP, xt, yT, -D / 2 - 0.06, 0.12, 0.14, COPPER);
    // световые фонари на крыше
    for (const z of [-0.42, 0, 0.42]) barXY(b, xw + 0.35, roofY(xw + 0.35), xt - 0.45, roofY(xt - 0.45), z, 0.05, 0.16, GLASS_D);
    // колонны-опоры под консолью
    b.box(0.08, yP, 0.08, STONE, { at: [xp - 0.25, 0, D / 2 - 0.2] });
    b.box(0.08, yP, 0.08, STONE, { at: [xp - 0.25, 0, -D / 2 + 0.2] });
  });
  // флагштоки у лестницы
  for (let i = 0; i < 5; i++) b.cyl(0.02, 0.015, 1.45 + i * 0.05, 4, WHITE, { at: [2.95 + i * 0.1, 0.2, 0.55 - i * 0.2] });
}

/** Технопарк им. Попова: эллиптическое кольцо этажей с деревянными вставками. */
function technopark(b: Builder, at: P3, sx: number, sz: number): void {
  const floors = 7;
  const fh = 0.29;
  const r = 1;
  const prof: P2[] = [];
  const bands: Col[] = [];
  const slab = mix('roofDark', 'steel', 0.25);
  for (let f = 0; f < floors; f++) {
    const y = f * fh;
    prof.push([r + 0.05, y], [r + 0.05, y + 0.05], [r, y + 0.05]);
    bands.push(slab, slab, GLASS);
  }
  prof.push([r, floors * fh], [r + 0.05, floors * fh], [r + 0.05, floors * fh + 0.06]);
  bands.push(slab, slab);
  b.group(
    { at, s: [sx, 1, sz] },
    () => {
      b.lathe(prof, 18, GLASS, undefined, { bands, capTop: shade('steel', 0.85) });
      b.box(0.7, 0.28, 0.5, shade('roofDark', 0.9), { at: [-0.25, floors * fh + 0.06, -0.2] });
      b.box(0.45, 0.2, 0.35, shade('roofDark', 0.9), { at: [0.45, floors * fh + 0.06, 0.25] });
    },
    { shadowGroup: true },
  );
  // деревянные вертикальные вставки по контуру эллипса
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.1;
    const rr = r + 0.015;
    const x = at[0] + Math.sin(a) * rr * sx;
    const z = at[2] + Math.cos(a) * rr * sz;
    const nx = Math.sin(a) / sx;
    const nz = Math.cos(a) / sz;
    b.rect(i % 3 === 0 ? 0.32 : 0.16, floors * fh, WOOD, { at: [x, at[1] + 0.05, z], ry: Math.atan2(nx, nz) });
  }
}

/** Жилой дом-«трапеция»: белые торцы, наклонные стены в деревянной облицовке. */
function aframe(b: Builder, at: P3, ry: number, len: number): void {
  const wb = 0.56;
  const wt = 0.3;
  const h = 1.5;
  const tilt = Math.atan2(wb - wt, h);
  b.group({ at, ry }, () => {
    b.profile(
      [
        [-wb, 0],
        [wb, 0],
        [wt, h],
        [-wt, h],
      ],
      len,
      WHITE,
      undefined,
      { caps: WHITE, faces: [WHITE, WOOD, shade('roofDark', 1.05), WOOD] },
    );
    // окна на скатах
    const sl = Math.hypot(wb - wt, h);
    for (const s of [-1, 1]) {
      for (let f = 0; f < 4; f++) {
        const t = (0.12 + f * 0.22) * sl;
        const x = s * (wb - (wb - wt) * (t / sl) + 0.012);
        const y = (t / sl) * h;
        for (let k = 0; k < 4; k++) {
          const z = (k - 1.5) * (len / 4.4);
          b.rect(0.16, 0.18, GLASS_D, { at: [x, y, z], ry: s * (Math.PI / 2), rx: -tilt });
        }
      }
    }
    // окна и вход на торцах
    for (const s of [-1, 1]) {
      for (let f = 0; f < 4; f++) {
        const w = 0.14;
        b.rect(w, 0.15, GLASS_D, { at: [0, 0.22 + f * 0.32, s * (len / 2 + 0.012)], ry: s > 0 ? 0 : Math.PI });
      }
    }
    b.box(0.34, 0.04, 0.16, WHITE, { at: [0, 0.3, len / 2 + 0.08] });
    // надстройки на крыше
    b.box(0.32, 0.22, 0.42, WOOD, { at: [0, h, -len * 0.2] });
    b.box(0.2, 0.12, 0.2, shade('steel', 0.85), { at: [0, h, len * 0.25] });
  });
}

/** Беспилотное такси: белый седан с жёлтой полосой и лидаром на крыше; перёд в +X. */
function robotaxi(b: Builder, y: number): void {
  const yellow = mix('gold', 'accent', 0.15);
  b.group({ at: [0, y, 0] }, () => {
    for (const x of [0.13, -0.13]) {
      for (const s of [-1, 1]) b.cyl(0.045, 0.045, 0.04, 6, 'oilBlack', { at: [x, 0.045, s > 0 ? 0.075 : -0.115], rx: Math.PI / 2 }, { bottom: true });
    }
    b.profile(
      [
        [-0.23, 0.035],
        [0.23, 0.035],
        [0.235, 0.1],
        [0.12, 0.115],
        [0.06, 0.18],
        [-0.12, 0.18],
        [-0.2, 0.12],
        [-0.235, 0.11],
      ],
      0.18,
      WHITE,
      undefined,
      { faces: ['oilBlack', WHITE, WHITE, GLASS_D, WHITE, GLASS_D, WHITE, WHITE] },
    );
    for (const s of [-1, 1]) {
      b.rect(0.44, 0.025, yellow, { at: [0, 0.07, s * 0.092], ry: s > 0 ? 0 : Math.PI });
      b.rect(0.15, 0.05, GLASS_D, { at: [-0.03, 0.12, s * 0.092], ry: s > 0 ? 0 : Math.PI });
    }
    b.cyl(0.035, 0.035, 0.04, 6, shade('oilBlack', 1.3), { at: [-0.03, 0.18, 0] });
    b.box(0.08, 0.015, 0.14, shade('oilBlack', 1.3), { at: [-0.03, 0.18, 0] });
  });
}

export function buildInnopolis(): Miniature {
  const b = new Builder();
  const G = plinth(b, 'plain', { seg: 20 });

  // берег Свияги на юго-западе: песчаная кромка и вода
  {
    const shore: P2[] = [
      [-0.75, 4.55],
      [-1.5, 3.75],
      [-2.5, 3.05],
      [-3.55, 2.35],
      [-4.55, 1.35],
    ];
    const arc = (r: number): P2[] => {
      const a0 = Math.atan2(1.35, -4.55);
      const a1 = Math.atan2(4.55, -0.75);
      const pts: P2[] = [];
      for (let i = 0; i <= 8; i++) {
        const a = a0 + ((a1 - a0) * i) / 8;
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      return pts;
    };
    const bank = shore.map(([x, z]) => [x * 0.93 + 0.0, z * 0.93] as P2);
    b.flat([...bank, ...arc(4.62)], G + 0.008, shade('stoneSand', 1.02));
    b.flat([...shore, ...arc(4.62)], G + 0.014, 'river');
    for (const [x, z, l] of [
      [-2.7, 3.55, 0.5],
      [-1.55, 4.15, 0.35],
      [-3.75, 2.75, 0.3],
    ] as P3[]) b.flat(
      [
        [x - l, z - 0.02 + l * 0.6],
        [x + l, z - 0.02 - l * 0.6],
        [x + l, z + 0.02 - l * 0.6],
        [x - l, z + 0.02 + l * 0.6],
      ],
      G + 0.018,
      shade('river', 1.15),
    );
  }

  // кольцевая дорога, сквер в центре кольца, проезды
  const ell = (a: number, bb: number, n = 24): P2[] => {
    const pts: P2[] = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      pts.push([LOOP_C[0] + Math.cos(t) * a, LOOP_C[1] + Math.sin(t) * bb]);
    }
    return pts;
  };
  {
    const o = ell(LOOP_A + LOOP_W / 2, LOOP_B + LOOP_W / 2);
    const i = ell(LOOP_A - LOOP_W / 2, LOOP_B - LOOP_W / 2);
    for (let k = 0; k < o.length; k++) {
      const k2 = (k + 1) % o.length;
      b.flat([i[k], o[k], o[k2], i[k2]], G + 0.012, ASPHALT);
    }
    // прерывистая осевая
    const m = ell(LOOP_A, LOOP_B, 36);
    for (let k = 0; k < m.length; k += 2) {
      const [x0, z0] = m[k];
      const [x1, z1] = m[(k + 1) % m.length];
      const nx = -(z1 - z0);
      const nz = x1 - x0;
      const l = Math.hypot(nx, nz) / 0.025;
      b.flat(
        [
          [x0 - nx / l, z0 - nz / l],
          [x1 - nx / l, z1 - nz / l],
          [x1 + nx / l, z1 + nz / l],
          [x0 + nx / l, z0 + nz / l],
        ],
        G + 0.018,
        WHITE,
      );
    }
    b.flat(ell(LOOP_A - LOOP_W / 2 - 0.08, LOOP_B - LOOP_W / 2 - 0.08, 20), G + 0.012, mix('stoneSand', 'stoneWhite', 0.4));
    b.flat(ell(0.62, 0.3, 14), G + 0.016, shade('plain', 0.97));
  }
  // дорожка к реке, причал и лодка
  b.flat(
    [
      [-0.6, 1.95],
      [-0.4, 1.95],
      [-1.2, 3.55],
      [-1.45, 3.45],
    ],
    G + 0.011,
    mix('stoneSand', 'stoneWhite', 0.4),
  );
  b.box(0.7, 0.05, 0.2, 'wood', { at: [-1.55, G, 3.75], ry: 0.9 });
  b.group({ at: [-2.1, G + 0.014, 3.75], ry: 0.7 }, () => {
    b.profile(
      [
        [-0.25, 0],
        [0.2, 0],
        [0.32, 0.08],
        [-0.27, 0.08],
      ],
      0.14,
      WHITE,
      undefined,
      { caps: WHITE },
    );
    b.box(0.14, 0.07, 0.1, GLASS_D, { at: [-0.04, 0.08, 0] });
  });

  // проезд к технопарку и аллея к университету
  b.flat(
    [
      [1.35, 0.55],
      [2.05, 0.6],
      [2.05, 0.92],
      [1.35, 0.95],
    ],
    G + 0.011,
    ASPHALT,
  );
  b.flat(
    [
      [-0.3, -0.5],
      [0.2, -0.5],
      [0.2, -1.15],
      [-0.3, -1.15],
    ],
    G + 0.011,
    mix('stoneSand', 'stoneWhite', 0.4),
  );

  // университет
  b.group({ at: [0.05, G, -2.25], ry: 0.04 }, () => university(b), { shadowGroup: false });

  // технопарк им. Попова
  technopark(b, [2.85, G, 1.3], 1.05, 0.82);

  // жилые дома-«трапеции»
  aframe(b, [-3.4, G, -0.2], 0.1, 1.9);
  aframe(b, [-2.3, G, 0.2], 0.1, 1.4);

  // сквер: скамейки с названиями языков (цветные), сосны и деревья, фонари, люди
  const benchCols: Col[] = ['accent', 'roofBlue', 'gold', 'roofGreen', 'brickRed'];
  benchCols.forEach((c, i) => {
    const t = -0.6 + i * 0.3;
    const x = LOOP_C[0] + Math.cos(t + Math.PI / 2) * 0.85;
    const z = LOOP_C[1] + Math.sin(t + Math.PI / 2) * 0.48;
    b.box(0.22, 0.06, 0.08, c, { at: [x, G, z], ry: -t });
  });
  for (const [x, z, s] of [
    [-0.6, 0.4, 0.3],
    [0.5, 0.38, 0.28],
    [-0.98, 0.78, 0.26],
    [0.88, 0.8, 0.3],
    [-0.05, 0.22, 0.25],
  ] as P3[]) tree(b, x, z, G, s);
  for (const [x, z, s] of [
    [-2.85, 1.55, 0.42],
    [-1.25, 2.5, 0.4],
    [0.25, 2.55, 0.38],
    [1.25, 2.3, 0.42],
    [3.4, -0.55, 0.42],
    [-3.6, 1.5, 0.36],
    [-0.6, -0.85, 0.32],
    [0.38, -0.85, 0.3],
  ] as P3[]) tree(b, x, z, G, s);
  roundTree(b, 1.95, 2.9, G, 0.45);
  roundTree(b, -1.1, 3.25, G, 0.4);
  roundTree(b, 3.6, 0.15, G, 0.35);
  for (const [x, z] of [
    [-1.45, -0.35],
    [1.6, 1.3],
    [-0.05, 1.95],
    [-0.05, -0.45],
  ] as P2[]) {
    b.cyl(0.02, 0.02, 0.7, 4, 'steel', { at: [x, G, z] });
    b.box(0.08, 0.03, 0.08, mix('kamazWhite', 'gold', 0.3), { at: [x, G + 0.7, z] });
  }
  const shirts: Col[] = ['accent', 'roofBlue', 'gold', WHITE, 'roofGreen', 'brickRed'];
  ([
    [0.25, 0.55],
    [0.32, 0.62],
    [-0.45, 0.9],
    [1.0, -0.9],
    [1.12, -0.95],
    [-0.15, -0.8],
  ] as P2[]).forEach(([x, z], i) => {
    b.box(0.06, 0.12, 0.06, shirts[i], { at: [x, G, z] });
    b.box(0.045, 0.045, 0.045, mix('stoneSand', 'accent', 0.2), { at: [x, G + 0.12, z] });
  });

  // беспилотное такси — отдельный меш, ездит по кольцу
  const car = new Builder(G);
  car.flat(ringXZ(0.25, 6).map(([x, z]) => [x * 1.05, z * 0.6] as P2), G + 0.021, shade(groundShadow(ASPHALT), 1 / 1.04));
  robotaxi(car, G + 0.012);

  const mini = assemble('innopolis', [b, car]);
  const mover = mini.group.children[1] as THREE.Mesh;
  const relight = relightOnSpin(mover);
  mini.update = (t: number) => {
    const a = -t * 0.45;
    const x = LOOP_C[0] + Math.cos(a) * LOOP_A;
    const z = LOOP_C[1] + Math.sin(a) * LOOP_B;
    // касательная к эллипсу при убывающем параметре
    const dx = Math.sin(a) * LOOP_A;
    const dz = -Math.cos(a) * LOOP_B;
    const ry = Math.atan2(-dz, dx);
    // правостороннее движение: смещение к правой обочине
    const l = Math.hypot(dx, dz);
    mover.position.set(x - (dz / l) * 0.09, 0, z + (dx / l) * 0.09);
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
