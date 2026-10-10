// Свияжск: остров-холм в воде, белый Успенский собор с зелёной главой и шатровая колокольня.
import { Builder, assemble, groundShadow, mix, plinth, ringXZ, shade, type Miniature, type P2 } from './kit';
import { HELMET, dome, roundTree, spire, tree, windows } from './archi';

export function buildSviyazhsk(): Miniature {
  const b = new Builder();
  const G = plinth(b, 'water', { side: shade('waterDeep', 0.9) });
  // светлая отмель вокруг острова
  b.flat(ringXZ(4.25, 14, 0.2, 0.15, 0.1), G + 0.012, mix('water', 'glass', 0.45));

  // остров: песчаный берег, зелёный склон, плато
  const top = 1.2;
  const plateauR = 2.9;
  b.lathe(
    [
      [4.0, 0],
      [3.75, 0.18],
      [3.1, 0.85],
      [plateauR, top],
    ],
    14,
    'plain',
    { at: [0.15, G, 0.1], ao: false, shadow: false },
    { phase: 0.2, bands: ['stoneSand', 'lowland', 'lowland'], capTop: 'plain' },
  );
  const Y = G + top;
  b.shadowPlane = { y: Y, poly: ringXZ(plateauR - 0.02, 14, 0.2, 0.15, 0.1), color: groundShadow('plain') };

  const white = 'stoneWhite';
  const wtop = shade(white, 0.88);
  const green = 'roofGreen';

  // Успенский собор: куб, апсида, большая зелёная глава
  b.group({ at: [0.7, Y, -0.5], ry: 0.2, s: 1.2 }, () => {
    b.box(1.8, 1.6, 1.6, white, undefined, { top: wtop });
    b.cyl(0.6, 0.6, 1.15, 8, white, { at: [0.9, 0, 0] }, { top: green });
    b.pyramid(1.8, 1.6, 0.35, green, { at: [0, 1.6, 0] });
    windows(b, [0, 0.6, 0.81], 3, 0.18, 0.45, 0.5);
    dome(b, [0, 1.8, 0], { r: 0.62, h: 1.1, color: green, drumR: 0.42, drumH: 0.65, tip: 0.5, seg: 8 });
    dome(b, [-0.6, 1.7, -0.55], { r: 0.25, h: 0.42, color: green, drumR: 0.16, drumH: 0.3, tip: 0.18, seg: 6 });
    dome(b, [-0.6, 1.7, 0.55], { r: 0.25, h: 0.42, color: green, drumR: 0.16, drumH: 0.3, tip: 0.18, seg: 6 });
  });

  // колокольня: ярусы и высокий зелёный шатёр
  b.group(
    { at: [-1.4, Y, 0.6], s: 1.2 },
    () => {
      b.box(1.0, 1.5, 1.0, white, undefined, { top: wtop });
      b.box(0.8, 0.9, 0.8, white, { at: [0, 1.5, 0] }, { top: wtop });
      b.rect(0.3, 0.5, 'roofDark', { at: [0, 1.7, 0.41] });
      b.cyl(0.42, 0.42, 0.45, 8, white, { at: [0, 2.4, 0] }, { phase: Math.PI / 8 });
      b.cone(0.48, 1.7, 8, green, { at: [0, 2.85, 0] }, Math.PI / 8);
      b.lathe(
        [
          [0.08, 4.5],
          [0.16, 4.62],
          [0, 4.82],
        ],
        6,
        'gold',
      );
      spire(b, [0, 4.78, 0], 0.3, 0.04);
    },
    { shadowGroup: true },
  );

  // деревянная Троицкая церковь
  b.group({ at: [-1.2, Y, -1.5], ry: 0.4 }, () => {
    b.box(0.9, 0.7, 0.6, 'wood');
    b.gable(1.0, 0.7, 0.4, 'roofDark', { at: [0, 0.7, 0] }, { ends: 'wood' });
    dome(b, [0.1, 0.9, 0], { r: 0.18, h: 0.3, color: 'roofDark', drumR: 0.1, drumH: 0.2, profile: HELMET, tip: 0.12, seg: 6 });
  });

  // небольшие дома и монастырская ограда
  b.group({ at: [1.2, Y, 1.5], ry: -0.3 }, () => {
    b.box(1.0, 0.55, 0.6, 'stoneSand');
    b.gable(1.1, 0.7, 0.35, 'roofGreen', { at: [0, 0.55, 0] }, { ends: 'stoneSand' });
  });
  const fence: P2[] = [
    [-0.4, -1.8],
    [2.1, -1.6],
    [2.4, 0.6],
  ];
  for (let i = 0; i < fence.length - 1; i++) b.wall(fence[i], fence[i + 1], 0.12, 0.35, white, { at: [0, Y, 0] }, { top: wtop });

  // деревья на склонах и плато
  tree(b, 2.2, 1.0, Y, 0.6);
  tree(b, -2.2, -0.4, Y, 0.65);
  roundTree(b, 0.0, 2.0, Y, 0.6);
  roundTree(b, -0.4, 1.4, Y, 0.55);
  roundTree(b, 2.6, -1.0, Y, 0.55);

  // лодка у берега
  b.profile(
    [
      [-0.45, 0],
      [0.45, 0],
      [0.6, 0.18],
      [-0.6, 0.18],
    ],
    0.3,
    'wood',
    { at: [-3.4, G, 2.4], ry: 0.9, shadow: false },
    { caps: shade('wood', 0.8) },
  );

  return assemble('sviyazhsk', [b]);
}
