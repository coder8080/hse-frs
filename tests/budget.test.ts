// Бюджет производительности мира (без миниатюр) и здравый смысл данных data/.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WORLD, project } from '../src/geo';
import { makeWorldData, type WorldData } from '../src/scene/types';
import { buildWorld, riverPolyline } from '../src/scene/world';

const DATA = join(__dirname, '..', 'data');
const json = (f: string) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));

function loadData(): WorldData {
  return makeWorldData(
    json('terrain.json'),
    readFileSync(join(DATA, 'terrain.bin')),
    json('border.json'),
    json('water.json'),
    json('rivers.json'),
  );
}

describe('мир: бюджет и данные', () => {
  const data = loadData();
  const world = buildWorld(data);

  it('укладывается в бюджет треугольников и мешей', () => {
    expect(world.stats.triangles).toBeLessThanOrEqual(90_000);
    expect(world.stats.meshes).toBeLessThanOrEqual(12);
    const byName = new Map(world.group.children.map((c) => [c.name, c as import('three').Mesh]));
    const tris = (n: string) => {
      const g = byName.get(n)!.geometry;
      return (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    };
    expect(tris('terrain')).toBeLessThanOrEqual(80_000);
    expect(tris('reservoirs') + tris('rivers') + tris('border')).toBeLessThanOrEqual(10_000);
  });

  it('heightAt конечна во всём охвате', () => {
    for (let i = 0; i <= 20; i++) {
      for (let j = 0; j <= 20; j++) {
        const h = world.heightAt(WORLD.minX + (WORLD.width * i) / 20, WORLD.minZ + (WORLD.depth * j) / 20);
        expect(Number.isFinite(h)).toBe(true);
      }
    }
    // Казань выше уровня воды, но не в облаках
    const kazan = project(55.796, 49.106);
    const h = world.heightAt(kazan.x, kazan.z);
    expect(h).toBeGreaterThan(0.5);
    expect(h).toBeLessThan(4);
  });

  it('уровни водохранилищ 40–120 м', () => {
    expect(world.water.length).toBeGreaterThanOrEqual(2);
    for (const b of world.water) {
      expect(b.levelM, b.id).toBeGreaterThanOrEqual(40);
      expect(b.levelM, b.id).toBeLessThanOrEqual(120);
    }
  });

  for (const id of ['volga', 'kama']) {
    it(`${id}: непрерывная линия через Татарстан`, () => {
      const pts = riverPolyline(data, id);
      expect(pts.length).toBeGreaterThan(20);
      let len = 0;
      for (let i = 1; i < pts.length; i++) {
        const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
        expect(d, `${id}: разрыв у точки ${i}`).toBeLessThanOrEqual(15);
        len += d;
      }
      expect(len).toBeGreaterThan(250);
    });
  }

  it('Кама течёт к Волге: устье Камы рядом с Волгой', () => {
    const kama = riverPolyline(data, 'kama');
    const volga = riverPolyline(data, 'volga');
    const mouth = kama[kama.length - 1];
    const near = Math.min(...volga.map((p) => Math.hypot(p.x - mouth.x, p.z - mouth.z)));
    expect(near).toBeLessThan(15);
  });
});
