// Нейтральная заглушка для неизвестного slug: подставка и обелиск.
import { Builder, assemble, plinth, type Miniature } from './kit';
import { spire } from './archi';

export function buildPlaceholder(): Miniature {
  const b = new Builder();
  const G = plinth(b, 'stoneSand', { r: 2.2, seg: 10 });
  b.box(1.0, 0.3, 1.0, 'stoneWhite', { at: [0, G, 0] });
  b.cyl(0.42, 0.26, 3.6, 4, 'stoneWhite', { at: [0, G + 0.3, 0], ry: Math.PI / 4 });
  b.cone(0.3, 0.55, 4, 'stoneWhite', { at: [0, G + 3.9, 0] }, Math.PI / 4);
  spire(b, [0, G + 4.4, 0], 0.35, 0.06);
  return assemble('placeholder', [b]);
}
