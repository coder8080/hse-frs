// Бюджет производительности мира (без миниатюр) и здравый смысл данных data/.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import matter from 'gray-matter';
import * as THREE from 'three';
import { spread } from '../src/app/app';
import { MINIATURE_SCALE, WORLD, project } from '../src/geo';
import { buildMiniature } from '../src/models/index';
import { LC, makeWorldData, type WorldData } from '../src/scene/types';
import { buildWorld, riverPolyline } from '../src/scene/world';

const DATA = join(__dirname, '..', 'data');
const json = (f: string) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));

function loadLandcover(): WorldData['landcover'] {
  const meta = json('landcover.json');
  const png = PNG.sync.read(readFileSync(join(DATA, 'landcover.png')));
  expect([png.width, png.height]).toEqual([meta.width, meta.height]);
  const classes = new Uint8Array(png.width * png.height);
  for (let i = 0; i < classes.length; i++) classes[i] = png.data[i * 4];
  return { meta, classes };
}

function loadData(): WorldData {
  return makeWorldData(
    json('terrain.json'),
    readFileSync(join(DATA, 'terrain.bin')),
    json('border.json'),
    json('water.json'),
    json('rivers.json'),
    loadLandcover(),
  );
}

describe('мир: бюджет и данные', () => {
  const data = loadData();
  const raifa = project(55.9, 48.73);
  const world = buildWorld(data, { clearings: [{ x: raifa.x, z: raifa.z, r: 3 }] });

  it('укладывается в бюджет треугольников и мешей', () => {
    expect(world.stats.triangles).toBeLessThanOrEqual(330_000);
    expect(world.stats.meshes).toBeLessThanOrEqual(12);
    const byName = new Map(world.group.children.map((c) => [c.name, c as import('three').Mesh]));
    const tris = (n: string) => {
      const g = byName.get(n)!.geometry;
      return (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    };
    expect(tris('terrain')).toBeLessThanOrEqual(310_000);
    expect(tris('reservoirs') + tris('rivers') + tris('border')).toBeLessThanOrEqual(10_000);
  });

  it('покров: лес, поля и вода на своих местах', () => {
    const lc = data.landcover;
    const share = (code: number) => lc.classes.filter((c) => c === code).length / lc.classes.length;
    expect(share(LC.tree)).toBeGreaterThan(0.15);
    expect(share(LC.crop)).toBeGreaterThan(0.2);
    // Раифа — в лесу заповедника
    const g = world.forest;
    g.generateAround(raifa.x, raifa.z, 15);
    const near = g.trees().filter(([x, z]) => Math.hypot(x - raifa.x, z - raifa.z) < 10);
    expect(near.length).toBeGreaterThan(300);
    // на поляне под миниатюрой деревьев нет
    expect(near.some(([x, z]) => Math.hypot(x - raifa.x, z - raifa.z) < 3)).toBe(false);
  });

  it('площадка миниатюры ровная: склон не прорезает подставку', () => {
    const hs: number[] = [];
    for (let a = 0; a < 24; a++) {
      for (const d of [0, 1, 2, 2.6]) {
        const ang = (a / 24) * Math.PI * 2;
        hs.push(world.terrainHeightAt(raifa.x + Math.cos(ang) * d, raifa.z + Math.sin(ang) * d));
      }
    }
    expect(Math.max(...hs) - Math.min(...hs)).toBeLessThan(0.01);
  });

  it('рельеф не прорезает миниатюры на их местах в приложении', () => {
    // как в app.ts: масштабы, раздвижка, площадки, высота установки
    const route = json('../content/route.json') as { stops: { slug: string }[] };
    const stops = route.stops
      .map((s) => {
        const fm = matter(readFileSync(join(DATA, '..', 'content', 'stops', `${s.slug}.md`), 'utf8')).data;
        return { slug: s.slug, kind: fm.kind as string, lat: fm.lat as number, lon: fm.lon as number };
      })
      .filter((fm) => fm.kind !== 'intro');
    const scales = stops.map((fm) => MINIATURE_SCALE * (fm.kind === 'key' ? 1 : 0.9));
    const places = spread(stops.map((fm) => project(fm.lat, fm.lon)), scales.map((k) => k * 4.8));
    const w = buildWorld(data, { clearings: places.map((p, i) => ({ ...p, r: scales[i] * 4.8 + 0.5 })) });
    const v = new THREE.Vector3();
    const inst = new THREE.Matrix4();
    stops.forEach((s, i) => {
      const m = buildMiniature(s.slug);
      m.group.scale.setScalar(scales[i]);
      m.group.position.set(places[i].x, w.heightAt(places[i].x, places[i].z), places[i].z);
      m.group.updateMatrixWorld(true);
      let worst = 0;
      m.group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const pos = mesh.geometry.getAttribute('position');
        const im = mesh as THREE.InstancedMesh;
        for (let q = 0; q < (im.isInstancedMesh ? im.count : 1); q++) {
          const mw = mesh.matrixWorld.clone();
          if (im.isInstancedMesh) mw.multiply((im.getMatrixAt(q, inst), inst));
          for (let j = 0; j < pos.count; j++) {
            v.fromBufferAttribute(pos, j).applyMatrix4(mw);
            worst = Math.max(worst, w.heightAt(v.x, v.z) - v.y);
          }
        }
      });
      expect(worst, `${s.slug}: часть модели ушла под рельеф`).toBeLessThan(0.01);
    });
  });

  it('деревья не стоят в воде', () => {
    const kazan = project(55.796, 49.106);
    world.forest.generateAround(kazan.x, kazan.z, 40);
    const trees = world.forest.trees();
    expect(trees.length).toBeGreaterThan(1000);
    const wet = trees.filter(([x, z]) => world.terrainHeightAt(x, z) < (world.heightAt(x, z) - 0.01));
    expect(wet.length / trees.length).toBeLessThan(0.002);
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
