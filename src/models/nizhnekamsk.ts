// Нижнекамск: нефтехимический завод — ректификационные колонны, шаровые резервуары,
// эстакада труб, полосатая дымовая труба.
import { Builder, assemble, plinth, shade, type Miniature, type P2 } from './kit';
import { roundTree } from './archi';

export function buildNizhnekamsk(): Miniature {
  const b = new Builder();
  const G = plinth(b, 'outside', { side: shade('steel', 0.9) });
  const steel = 'steel';
  const steelD = shade('steel', 0.8);
  const white = 'kamazWhite';

  // площадка-бетон
  b.flat(
    [
      [-3.6, -3.0],
      [3.4, -3.0],
      [3.4, 2.6],
      [-3.6, 2.6],
    ],
    G + 0.012,
    shade('stoneSand', 0.9),
  );

  // ректификационные колонны с площадками
  const columns: [number, number, number, number][] = [
    [-2.4, -1.6, 7.2, 0.42],
    [-1.3, -2.2, 6.0, 0.36],
    [-1.6, -0.6, 5.0, 0.32],
  ];
  for (const [x, z, h, r] of columns) {
    b.group(
      { at: [x, G, z] },
      () => {
        b.cyl(r, r, h, 8, steel, undefined, { top: false });
        b.lathe(
          [
            [r, h],
            [r * 0.7, h + r * 0.5],
            [0, h + r * 0.7],
          ],
          8,
          steel,
        );
        for (let y = 1.2; y < h - 0.3; y += 1.6) b.cyl(r * 1.45, r * 1.45, 0.07, 8, 'accent', { at: [0, y, 0] });
      },
      { shadowGroup: true },
    );
  }

  // дымовая труба: красно-белые пояса
  const red = 'accent';
  const stackProfile: P2[] = [];
  for (let i = 0; i <= 6; i++) stackProfile.push([0.4 - i * 0.03, i * 1.5]);
  b.lathe(stackProfile, 8, white, { at: [-3.1, G, 0.8] }, { bands: [white, red, white, red, white, red], capTop: 'oilBlack' });

  // шаровые резервуары на опорах
  const sphere: P2[] = [];
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * Math.PI;
    sphere.push([Math.cos(a) * 0.85, 0.85 + Math.sin(a) * 0.85]);
  }
  for (const [x, z] of [
    [1.0, 1.4],
    [2.6, 0.9],
    [1.6, -0.3],
  ] as P2[]) {
    b.group(
      { at: [x, G, z] },
      () => {
        b.cyl(0.45, 0.35, 0.5, 6, steelD);
        b.lathe(sphere, 8, white, { at: [0, 0.4, 0] });
      },
      { shadowGroup: true },
    );
  }
  // цилиндрические резервуары
  b.cyl(0.95, 0.95, 1.0, 10, white, { at: [2.0, G, -2.1] }, { top: steel });
  b.cyl(0.7, 0.7, 0.85, 10, white, { at: [0.5, G, -2.5] }, { top: steel });

  // корпус и эстакада труб
  b.box(1.6, 0.9, 1.0, shade('steel', 1.15), { at: [-1.4, G, 1.6] }, { top: steelD });
  windows(b, -1.4, 1.6, G);
  for (const x of [-1.4, -0.3, 0.8]) {
    b.box(0.08, 1.1, 0.08, steelD, { at: [x, G, 0.25], shadow: false });
    b.box(0.08, 1.1, 0.08, steelD, { at: [x, G, 0.55], shadow: false });
  }
  for (const [z, c] of [
    [0.3, steel],
    [0.5, 'roofGreen'],
  ] as const) {
    b.cyl(0.07, 0.07, 3.6, 5, c, { at: [-2.4, G + 1.15, z], rz: -Math.PI / 2, shadow: false });
  }
  b.cyl(0.08, 0.08, 1.4, 5, 'accent', { at: [1.25, G + 1.15, 0.4], rx: -Math.PI / 2, ry: Math.PI, shadow: false });

  roundTree(b, -3.4, 3.0, G, 0.7);
  roundTree(b, 3.5, 2.5, G, 0.75);
  roundTree(b, 0.2, 3.6, G, 0.6);

  return assemble('nizhnekamsk', [b]);
}

function windows(b: Builder, x: number, z: number, G: number): void {
  for (let i = 0; i < 4; i++) b.rect(0.22, 0.25, 'glass', { at: [x - 0.54 + i * 0.36, G + 0.4, z + 0.51] });
}
