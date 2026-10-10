// Казанский кремль: белые стены с башнями, Кул-Шариф с четырьмя минаретами,
// красная падающая башня Сююмбике, Благовещенский собор.
import { Builder, assemble, mix, plinth, shade, type Miniature, type P2 } from './kit';
import { HELMET, MOSQUE_DOME, dome, minaret, roundTree, spire, windows } from './archi';

export function buildKazanKremlin(): Miniature {
  const b = new Builder();
  const G = plinth(b, 'plain');
  const white = 'stoneWhite';
  const wallTop = shade(white, 0.85);
  const kulBlue = mix('roofBlue', 'glass', 0.35);

  // стены: неправильный многоугольник, Спасская башня на юге
  const ring: P2[] = [
    [-3.3, 2.4],
    [-0.5, 3.75],
    [2.9, 2.3],
    [3.3, -1.0],
    [1.2, -3.9],
    [-2.3, -3.2],
    [-3.8, -0.4],
  ];
  for (let i = 0; i < ring.length; i++) {
    b.wall(ring[i], ring[(i + 1) % ring.length], 0.28, 0.8, white, { at: [0, G, 0] }, { top: wallTop });
  }
  // угловые круглые башни с зелёными шатрами
  ring.forEach(([x, z], i) => {
    if (i === 1) return;
    b.group(
      { at: [x, G, z] },
      () => {
        b.cyl(0.38, 0.36, 1.2, 8, white);
        b.cone(0.44, 0.8, 8, 'roofGreen', { at: [0, 1.2, 0] });
      },
      { shadowGroup: true },
    );
  });
  // Спасская башня: ярусы и шатёр
  b.group(
    { at: [-0.5, G, 3.75], ry: -0.45 },
    () => {
      b.box(0.95, 1.5, 0.95, white, undefined, { top: wallTop });
      b.box(0.7, 0.7, 0.7, white, { at: [0, 1.5, 0] });
      b.cyl(0.36, 0.36, 0.55, 8, white, { at: [0, 2.2, 0] });
      b.cone(0.4, 1.2, 8, 'roofGreen', { at: [0, 2.75, 0] });
      spire(b, [0, 3.9, 0], 0.5, 0.06);
      b.rect(0.42, 0.7, 'roofDark', { at: [0, 0, 0.48] });
    },
    { shadowGroup: true },
  );

  // Кул-Шариф
  b.group({ at: [0.4, G, -1.0] }, () => {
    b.box(2.0, 1.5, 2.0, white, undefined, { top: wallTop });
    b.box(1.4, 0.5, 1.4, white, { at: [0, 1.5, 0] });
    windows(b, [0, 0.5, 1.01], 3, 0.28, 0.65, 0.55, kulBlue);
    windows(b, [-1.01, 0.5, 0], 3, 0.28, 0.65, 0.55, kulBlue, -Math.PI / 2);
    dome(b, [0, 2.0, 0], { r: 0.95, h: 1.6, color: kulBlue, drumR: 0.66, drumH: 0.45, profile: MOSQUE_DOME, tip: 0.7, seg: 10 });
    for (const [x, z] of [
      [-1.25, -1.25],
      [1.25, -1.25],
      [-1.25, 1.25],
      [1.25, 1.25],
    ] as P2[]) {
      minaret(b, [x, 0, z], { h: 7.2, r: 0.24, color: white, cap: kulBlue, balconies: 2, capH: 1.3, tip: 0.35, seg: 8 });
    }
  });

  // Сююмбике: красный ярусный столп с зелёным шатром, с наклоном
  b.group(
    { at: [2.55, G, 0.1], rz: -0.07, rx: -0.05 },
    () => {
      const red = 'brickRed';
      const rt = shade(red, 0.85);
      b.box(1.1, 1.0, 1.1, red, undefined, { top: rt });
      b.box(0.9, 0.85, 0.9, red, { at: [0, 1.0, 0] }, { top: rt });
      b.box(0.72, 0.75, 0.72, red, { at: [0, 1.85, 0] }, { top: rt });
      b.cyl(0.33, 0.33, 0.6, 8, red, { at: [0, 2.6, 0] }, { top: rt });
      b.cyl(0.26, 0.26, 0.5, 8, red, { at: [0, 3.2, 0] }, { top: rt });
      b.cone(0.3, 1.5, 8, 'roofGreen', { at: [0, 3.7, 0] });
      spire(b, [0, 5.15, 0], 0.45, 0.06);
      b.rect(0.4, 0.55, 'roofDark', { at: [0, 0, 0.56] });
      windows(b, [0, 1.3, 0.46], 2, 0.15, 0.3, 0.35, 'stoneWhite');
    },
    { shadowGroup: true },
  );

  // Благовещенский собор: белый объём, пять синих глав
  b.group({ at: [-1.9, G, 1.0], ry: 0.25 }, () => {
    b.box(1.9, 1.35, 1.4, white, undefined, { top: wallTop });
    b.cyl(0.5, 0.5, 1.0, 8, white, { at: [0.95, 0, 0] });
    b.pyramid(1.9, 1.4, 0.3, 'roofGreen', { at: [0, 1.35, 0] });
    windows(b, [0, 0.55, 0.71], 3, 0.18, 0.4, 0.5, 'roofDark');
    const blue = 'roofBlue';
    dome(b, [0, 1.5, 0], { r: 0.42, h: 0.75, color: blue, drumR: 0.28, drumH: 0.55, tip: 0.35 });
    for (const [x, z] of [
      [-0.55, -0.4],
      [0.55, -0.4],
      [-0.55, 0.4],
      [0.55, 0.4],
    ] as P2[]) {
      dome(b, [x, 1.4, z], { r: 0.26, h: 0.48, color: blue, drumR: 0.17, drumH: 0.35, seg: 6, tip: 0.2 });
    }
  });

  // Президентский дворец (жёлтый) у северной стены
  b.group({ at: [-0.9, G, -2.6], ry: 0.2 }, () => {
    b.box(2.0, 0.95, 0.9, 'stoneSand', undefined, { top: shade('stoneSand', 0.9) });
    b.box(0.6, 1.25, 0.95, 'stoneSand');
    dome(b, [0, 1.25, 0], { r: 0.28, h: 0.4, color: 'roofGreen', profile: HELMET, tip: 0.15, seg: 6 });
  });

  roundTree(b, 1.8, -2.6, G, 0.9);
  roundTree(b, -2.8, -0.4, G, 0.8);
  roundTree(b, 0.9, 2.3, G, 0.8);

  return assemble('kazan-kremlin', [b]);
}
