// Раифский монастырь: белые стены с башенками, краснокирпичный собор с зелёными главами,
// высокая колокольня, белая церковь; вокруг ёлки и озеро.
import { Builder, assemble, clipConvex, mix, plinth, ringXZ, shade, type Miniature, type P2 } from './kit';
import { dome, spire, tree, windows } from './archi';

export function buildRaifa(): Miniature {
  const b = new Builder();
  const G = plinth(b, 'lowland');
  const white = 'stoneWhite';
  const wtop = shade(white, 0.88);

  // озеро у западной стены (вода поверх запечённых теней)
  const lake: P2[] = [
    [-4.8, -1.2],
    [-2.9, -1.6],
    [-2.3, 0.2],
    [-2.6, 2.2],
    [-3.6, 3.4],
    [-4.8, 2.6],
  ];
  b.flat(clipConvex(lake, ringXZ(4.65, 14)), G + 0.06, 'water');

  // стены
  const x0 = -1.6;
  const x1 = 2.5;
  const z0 = -2.2;
  const z1 = 1.3;
  const corners: P2[] = [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
  for (let i = 0; i < 4; i++) b.wall(corners[i], corners[(i + 1) % 4], 0.2, 0.6, white, { at: [0, G, 0] }, { top: wtop });
  for (const [x, z] of corners) {
    b.group(
      { at: [x, G, z] },
      () => {
        b.cyl(0.26, 0.26, 0.85, 6, white);
        b.cone(0.3, 0.5, 6, 'roofGreen', { at: [0, 0.85, 0] });
      },
      { shadowGroup: true },
    );
  }
  // надвратная колокольня у южной стены: высокий белый ярусный столп со шпилем
  b.group(
    { at: [0.3, G, z1] },
    () => {
      b.box(0.9, 1.6, 0.9, white, undefined, { top: wtop });
      b.rect(0.4, 0.75, 'roofDark', { at: [0, 0, 0.46] });
      b.box(0.72, 1.1, 0.72, white, { at: [0, 1.6, 0] }, { top: wtop });
      b.rect(0.24, 0.45, 'roofDark', { at: [0, 2.0, 0.37] });
      b.box(0.55, 0.85, 0.55, white, { at: [0, 2.7, 0] }, { top: wtop });
      b.cyl(0.22, 0.22, 0.35, 8, white, { at: [0, 3.55, 0] });
      b.lathe(
        [
          [0.26, 3.9],
          [0.3, 4.05],
          [0.12, 4.3],
          [0, 4.4],
        ],
        8,
        'roofGreen',
      );
      spire(b, [0, 4.3, 0], 1.0, 0.07);
    },
    { shadowGroup: true },
  );

  // Грузинский собор: красный кирпич, белые наличники, пять зелёных глав
  b.group({ at: [1.2, G, -0.8] }, () => {
    const red = 'brickRed';
    b.box(1.7, 1.4, 1.5, red, undefined, { top: shade(red, 0.85) });
    b.cyl(0.55, 0.55, 1.05, 8, red, { at: [0.85, 0, 0] }, { top: 'roofGreen' });
    b.pyramid(1.7, 1.5, 0.3, 'roofGreen', { at: [0, 1.4, 0] });
    windows(b, [0, 0.55, 0.76], 3, 0.2, 0.45, 0.48, white);
    dome(b, [0, 1.55, 0], { r: 0.42, h: 0.8, color: 'roofGreen', drumR: 0.28, drumH: 0.55, tip: 0.35 });
    for (const [x, z] of [
      [-0.55, -0.45],
      [0.55, -0.45],
      [-0.55, 0.45],
      [0.55, 0.45],
    ] as P2[]) {
      dome(b, [x, 1.45, z], { r: 0.24, h: 0.45, color: 'roofGreen', drumR: 0.15, drumH: 0.3, seg: 6, tip: 0.2 });
    }
  });

  // белая Троицкая церковь с синей главой
  b.group({ at: [-0.6, G, -1.2], ry: 0.1 }, () => {
    b.box(1.1, 1.0, 0.9, white, undefined, { top: wtop });
    b.gable(1.2, 1.0, 0.35, 'roofBlue', { at: [0, 1.0, 0] }, { ends: white });
    windows(b, [0, 0.4, 0.46], 2, 0.16, 0.35, 0.45);
    dome(b, [0, 1.15, 0], { r: 0.3, h: 0.55, color: 'roofBlue', drumR: 0.2, drumH: 0.4, tip: 0.25 });
  });

  // лес вокруг (кроме берега озера)
  const pines: [number, number, number][] = [
    [-1.6, -3.4, 0.9],
    [-0.4, -3.6, 1.0],
    [0.8, -3.4, 0.85],
    [2.0, -3.4, 1.0],
    [3.1, -2.8, 0.95],
    [3.6, -1.4, 0.9],
    [3.7, 0.0, 1.05],
    [3.4, 1.4, 0.9],
    [2.6, 2.6, 1.0],
    [1.3, 3.2, 0.85],
    [-0.2, 3.5, 0.95],
    [-1.4, 2.6, 0.8],
    [-2.0, -2.6, 0.8],
    [2.9, -3.9, 0.7],
    [4.1, -0.7, 0.7],
    [0.4, 4.2, 0.7],
  ];
  for (const [x, z, s] of pines) tree(b, x, z, G, s, mix('forest', 'roofGreen', Math.abs((x * 7 + z * 3) % 3) / 6 + 0.1));

  return assemble('raifa', [b]);
}
