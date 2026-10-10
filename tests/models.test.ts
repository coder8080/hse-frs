// Миниатюры собираются без WebGL и укладываются в бюджет и габариты (geo.ts, бюджет из дизайн-дока).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MINIATURE_SLUGS, buildMiniature } from '../src/models/index';

const MAX_TRIANGLES = 6000;
const MAX_MESHES = 3;

function meshes(g: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh);
  });
  return out;
}

function realTriangles(ms: THREE.Mesh[]): number {
  return ms.reduce((n, m) => {
    const g = m.geometry;
    return n + (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  }, 0);
}

function bounds(g: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  g.updateMatrixWorld(true);
  for (const m of meshes(g)) {
    m.geometry.computeBoundingBox();
    box.union(m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld));
  }
  return box;
}

describe('миниатюры', () => {
  it('12 остановок', () => {
    expect(MINIATURE_SLUGS).toHaveLength(12);
    expect(new Set(MINIATURE_SLUGS).size).toBe(12);
  });

  for (const slug of [...MINIATURE_SLUGS, 'unknown-slug']) {
    describe(slug, () => {
      const mini = buildMiniature(slug);
      const ms = meshes(mini.group);

      it('бюджет треугольников и мешей', () => {
        expect(mini.triangles).toBeGreaterThan(0);
        expect(mini.triangles).toBeLessThanOrEqual(MAX_TRIANGLES);
        expect(mini.triangles).toBe(realTriangles(ms));
        expect(ms.length).toBeGreaterThanOrEqual(1);
        expect(ms.length).toBeLessThanOrEqual(MAX_MESHES);
      });

      it('неиндексированная геометрия с цветами вершин, один общий материал', () => {
        const mat = ms[0].material;
        for (const m of ms) {
          expect(m.geometry.index).toBeNull();
          const pos = m.geometry.getAttribute('position');
          const col = m.geometry.getAttribute('color');
          expect(col.count).toBe(pos.count);
          expect(m.material).toBe(mat);
          for (let i = 0; i < col.array.length; i++) {
            expect(col.array[i]).toBeGreaterThanOrEqual(0);
            expect(col.array[i]).toBeLessThanOrEqual(1);
          }
        }
      });

      it('конечные координаты и габариты модели', () => {
        const check = () => {
          for (const m of ms) {
            const a = m.geometry.getAttribute('position').array;
            for (let i = 0; i < a.length; i++) expect(Number.isFinite(a[i])).toBe(true);
          }
          const box = bounds(mini.group);
          expect(box.min.y).toBeGreaterThanOrEqual(-1e-6);
          expect(box.min.y).toBeLessThan(0.05); // стоит на y = 0
          expect(box.max.y).toBeLessThanOrEqual(10);
          for (const v of [box.min.x, box.max.x, box.min.z, box.max.z]) expect(Math.abs(v)).toBeLessThanOrEqual(5);
        };
        check();
        if (mini.update) {
          for (const t of [0.3, 1.1, 2.7, 5]) {
            mini.update(t);
            check();
          }
        }
      });
    });
  }

  it('у нефтекачалок анимированные балансиры', () => {
    const mini = buildMiniature('almetyevsk');
    expect(mini.update).toBeTypeOf('function');
    const beam = meshes(mini.group)[1];
    const pos = beam.geometry.getAttribute('position');
    const before = Float32Array.from(pos.array as Float32Array);
    mini.update!(0.9);
    const after = pos.array as Float32Array;
    let moved = 0;
    for (let i = 0; i < after.length; i++) moved = Math.max(moved, Math.abs(after[i] - before[i]));
    expect(moved).toBeGreaterThan(0.05);
  });
});
