// Набережные Челны: грузовик КАМАЗ — синяя бескапотная кабина, белый кузов-самосвал,
// три оси; стоит на отрезке дороги.
import { Builder, assemble, clipConvex, mix, plinth, ringXZ, shade, type Miniature, type P2 } from './kit';
import { roundTree } from './archi';

export function buildNaberezhnyeChelny(): Miniature {
  const b = new Builder();
  const G = plinth(b, 'plain');
  const rim = ringXZ(4.66, 14);

  // дорога с разметкой, по диагонали
  const ang = 0.55;
  const dx = Math.cos(ang);
  const dz = -Math.sin(ang);
  const road = (w: number): P2[] => [
    [-6 * dx - w * dz, -6 * dz + w * dx],
    [6 * dx - w * dz, 6 * dz + w * dx],
    [6 * dx + w * dz, 6 * dz - w * dx],
    [-6 * dx + w * dz, -6 * dz - w * dx],
  ];
  b.flat(clipConvex(road(1.9), rim), G + 0.012, mix('roofDark', 'steel', 0.25));
  for (let i = -4; i <= 4; i += 2) {
    const c: P2 = [i * dx, i * dz];
    const seg: P2[] = [
      [c[0] - 0.4 * dx - 0.06 * dz, c[1] - 0.4 * dz + 0.06 * dx],
      [c[0] + 0.4 * dx - 0.06 * dz, c[1] + 0.4 * dz + 0.06 * dx],
      [c[0] + 0.4 * dx + 0.06 * dz, c[1] + 0.4 * dz - 0.06 * dx],
      [c[0] - 0.4 * dx + 0.06 * dz, c[1] - 0.4 * dz - 0.06 * dx],
    ];
    const piece = clipConvex(seg, rim);
    if (piece.length >= 3) b.flat(piece, G + 0.02, 'kamazWhite', { at: [0, 0, 0] });
  }

  const blue = 'kamazBlue';
  const blueD = shade('kamazBlue', 0.8);
  const white = 'kamazWhite';
  const black = 'oilBlack';
  // грузовик: длина вдоль локальной +X (перёд), ширина по Z
  b.group({ at: [0.2, G, -0.1], ry: Math.PI + ang - 0.0 }, () => {
    // рама
    b.box(6.4, 0.35, 1.5, black, { at: [-0.3, 0.55, 0], shadow: false });
    // колёса: передняя ось и тележка из двух задних
    for (const x of [2.15, -1.25, -2.45]) {
      for (const s of [-1, 1]) {
        const z = s > 0 ? 0.72 : -1.22;
        b.cyl(0.58, 0.58, 0.5, 8, black, { at: [x, 0.58, z], rx: Math.PI / 2 }, { top: shade('steel', 0.8), bottom: true, phase: Math.PI / 8 });
      }
      b.disc(0.26, 6, 'steel', { at: [x, 0.58, 1.23] });
      b.disc(0.26, 6, 'steel', { at: [x, 0.58, -1.23], ry: Math.PI });
    }
    // кабина: профиль сбоку, почти вертикальный перёд
    b.profile(
      [
        [1.45, 0.85],
        [3.45, 0.85],
        [3.6, 1.95],
        [3.42, 3.15],
        [3.25, 3.3],
        [1.45, 3.3],
      ],
      2.4,
      blue,
      undefined,
      { caps: blue, faces: [blueD, blue, blue, blue, blue, blueD] },
    );
    // обтекатель на крыше
    b.profile(
      [
        [1.5, 3.3],
        [3.0, 3.3],
        [1.5, 3.85],
      ],
      2.2,
      white,
    );
    // лобовое стекло (наклонённое) и боковые окна
    b.rect(2.1, 1.05, mix('glass', 'roofDark', 0.35), { at: [3.6, 2.02, 0], ry: Math.PI / 2, rx: -0.15 });
    for (const s of [1, -1]) {
      b.rect(0.95, 0.8, mix('glass', 'roofDark', 0.35), { at: [2.85, 2.25, s * 1.205], ry: s > 0 ? 0 : Math.PI });
      b.rect(1.85, 0.22, white, { at: [2.4, 1.55, s * 1.205], ry: s > 0 ? 0 : Math.PI });
    }
    // бампер, решётка, фары
    b.box(0.3, 0.42, 2.5, white, { at: [3.6, 0.55, 0] });
    b.rect(1.4, 0.45, blueD, { at: [3.58, 1.25, 0], ry: Math.PI / 2, rx: -0.13 });
    for (const s of [-0.85, 0.85]) b.rect(0.35, 0.2, 'gold', { at: [3.76, 0.65, s], ry: Math.PI / 2 });
    // кузов-самосвал: белый с синей кромкой
    b.profile(
      [
        [-3.45, 1.0],
        [1.2, 1.0],
        [1.35, 2.55],
        [-3.3, 2.55],
      ],
      2.3,
      white,
      { at: [0, 0, 0] },
      { caps: shade(white, 0.95) },
    );
    b.box(4.75, 0.25, 2.36, blue, { at: [-1.05, 2.25, 0] }); // синяя полоса по борту
    b.pyramid(4.0, 1.9, 0.5, shade('stoneSand', 0.95), { at: [-1.05, 2.55, 0] }); // груз песка
    b.box(0.4, 0.5, 2.36, blue, { at: [1.15, 2.55, 0] }); // козырёк над кабиной
  });

  roundTree(b, -2.6, -2.4, G, 0.9);
  roundTree(b, -3.6, -1.0, G, 0.75);
  roundTree(b, 2.9, 2.2, G, 0.85);
  roundTree(b, 1.6, 3.4, G, 0.7);

  return assemble('naberezhnye-chelny', [b]);
}
