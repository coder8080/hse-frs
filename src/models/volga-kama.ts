// Слияние Волги и Камы: два русла сходятся, на стрелке полосатый маяк, по Волге идёт теплоход.
import { Builder, assemble, clipConvex, mix, plinth, ringXZ, shade, type Miniature, type P2 } from './kit';
import { roundTree, tree } from './archi';

export function buildVolgaKama(): Miniature {
  const b = new Builder();
  const G = plinth(b, 'lowland');
  const rim = ringXZ(4.66, 14);
  const W = G + 0.06; // вода поверх теней
  // Волга с севера на юг и Кама с востока
  const volga: P2[] = [
    [-2.7, -5],
    [-0.3, -5],
    [1.4, 5],
    [-2.3, 5],
  ];
  const kama: P2[] = [
    [5, -2.6],
    [5, -0.6],
    [0.6, 1.2],
    [-0.2, -0.6],
  ];
  b.flat(clipConvex(volga, rim), W, 'water');
  b.flat(clipConvex(kama, rim), W, 'water');
  // песчаная стрелка
  b.flat(
    [
      [0.3, -0.75],
      [1.5, -1.25],
      [1.3, -2.8],
      [0.15, -2.3],
    ],
    G + 0.012,
    'stoneSand',
  );

  // маяк на стрелке: красно-белые пояса, галерея, фонарь
  b.group(
    { at: [0.95, G, -2.1] },
    () => {
      b.cyl(0.6, 0.6, 0.25, 8, 'stoneWhite');
      const red = 'accent';
      const wh = 'kamazWhite';
      b.lathe(
        [
          [0.42, 0.25],
          [0.38, 0.95],
          [0.34, 1.65],
          [0.3, 2.35],
          [0.27, 3.0],
        ],
        8,
        wh,
        undefined,
        { bands: [red, wh, red, wh], capTop: false },
      );
      b.cyl(0.42, 0.42, 0.1, 8, 'roofDark', { at: [0, 3.0, 0] });
      b.cyl(0.22, 0.22, 0.45, 8, mix('gold', 'kamazWhite', 0.4), { at: [0, 3.1, 0] });
      b.cone(0.3, 0.45, 8, red, { at: [0, 3.55, 0] });
    },
    { shadowGroup: true },
  );

  // теплоход на Волге
  b.group({ at: [-0.75, W, 2.4], ry: -Math.PI / 2 + 0.17 }, () => {
    const hullDark = 'roofBlue';
    const wh = 'kamazWhite';
    b.profile(
      [
        [-1.9, 0],
        [1.55, 0],
        [2.15, 0.5],
        [-2.0, 0.5],
      ],
      1.0,
      hullDark,
      undefined,
      { caps: hullDark },
    );
    b.profile(
      [
        [-2.0, 0.5],
        [2.15, 0.5],
        [2.2, 0.62],
        [-2.0, 0.62],
      ],
      1.04,
      wh,
    );
    b.box(3.2, 0.42, 0.86, wh, { at: [-0.25, 0.62, 0] });
    b.box(2.5, 0.38, 0.76, wh, { at: [-0.4, 1.04, 0] });
    b.box(0.8, 0.3, 0.7, wh, { at: [0.4, 1.42, 0] });
    b.rect(0.7, 0.12, 'glass', { at: [0.4, 1.55, 0.36] });
    for (const [y, len, z, x] of [
      [0.76, 3.0, 0.44, -0.25],
      [1.16, 2.3, 0.39, -0.4],
    ]) {
      b.rect(len, 0.14, 'glass', { at: [x, y, z] });
      b.rect(len, 0.14, 'glass', { at: [x, y, -z], ry: Math.PI });
    }
    b.cyl(0.14, 0.14, 0.5, 6, 'accent', { at: [-0.9, 1.42, 0] }, { top: 'roofDark' });
  });

  // красный бакен на Каме
  b.cone(0.22, 0.5, 6, 'accent', { at: [2.8, W, -0.9] });

  // берега
  tree(b, -3.6, -1.0, G, 0.8);
  tree(b, -3.4, 0.4, G, 0.7);
  roundTree(b, 2.6, 2.4, G, 0.9);
  roundTree(b, 3.5, 1.3, G, 0.75);
  roundTree(b, 1.9, -3.6, G, 0.75);
  tree(b, 2.9, -3.0, G, 0.7);
  b.box(0.7, 0.45, 0.5, shade('stoneSand', 1), { at: [-3.4, G, 2.0], ry: 0.4 });
  b.gable(0.8, 0.6, 0.3, 'brickRed', { at: [-3.4, G + 0.45, 2.0], ry: 0.4 }, { ends: 'stoneSand' });

  return assemble('volga-kama', [b]);
}
