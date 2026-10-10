// Старо-Татарская слобода: яркие деревянные дома с резными воротами и наличниками,
// мечеть Марджани с минаретом над крышей.
import { Builder, assemble, clipConvex, mix, plinth, ringXZ, shade, type Col, type Miniature, type P3 } from './kit';
import { minaret, roundTree, windows } from './archi';

function house(b: Builder, at: P3, o: { wall: Col; roof: Col; gate?: Col; gateSide?: 1 | -1; ry?: number }): void {
  const trim = 'stoneWhite';
  b.group({ at, ry: o.ry ?? 0 }, () => {
    b.box(1.4, 1.0, 1.3, o.wall, undefined, { bottom: false });
    // цоколь
    b.box(1.46, 0.18, 1.36, shade('stoneSand', 0.85), { shadow: false });
    // двускатная крыша щипцом на улицу, фронтон белый
    b.gable(1.55, 1.7, 0.75, o.roof, { at: [0, 1.0, 0], ry: Math.PI / 2 }, { ends: trim });
    b.rect(0.35, 0.22, o.wall, { at: [0, 1.22, 0.79] }); // слуховое окно
    // окна с белыми наличниками и цветными «коронами»
    for (const x of [-0.42, 0, 0.42]) {
      b.rect(0.3, 0.52, trim, { at: [x, 0.3, 0.655] });
      b.rect(0.18, 0.32, 'glass', { at: [x, 0.38, 0.66] });
      b.rect(0.36, 0.08, o.gate ?? 'accent', { at: [x, 0.84, 0.66] });
    }
    if (o.gate) {
      const s = o.gateSide ?? 1;
      const gx = s * 1.2;
      b.box(0.14, 1.05, 0.14, trim, { at: [gx - s * 0.45, 0, 0.55] });
      b.box(0.14, 1.05, 0.14, trim, { at: [gx + s * 0.45, 0, 0.55] });
      b.rect(0.78, 0.85, o.gate, { at: [gx, 0, 0.56] });
      b.rect(0.2, 0.2, 'gold', { at: [gx, 0.45, 0.565] }); // солярный знак
      b.gable(1.1, 0.34, 0.22, o.roof, { at: [gx, 1.05, 0.55] });
    }
  });
}

export function buildStaroTatarskayaSloboda(): Miniature {
  const b = new Builder();
  const G = plinth(b, 'plain');
  const street = clipConvex(
    [
      [-6, 1.95],
      [6, 1.95],
      [6, 2.9],
      [-6, 2.9],
    ],
    ringXZ(4.65, 14),
  );
  b.flat(street, G + 0.012, 'stoneSand');

  // мечеть Марджани: светлый двухэтажный объём, зелёная крыша, минарет из крыши
  const white = 'stoneWhite';
  b.group({ at: [0.5, G, -1.7] }, () => {
    b.box(2.8, 1.4, 1.9, white, undefined, { top: shade(white, 0.9) });
    windows(b, [0, 0.25, 0.96], 5, 0.22, 0.38, 0.5, 'roofGreen');
    windows(b, [0, 0.85, 0.96], 5, 0.22, 0.38, 0.5, 'roofGreen');
    b.pyramid(3.0, 2.1, 0.65, 'roofGreen', { at: [0, 1.4, 0] });
    b.box(0.62, 1.15, 0.62, white, { at: [0, 1.4, 0.35] }, { top: 'roofGreen' });
    minaret(b, [0, 2.55, 0.35], { h: 3.6, r: 0.26, color: white, cap: 'roofGreen', balconies: 2, capH: 1.0, tip: 0.35, seg: 8, trim: shade(white, 0.9) });
  });

  house(b, [-2.75, G, 0.75], { wall: shade('roofGreen', 1.2), roof: 'steel', gate: 'accent', gateSide: 1, ry: 0.08 });
  house(b, [-0.15, G, 0.95], { wall: mix('roofBlue', 'glass', 0.3), roof: 'roofGreen', gate: 'roofGreen', gateSide: 1 });
  house(b, [2.55, G, 0.75], { wall: mix('gold', 'wood', 0.35), roof: 'roofDark', ry: -0.08 });

  // деревья во дворах
  roundTree(b, -2.6, -1.4, G, 0.95);
  roundTree(b, -3.4, -0.6, G, 0.7);
  roundTree(b, 3.3, -1.3, G, 0.85);
  roundTree(b, 2.4, -2.9, G, 0.7);
  roundTree(b, -1.5, -3.2, G, 0.7);
  roundTree(b, 3.8, 1.4, G, 0.6);

  return assemble('staro-tatarskaya-sloboda', [b]);
}
