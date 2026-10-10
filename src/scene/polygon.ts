// Плоская геометрия на плоскости (x, y) — общая для скриптов данных и сцены.

export type P2 = [number, number];

/** Площадь кольца со знаком (против часовой стрелки > 0). */
export function ringArea(ring: readonly P2[]): number {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    s += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return s / 2;
}

/** Точка внутри кольца (even-odd). */
export function pointInRing(x: number, y: number, ring: readonly P2[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Полигон с дырами: первое кольцо — внешнее, остальные — дыры. */
export function pointInPolygon(x: number, y: number, rings: readonly (readonly P2[])[]): boolean {
  if (!rings.length || !pointInRing(x, y, rings[0])) return false;
  for (let k = 1; k < rings.length; k++) if (pointInRing(x, y, rings[k])) return false;
  return true;
}

/** Ограничивающий прямоугольник набора колец. */
export function ringsBounds(rings: readonly (readonly P2[])[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rings)
    for (const [x, y] of r) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  return { minX, minY, maxX, maxY };
}

/** Расстояние от точки до отрезка. */
export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * dx - px;
  const qy = ay + t * dy - py;
  return Math.sqrt(qx * qx + qy * qy);
}

/** Отсечение кольца прямоугольником (Сазерленд — Ходжман). */
export function clipRingToRect(ring: readonly P2[], minX: number, minY: number, maxX: number, maxY: number): P2[] {
  type Edge = { inside: (p: P2) => boolean; cut: (a: P2, b: P2) => P2 };
  const edges: Edge[] = [
    { inside: (p) => p[0] >= minX, cut: (a, b) => [minX, a[1] + ((b[1] - a[1]) * (minX - a[0])) / (b[0] - a[0])] },
    { inside: (p) => p[0] <= maxX, cut: (a, b) => [maxX, a[1] + ((b[1] - a[1]) * (maxX - a[0])) / (b[0] - a[0])] },
    { inside: (p) => p[1] >= minY, cut: (a, b) => [a[0] + ((b[0] - a[0]) * (minY - a[1])) / (b[1] - a[1]), minY] },
    { inside: (p) => p[1] <= maxY, cut: (a, b) => [a[0] + ((b[0] - a[0]) * (maxY - a[1])) / (b[1] - a[1]), maxY] },
  ];
  let out: P2[] = ring.slice();
  for (const e of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      const ci = e.inside(cur);
      const pi = e.inside(prev);
      if (ci) {
        if (!pi) out.push(e.cut(prev, cur));
        out.push(cur);
      } else if (pi) out.push(e.cut(prev, cur));
    }
    if (!out.length) break;
  }
  return out;
}

/**
 * Пересечения рёбер колец с горизонталью y (отсортированные x). Для заливки строк even-odd:
 * точка (x, y) внутри, если число пересечений левее x нечётно. Дыры учитываются сами.
 */
export function rowCrossings(rings: readonly (readonly P2[])[], y: number): number[] {
  const xs: number[] = [];
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
    }
  }
  return xs.sort((a, b) => a - b);
}

/** Обходит строку узлов x0 + i·dx (i = 0…n-1) и вызывает cb для узлов внутри полигона. */
export function fillRow(xs: readonly number[], x0: number, dx: number, n: number, cb: (i: number) => void): void {
  for (let k = 0; k + 1 < xs.length; k += 2) {
    const i0 = Math.max(0, Math.ceil((xs[k] - x0) / dx));
    const i1 = Math.min(n - 1, Math.floor((xs[k + 1] - x0) / dx));
    for (let i = i0; i <= i1; i++) cb(i);
  }
}
