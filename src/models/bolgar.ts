// Болгар: руины Соборной мечети с Большим минаретом, Северный мавзолей и Белая мечеть.
import { Builder, assemble, clipConvex, mix, plinth, ringXZ, shade, type Miniature, type P2 } from './kit';
import { MOSQUE_DOME, dome, minaret, roundTree, windows } from './archi';

export function buildBolgar(): Miniature {
  const b = new Builder();
  const G = plinth(b, 'lowland');
  const ruin = mix('stoneSand', 'stoneWhite', 0.25);
  const ruinTop = shade('stoneSand', 0.82);

  // дорожка к Белой мечети
  b.flat(
    clipConvex(
      [
        [0.9, 5],
        [1.7, 5],
        [2.2, 1.6],
        [1.4, 1.6],
      ],
      ringXZ(4.66, 14),
    ),
    G + 0.012,
    'stoneSand',
  );

  // руины Соборной мечети: обломки стен разной высоты по периметру
  const x0 = -3.3;
  const x1 = -0.5;
  const z0 = -2.9;
  const z1 = 0.1;
  const pieces: [P2, P2, number][] = [
    [[x0, z0], [x0 + 1.2, z0], 0.9],
    [[x0 + 1.6, z0], [x1, z0], 0.6],
    [[x1, z0], [x1, z0 + 1.1], 0.75],
    [[x1, z0 + 1.6], [x1, z1], 0.45],
    [[x1, z1], [x1 - 0.9, z1], 0.55],
    [[x0 + 1.1, z1], [x0, z1], 1.0],
    [[x0, z1], [x0, z0 + 1.7], 0.7],
    [[x0, z0 + 1.0], [x0, z0], 1.1],
  ];
  for (const [a, c, h] of pieces) b.wall(a, c, 0.3, h, ruin, { at: [0, G, 0] }, { top: ruinTop });
  // столбы-основания внутри
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) b.box(0.22, 0.25 + ((i + j) % 2) * 0.15, 0.22, ruin, { at: [x0 + 0.7 + i * 0.7, G, z0 + 1.0 + j * 1.0], shadow: false });
  }
  // Большой минарет у северо-восточного угла руин
  minaret(b, [x1 + 0.2, G, z0 - 0.15], { h: 5.6, r: 0.42, color: mix('stoneWhite', 'stoneSand', 0.35), cap: shade('stoneSand', 0.75), balconies: 1, capH: 0.7, tip: 0, seg: 8 });

  // Северный мавзолей: куб, восьмигранный барабан, купол
  b.group({ at: [-2.7, G, 1.7], ry: 0.15 }, () => {
    b.box(1.3, 1.2, 1.3, ruin, undefined, { top: ruinTop });
    b.rect(0.45, 0.75, 'roofDark', { at: [0, 0, 0.66] });
    b.cyl(0.58, 0.58, 0.35, 8, ruin, { at: [0, 1.2, 0] }, { phase: Math.PI / 8 });
    dome(b, [0, 1.55, 0], { r: 0.56, h: 0.7, color: shade('stoneSand', 0.8), profile: MOSQUE_DOME, tip: 0, seg: 8 });
  });

  // Белая мечеть: белый объём, большой купол, два минарета
  const white = 'stoneWhite';
  b.group({ at: [1.9, G, -0.5], ry: -0.15 }, () => {
    b.box(2.6, 1.3, 2.2, white, undefined, { top: shade(white, 0.88) });
    b.box(1.2, 1.7, 0.4, white, { at: [0, 0, 1.2] }); // портал
    b.rect(0.55, 1.0, mix('roofBlue', 'glass', 0.5), { at: [0, 0, 1.41] });
    windows(b, [-0.9, 0.5, 1.11], 1, 0.3, 0.55, 0, mix('roofBlue', 'glass', 0.5));
    windows(b, [0.9, 0.5, 1.11], 1, 0.3, 0.55, 0, mix('roofBlue', 'glass', 0.5));
    dome(b, [0, 1.3, 0], { r: 0.95, h: 1.3, color: white, drumR: 0.75, drumH: 0.45, profile: MOSQUE_DOME, tip: 0.5, seg: 10 });
    for (const [x, z] of [
      [-1.5, 1.3],
      [1.5, 1.3],
    ] as P2[]) {
      minaret(b, [x, 0, z], { h: 5.0, r: 0.22, color: white, cap: 'gold', balconies: 2, capH: 0.75, tip: 0.2, seg: 8 });
    }
    for (const [x, z] of [
      [-1.0, -0.8],
      [1.0, -0.8],
    ] as P2[]) {
      dome(b, [x, 1.3, z], { r: 0.3, h: 0.4, color: white, profile: MOSQUE_DOME, tip: 0.12, seg: 6 });
    }
  });

  roundTree(b, -0.2, 2.4, G, 0.9);
  roundTree(b, 0.4, 3.4, G, 0.75);
  roundTree(b, 3.6, 1.6, G, 0.85);
  roundTree(b, -3.5, -0.9, G, 0.7);
  roundTree(b, 3.1, -2.8, G, 0.8);

  return assemble('bolgar', [b]);
}
