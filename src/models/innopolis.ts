// Иннополис: террасный полукольцевой корпус университета из стекла и белых плит,
// стеклянный технопарк и современные жилые башни.
import { Builder, assemble, mix, plinth, ringXZ, shade, type Col, type Miniature, type P3 } from './kit';
import { roundTree } from './archi';

function tower(b: Builder, at: P3, w: number, d: number, floors: number, accent: Col, ry = 0): void {
  const fh = 0.42;
  b.group({ at, ry }, () => {
    b.box(w, floors * fh + 0.1, d, 'kamazWhite', undefined, { top: shade('steel', 1.1) });
    for (let i = 0; i < floors; i++) {
      const y = 0.12 + i * fh;
      b.rect(w * 0.82, fh * 0.55, 'glass', { at: [0, y, d / 2 + 0.01] });
      b.rect(d * 0.8, fh * 0.55, 'glass', { at: [-w / 2 - 0.01, y, 0], ry: -Math.PI / 2 });
    }
    b.rect(w * 0.18, floors * fh, accent, { at: [w * 0.41, 0.05, d / 2 + 0.02] });
    b.box(w * 0.5, 0.25, d * 0.5, shade('steel', 0.9), { at: [0, floors * fh + 0.1, 0] });
  });
}

export function buildInnopolis(): Miniature {
  const b = new Builder();
  const G = plinth(b, 'plain');
  const white = 'kamazWhite';
  const glass = mix('glass', 'roofBlue', 0.25);

  // площадь во дворе
  b.flat(ringXZ(1.5, 10, 0, 0, 1.2), G + 0.012, 'stoneSand');

  // университет: пять террас по дуге, раскрытой к югу
  const cz = 1.2;
  const a0 = 0.12;
  const a1 = Math.PI - 0.12;
  const floors = 5;
  const fh = 0.62;
  let rOutTop = 3.4;
  for (let i = 0; i < floors; i++) {
    const rIn = 1.75 + 0.06 * i;
    const rOut = 3.4 - 0.28 * i;
    rOutTop = rOut;
    const y = G + i * fh;
    b.arc(rIn + 0.08, rOut - 0.1, a0 + 0.02, a1 - 0.02, fh - 0.16, 9, glass, { at: [0, y, cz], shadow: false });
    b.arc(rIn, rOut, a0, a1, 0.16, 9, white, { at: [0, y + fh - 0.16, cz], shadow: false });
  }
  // общая тень дуги: куски по 1/5 дуги
  const H = floors * fh;
  for (let k = 0; k < 5; k++) {
    const pts: P3[] = [];
    for (const a of [a0 + ((a1 - a0) * k) / 5, a0 + ((a1 - a0) * (k + 1)) / 5]) {
      const c = Math.cos(a);
      const s = -Math.sin(a);
      pts.push([c * 1.75, G, cz + s * 1.75], [c * 3.4, G, cz + s * 3.4], [c * 2.0, G + H, cz + s * 2.0], [c * rOutTop, G + H, cz + s * rOutTop]);
    }
    b.castShadow(pts);
  }
  // антенна-«шпиль» на верхней террасе
  b.cyl(0.05, 0.03, 1.3, 4, 'steel', { at: [0, G + H, cz - 2.1] });

  // технопарк: стеклянный куб с белой рамкой
  b.group({ at: [-3.0, G, -1.6], ry: 0.3 }, () => {
    b.box(1.5, 1.7, 1.3, glass, undefined, { top: white });
    b.box(1.6, 0.18, 1.4, white, { at: [0, 1.7, 0] });
    b.box(1.6, 0.12, 1.4, white, { at: [0, 0.85, 0], shadow: false });
  });

  tower(b, [-2.9, G, 2.7], 1.1, 1.0, 6, 'accent', 0.2);
  tower(b, [3.0, G, 2.5], 1.0, 1.0, 8, 'gold', -0.2);
  tower(b, [3.2, G, -1.6], 1.0, 0.9, 5, 'roofGreen', -0.3);

  roundTree(b, -0.6, 1.4, G, 0.6);
  roundTree(b, 0.6, 1.8, G, 0.55);
  roundTree(b, -1.6, 3.8, G, 0.65);
  roundTree(b, 1.6, 3.8, G, 0.6);
  roundTree(b, 0.0, -3.9, G, 0.6);

  return assemble('innopolis', [b]);
}
