// Елабуга: Спасский собор с высокой колокольней, купеческие дома
// и башня Чёртова городища на холме.
import { Builder, assemble, mix, plinth, shade, type Col, type Miniature, type P2, type P3 } from './kit';
import { dome, roundTree, spire, tree, windows } from './archi';

function merchant(b: Builder, at: P3, ry: number, upper: Col, roof: Col): void {
  b.group({ at, ry }, () => {
    b.box(1.3, 0.6, 1.0, 'stoneWhite');
    b.box(1.3, 0.6, 1.0, upper, { at: [0, 0.6, 0] });
    windows(b, [0, 0.15, 0.51], 3, 0.2, 0.28, 0.4, 'roofDark');
    windows(b, [0, 0.75, 0.51], 3, 0.2, 0.3, 0.4, 'stoneWhite');
    b.pyramid(1.45, 1.15, 0.45, roof, { at: [0, 1.2, 0] });
  });
}

export function buildElabuga(): Miniature {
  const b = new Builder();
  const G = plinth(b, 'plain');
  const white = 'stoneWhite';
  const wtop = shade(white, 0.88);

  // холм Чёртова городища и белокаменная башня
  const hx = 2.0;
  const hz = -2.0;
  const hillH = 1.5;
  b.lathe(
    [
      [1.75, 0],
      [1.45, 0.65],
      [1.0, 1.3],
      [0.78, hillH],
    ],
    10,
    'lowland',
    { at: [hx, G, hz], ao: false },
    { bands: [shade('lowland', 0.82), shade('lowland', 0.88), shade('lowland', 0.95)], capTop: 'lowland' },
  );
  b.group(
    { at: [hx, G + hillH, hz], ao: G + hillH },
    () => {
      b.cyl(0.48, 0.44, 1.7, 8, white, undefined, { top: false });
      b.cyl(0.56, 0.56, 0.12, 8, shade(white, 0.9), { at: [0, 1.7, 0] });
      b.cone(0.6, 0.95, 8, 'roofDark', { at: [0, 1.82, 0] });
      spire(b, [0, 2.7, 0], 0.25, 0.04);
      b.rect(0.22, 0.4, 'roofDark', { at: [0, 0.9, 0.47] });
    },
    { shadowGroup: true },
  );
  tree(b, hx - 1.6, hz + 0.9, G, 0.65);
  tree(b, hx + 1.6, hz + 0.4, G, 0.6);

  // Спасский собор
  b.group({ at: [-1.2, G, -1.5], ry: 0.15 }, () => {
    b.box(1.9, 1.5, 1.6, white, undefined, { top: wtop });
    b.cyl(0.6, 0.6, 1.1, 8, white, { at: [0.95, 0, 0] }, { top: 'roofGreen' });
    b.pyramid(1.9, 1.6, 0.35, 'roofGreen', { at: [0, 1.5, 0] });
    windows(b, [0, 0.6, 0.81], 3, 0.18, 0.45, 0.5);
    dome(b, [0, 1.7, 0], { r: 0.55, h: 0.95, color: 'roofGreen', drumR: 0.38, drumH: 0.65, tip: 0.4 });
    for (const [x, z] of [
      [-0.6, -0.5],
      [0.6, -0.5],
      [-0.6, 0.5],
      [0.6, 0.5],
    ] as P2[]) {
      dome(b, [x, 1.6, z], { r: 0.22, h: 0.4, color: 'roofGreen', drumR: 0.14, drumH: 0.28, seg: 6, tip: 0.15 });
    }
  });
  // колокольня собора: высокая, ярусная, с золотым шпилем
  b.group(
    { at: [-1.6, G, 0.6], ry: 0.15 },
    () => {
      b.box(1.1, 1.7, 1.1, white, undefined, { top: wtop });
      b.rect(0.45, 0.8, 'roofDark', { at: [0, 0, 0.56] });
      b.box(0.9, 1.3, 0.9, white, { at: [0, 1.7, 0] }, { top: wtop });
      b.rect(0.3, 0.6, 'roofDark', { at: [0, 2.1, 0.46] });
      b.box(0.7, 1.0, 0.7, white, { at: [0, 3.0, 0] }, { top: wtop });
      b.rect(0.24, 0.5, 'roofDark', { at: [0, 3.3, 0.36] });
      b.cyl(0.3, 0.3, 0.5, 8, white, { at: [0, 4.0, 0] }, { phase: Math.PI / 8 });
      b.lathe(
        [
          [0.34, 4.5],
          [0.36, 4.7],
          [0.15, 4.95],
          [0.08, 5.05],
        ],
        8,
        'gold',
      );
      spire(b, [0, 5.0, 0], 1.6, 0.08);
    },
    { shadowGroup: true },
  );

  // купеческая улица
  b.flat(
    [
      [-4.2, 2.0],
      [3.8, 1.2],
      [3.95, 1.9],
      [-3.9, 2.75],
    ],
    G + 0.012,
    'stoneSand',
  );
  merchant(b, [-0.1, G, 0.8], -0.1, 'brickRed', 'roofDark');
  merchant(b, [1.5, G, 0.6], -0.1, mix('stoneSand', 'gold', 0.3), 'roofGreen');
  merchant(b, [3.0, G, 0.45], -0.1, mix('roofBlue', 'glass', 0.5), 'roofDark');
  merchant(b, [0.6, G, 3.5], Math.PI - 0.1, 'stoneSand', 'roofGreen');
  merchant(b, [-1.6, G, 3.6], Math.PI - 0.1, mix('roofGreen', 'stoneSand', 0.4), 'brickRed');

  roundTree(b, -3.4, -0.2, G, 0.8);
  roundTree(b, -3.2, 1.0, G, 0.65);
  roundTree(b, 2.4, 3.2, G, 0.7);
  roundTree(b, 0.5, -0.6, G, 0.6);

  return assemble('elabuga', [b]);
}
