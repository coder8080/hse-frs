// Повторяющиеся архитектурные детали: купола, минареты, шатры, деревья, окна.
import type { Builder, Col, P2, P3 } from './kit';
import { col, shade } from './kit';

/** Профили куполов [r, y] в долях радиуса и высоты. */
export const ONION: P2[] = [
  [0.62, 0],
  [0.92, 0.2],
  [1, 0.38],
  [0.82, 0.6],
  [0.45, 0.8],
  [0.12, 0.93],
  [0, 1],
];
export const MOSQUE_DOME: P2[] = [
  [1, 0],
  [0.96, 0.28],
  [0.82, 0.55],
  [0.56, 0.78],
  [0.24, 0.93],
  [0, 1],
];
export const HELMET: P2[] = [
  [1, 0],
  [0.98, 0.3],
  [0.75, 0.62],
  [0.35, 0.86],
  [0, 1],
];

export function scaleProfile(p: P2[], r: number, h: number, y0 = 0): P2[] {
  return p.map(([pr, py]) => [pr * r, y0 + py * h]);
}

/** Шпиль/навершие: тонкий четырёхгранный конус. */
export function spire(b: Builder, at: P3, h: number, r = 0.06, color: Col = 'gold'): void {
  b.cone(r, h, 4, color, { at });
}

/** Барабан + купол + золотой шпиль. Возвращает высоту верхушки над at. */
export function dome(
  b: Builder,
  at: P3,
  o: { r: number; h: number; color: Col; drumR?: number; drumH?: number; drumColor?: Col; seg?: number; profile?: P2[]; tip?: number },
): number {
  const seg = o.seg ?? 8;
  const drumH = o.drumH ?? 0;
  const drumR = o.drumR ?? o.r * 0.7;
  let top = 0;
  b.group(
    { at },
    () => {
      if (drumH > 0) b.cyl(drumR, drumR, drumH, seg, o.drumColor ?? 'stoneWhite', undefined, { top: shade(o.drumColor ?? 'stoneWhite', 0.9) });
      b.lathe(scaleProfile(o.profile ?? ONION, o.r, o.h, drumH), seg, o.color);
      const tip = o.tip ?? o.h * 0.45;
      if (tip > 0) spire(b, [0, drumH + o.h * 0.97, 0], tip, Math.max(0.04, o.r * 0.12));
      top = drumH + o.h + tip;
    },
    { shadowGroup: true },
  );
  return top;
}

/** Минарет из ярусов с балкончиками и коническим верхом. */
export function minaret(
  b: Builder,
  at: P3,
  o: { h: number; r: number; color: Col; cap: Col; seg?: number; balconies?: number; capH?: number; tip?: number; trim?: Col },
): void {
  const seg = o.seg ?? 8;
  const n = o.balconies ?? 2;
  const capH = o.capH ?? o.h * 0.2;
  const shaftH = o.h - capH;
  const trim = o.trim ?? o.color;
  b.group(
    { at },
    () => {
      let y = 0;
      let r = o.r;
      const step = shaftH / (n + 0.6);
      for (let i = 0; i < n; i++) {
        const r2 = r * 0.92;
        b.lathe(
          [
            [r, y],
            [r2, y + step],
          ],
          seg,
          o.color,
          undefined,
          { capTop: false },
        );
        y += step;
        // балкон
        b.cyl(r2 * 1.45, r2 * 1.45, step * 0.09, seg, trim, { at: [0, y - step * 0.03, 0] });
        y += step * 0.06;
        r = r2 * 0.85;
      }
      const rest = shaftH - y;
      b.cyl(r, r, rest, seg, o.color, { at: [0, y, 0] }, { top: false });
      b.cone(r * 1.25, capH, seg, o.cap, { at: [0, shaftH, 0] });
      const tip = o.tip ?? capH * 0.25;
      if (tip > 0) spire(b, [0, shaftH + capH * 0.95, 0], tip, r * 0.25);
    },
    { shadowGroup: true },
  );
}

/** Ёлка: два конуса, лёгкий разброс оттенка. */
export function tree(b: Builder, x: number, z: number, y: number, s = 1, color: Col = 'forest'): void {
  const c = col(color);
  const k = 0.9 + ((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1 + 1) % 1 * 0.22;
  const cc = c.clone().multiplyScalar(k);
  b.group(
    { at: [x, y, z], s, ry: x * 3 + z },
    () => {
      b.cyl(0.08, 0.08, 0.25, 4, 'wood', undefined, { top: false });
      b.cone(0.5, 0.9, 5, cc, { at: [0, 0.2, 0] });
      b.cone(0.36, 0.75, 5, cc.clone().multiplyScalar(1.06), { at: [0, 0.7, 0] });
    },
    { shadowGroup: true },
  );
}

/** Круглое лиственное дерево (октаэдр-шар на стволе). */
export function roundTree(b: Builder, x: number, z: number, y: number, s = 1, color: Col = 'forest'): void {
  b.group(
    { at: [x, y, z], s, ry: x + z * 2 },
    () => {
      b.cyl(0.07, 0.07, 0.35, 4, 'wood', undefined, { top: false });
      b.lathe(
        [
          [0, 0.25],
          [0.42, 0.55],
          [0.36, 0.9],
          [0, 1.1],
        ],
        5,
        shade(color, 1.08),
      );
    },
    { shadowGroup: true },
  );
}

/** Ряд окон на грани, смотрящей в +Z локально: n окон w×h с шагом step, центр ряда в at. */
export function windows(b: Builder, at: P3, n: number, w: number, h: number, step: number, color: Col = 'roofDark', ry = 0): void {
  b.group({ at, ry }, () => {
    for (let i = 0; i < n; i++) b.rect(w, h, color, { at: [(i - (n - 1) / 2) * step, 0, 0] });
  });
}
