// Чистополь: огромные каминные часы (завод «Восток»), корпус завода с трубой,
// купеческий дом и Кама у края.
import { Builder, assemble, clipConvex, mix, plinth, ringXZ, shade, type Miniature, type P2 } from './kit';
import { roundTree, windows } from './archi';

function arch(r: number, seg: number, y0: number): P2[] {
  const pts: P2[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI;
    pts.push([Math.cos(a) * r, y0 + Math.sin(a) * r]);
  }
  return pts;
}

export function buildChistopol(): Miniature {
  const b = new Builder();
  const G = plinth(b, 'plain');
  // Кама вдоль южного края
  b.flat(
    clipConvex(
      [
        [-6, 3.0],
        [6, 2.4],
        [6, 6],
        [-6, 6],
      ],
      ringXZ(4.66, 14),
    ),
    G + 0.06,
    'water',
  );
  b.flat(
    clipConvex(
      [
        [-6, 2.55],
        [6, 1.95],
        [6, 2.5],
        [-6, 3.1],
      ],
      ringXZ(4.66, 14),
    ),
    G + 0.012,
    'stoneSand',
  );

  // корпус часового завода и труба
  b.group({ at: [0.2, G, -2.6], ry: 0.05 }, () => {
    b.box(4.6, 1.3, 1.3, 'brickRed', undefined, { top: 'roofDark' });
    windows(b, [0, 0.25, 0.66], 8, 0.26, 0.32, 0.52, 'stoneWhite');
    windows(b, [0, 0.75, 0.66], 8, 0.26, 0.32, 0.52, 'stoneWhite');
    b.box(1.0, 1.7, 1.35, 'brickRed', { at: [0, 0, 0] }, { top: 'roofDark' });
    b.gable(1.1, 1.45, 0.4, 'roofDark', { at: [0, 1.7, 0], ry: Math.PI / 2 }, { ends: 'brickRed' });
  });
  b.cyl(0.3, 0.2, 4.4, 8, 'brickRed', { at: [-2.4, G, -2.9] }, { top: 'roofDark' });

  // каминные часы: деревянный корпус с аркой, циферблат, маятник, золотые ножки
  const wood = 'wood';
  const woodD = shade('wood', 0.8);
  b.group({ at: [-0.5, G, 0.1], ry: 0.25 }, () => {
    for (const [x, z] of [
      [-0.85, -0.4],
      [0.85, -0.4],
      [-0.85, 0.4],
      [0.85, 0.4],
    ] as P2[]) {
      b.cyl(0.14, 0.1, 0.2, 6, 'gold', { at: [x, 0, z] });
    }
    b.box(2.3, 0.3, 1.2, woodD, { at: [0, 0.2, 0] });
    b.box(2.0, 2.0, 1.0, wood, { at: [0, 0.5, 0] }, { top: woodD });
    b.profile(arch(1.0, 8, 0), 1.0, wood, { at: [0, 2.5, 0] }, { caps: wood });
    b.box(2.2, 0.12, 1.15, woodD, { at: [0, 2.45, 0] });
    b.cone(0.16, 0.4, 6, 'gold', { at: [0, 3.48, 0] });
    // циферблат
    const fz = 0.505;
    const cy = 2.35;
    b.disc(0.92, 16, 'gold', { at: [0, cy, fz] });
    b.disc(0.8, 16, 'kamazWhite', { at: [0, cy, fz + 0.01] });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const big = i % 3 === 0;
      b.rect(big ? 0.08 : 0.05, big ? 0.16 : 0.1, 'roofDark', { at: [Math.sin(a) * 0.62, cy + Math.cos(a) * 0.62 - 0.06, fz + 0.02], rz: -a });
    }
    b.rect(0.08, 0.42, 'oilBlack', { at: [0, cy, fz + 0.025], rz: -2.0 });
    b.rect(0.06, 0.62, 'oilBlack', { at: [0, cy, fz + 0.03], rz: 0.2 });
    b.disc(0.07, 6, 'gold', { at: [0, cy, fz + 0.035] });
    // окошко маятника
    b.rect(0.75, 0.85, mix('glass', 'roofDark', 0.3), { at: [0, 0.6, fz] });
    b.rect(0.04, 0.55, 'gold', { at: [0, 0.85, fz + 0.01], rz: Math.PI });
    b.disc(0.15, 8, 'gold', { at: [0, 0.75, fz + 0.012] });
  });

  // купеческий дом: каменный низ, деревянный верх, зелёная крыша
  b.group({ at: [2.5, G, 0.5], ry: -0.35 }, () => {
    b.box(1.7, 0.75, 1.2, 'stoneWhite');
    b.box(1.7, 0.7, 1.2, mix('stoneSand', 'gold', 0.25), { at: [0, 0.75, 0] });
    windows(b, [0, 0.2, 0.61], 3, 0.24, 0.35, 0.5, 'roofDark');
    windows(b, [0, 0.9, 0.61], 3, 0.24, 0.38, 0.5, 'stoneWhite');
    b.pyramid(1.9, 1.4, 0.55, 'roofGreen', { at: [0, 1.45, 0] });
  });

  roundTree(b, 2.8, -1.3, G, 0.85);
  roundTree(b, -3.3, -0.4, G, 0.9);
  roundTree(b, -3.0, 1.2, G, 0.7);
  roundTree(b, 1.0, 1.6, G, 0.6);

  return assemble('chistopol', [b]);
}
