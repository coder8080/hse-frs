// Выборка высот из data/terrain.bin в мировых координатах (км). Метры, без масштаба.
import { WORLD } from '../geo';
import type { WorldData } from './types';

export class Dem {
  readonly w: number;
  readonly h: number;
  private readonly data: Int16Array;

  constructor(terrain: WorldData['terrain']) {
    this.w = terrain.meta.width;
    this.h = terrain.meta.height;
    this.data = terrain.heights;
  }

  /** Узел сетки (столбец c с запада, строка r с севера). */
  node(c: number, r: number): number {
    const cc = c < 0 ? 0 : c >= this.w ? this.w - 1 : c;
    const rr = r < 0 ? 0 : r >= this.h ? this.h - 1 : r;
    return this.data[rr * this.w + cc];
  }

  /** Мировые координаты узла сетки. */
  nodeXZ(c: number, r: number): { x: number; z: number } {
    return {
      x: WORLD.minX + (c / (this.w - 1)) * WORLD.width,
      z: WORLD.minZ + (r / (this.h - 1)) * WORLD.depth,
    };
  }

  /** Высота в метрах в точке мира, билинейно. Узлы сетки лежат на краях BBOX. */
  at(x: number, z: number): number {
    const fc = Math.min(this.w - 1, Math.max(0, ((x - WORLD.minX) / WORLD.width) * (this.w - 1)));
    const fr = Math.min(this.h - 1, Math.max(0, ((z - WORLD.minZ) / WORLD.depth) * (this.h - 1)));
    const c = Math.min(this.w - 2, Math.floor(fc));
    const r = Math.min(this.h - 2, Math.floor(fr));
    const u = fc - c;
    const v = fr - r;
    const i = r * this.w + c;
    const d = this.data;
    return (
      d[i] * (1 - u) * (1 - v) + d[i + 1] * u * (1 - v) + d[i + this.w] * (1 - u) * v + d[i + this.w + 1] * u * v
    );
  }

  /** Среднее по квадрату со стороной size км (сглаживание под шаг меша). */
  mean(x: number, z: number, size: number, n = 3): number {
    let s = 0;
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < n; b++) {
        s += this.at(x + ((a + 0.5) / n - 0.5) * size, z + ((b + 0.5) / n - 0.5) * size);
      }
    }
    return s / (n * n);
  }
}
