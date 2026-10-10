// Альметьевск: три станка-качалки (балансиры анимированы в update) и нефтяной резервуар.
import * as THREE from 'three';
import { Builder, assemble, mix, plinth, shade, type Miniature, type P2 } from './kit';
import { roundTree } from './archi';

const PIVOT_Y = 2.1;

interface Jack {
  x: number;
  z: number;
  ry: number;
  phase: number;
}

const JACKS: Jack[] = [
  { x: -1.9, z: -1.7, ry: 0.25, phase: 0 },
  { x: 1.2, z: -2.2, ry: 0.15, phase: 2.1 },
  { x: -0.9, z: 1.5, ry: 0.35, phase: 4.0 },
];

/** Неподвижная часть станка: рама, стойка, редуктор с кривошипами, устье скважины. */
function jackFrame(b: Builder, j: Jack, G: number): void {
  const dark = mix('oilBlack', 'steel', 0.3);
  const legL = Math.hypot(0.6, PIVOT_Y - 0.15);
  const tilt = Math.atan2(0.6, PIVOT_Y - 0.15);
  b.group({ at: [j.x, G, j.z], ry: j.ry }, () => {
    b.flat(
      [
        [-2.0, -0.7],
        [1.8, -0.7],
        [1.8, 0.7],
        [-2.0, 0.7],
      ],
      0.012,
      shade('stoneSand', 0.85),
    );
    b.box(3.4, 0.16, 0.7, dark, { at: [-0.2, 0, 0] });
    b.group({}, () => {
      for (const z of [-0.22, 0.22]) {
        b.box(0.12, legL, 0.12, 'steel', { at: [-0.6, 0.15, z], rz: -tilt });
        b.box(0.12, legL, 0.12, 'steel', { at: [0.6, 0.15, z], rz: tilt });
      }
    }, { shadowGroup: true });
    // редуктор, кривошипы, двигатель
    b.box(0.6, 0.7, 0.5, dark, { at: [-1.25, 0.16, 0] });
    for (const z of [0.26, -0.38]) b.cyl(0.42, 0.42, 0.12, 8, 'accent', { at: [-1.25, 0.75, z], rx: Math.PI / 2 }, { bottom: true });
    b.box(0.45, 0.4, 0.4, 'roofBlue', { at: [-1.75, 0.16, 0] });
    // устье скважины
    b.cyl(0.14, 0.14, 0.45, 6, 'steel', { at: [1.38, 0, 0] });
    b.box(0.35, 0.12, 0.2, dark, { at: [1.38, 0.3, 0] });
    b.box(0.04, 0.95, 0.04, 'steel', { at: [1.38, 0.45, 0], shadow: false });
  });
}

/** Балансир с «головкой» и шатунами — вращается вокруг оси на вершине стойки. */
function jackBeam(b: Builder, j: Jack, G: number): void {
  const beam = 'roofDark';
  b.group({ at: [j.x, G + PIVOT_Y, j.z], ry: j.ry, ao: G }, () => {
    b.box(2.6, 0.22, 0.22, beam, { at: [-0.1, -0.11, 0] });
    b.profile(
      [
        [1.12, -0.62],
        [1.34, -0.48],
        [1.48, -0.1],
        [1.42, 0.22],
        [1.12, 0.3],
      ],
      0.34,
      'accent',
      undefined,
      { caps: 'accent' },
    );
    b.box(0.28, 0.28, 0.5, shade('roofDark', 1.2), { at: [0, -0.14, 0] });
    // траверса и шатуны к кривошипам
    b.box(0.2, 0.18, 0.9, beam, { at: [-1.35, -0.15, 0] });
    for (const z of [-0.36, 0.36]) b.box(0.08, 1.15, 0.08, 'steel', { at: [-1.3, -1.3, z] });
  });
}

export function buildAlmetyevsk(): Miniature {
  const b = new Builder();
  const G = plinth(b, 'plain');
  for (const j of JACKS) jackFrame(b, j, G);

  // резервуар и трубопровод
  b.cyl(1.05, 1.05, 1.5, 12, 'kamazWhite', { at: [2.6, G, 1.2] }, { top: 'steel' });
  b.cone(1.05, 0.3, 12, 'steel', { at: [2.6, G + 1.5, 1.2] });
  b.cyl(1.06, 1.06, 0.2, 12, 'oilBlack', { at: [2.6, G + 0.25, 1.2], shadow: false });
  b.cyl(0.65, 0.65, 0.9, 10, 'kamazWhite', { at: [3.2, G, -0.8] }, { top: 'steel' });
  const pipe: P2[] = [
    [-1.9 + 1.38, -1.4],
    [2.6, -0.2],
    [2.6, 1.2],
  ];
  for (let i = 0; i < pipe.length - 1; i++) b.wall(pipe[i], pipe[i + 1], 0.1, 0.1, 'steel', { at: [0, G, 0], shadow: false });
  b.wall([-0.9 + 1.38, 1.9], [2.0, 1.4], 0.1, 0.1, 'steel', { at: [0, G, 0], shadow: false });

  roundTree(b, -3.4, 0.1, G, 0.8);
  roundTree(b, 0.9, 3.4, G, 0.75);
  roundTree(b, -2.6, 2.9, G, 0.6);
  roundTree(b, 3.4, -2.4, G, 0.6);

  // балансиры — отдельный меш, анимируется на CPU (три оси вращения в одном меше)
  const beams = new Builder(G);
  const ranges: [number, number][] = [];
  for (const j of JACKS) {
    const start = beams.triangles;
    jackBeam(beams, j, G);
    ranges.push([start * 3, beams.triangles * 3]);
  }

  const mini = assemble('almetyevsk', [b, beams]);
  const mesh = mini.group.children[1] as THREE.Mesh;
  const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  const rest = Float32Array.from(pos.array as Float32Array);
  const sphere = mesh.geometry.boundingSphere!;
  sphere.radius += 1; // запас на качание
  const m = new THREE.Matrix4();
  const r = new THREE.Matrix4();
  const axis = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const out = pos.array as Float32Array;

  mini.update = (t: number) => {
    JACKS.forEach((j, k) => {
      const a = 0.3 * Math.sin(t * 1.7 + j.phase);
      axis.set(Math.sin(j.ry), 0, Math.cos(j.ry));
      m.makeTranslation(j.x, G + PIVOT_Y, j.z)
        .multiply(r.makeRotationAxis(axis, a))
        .multiply(new THREE.Matrix4().makeTranslation(-j.x, -(G + PIVOT_Y), -j.z));
      const [s, e] = ranges[k];
      for (let i = s; i < e; i++) {
        tmp.fromArray(rest, i * 3).applyMatrix4(m);
        out[i * 3] = tmp.x;
        out[i * 3 + 1] = tmp.y;
        out[i * 3 + 2] = tmp.z;
      }
    });
    pos.needsUpdate = true;
  };
  mini.update(0);
  return mini;
}
