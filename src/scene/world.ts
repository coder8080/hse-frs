// Сборка мира из данных data/: рельеф, водохранилища, реки, граница. Без WebGL — годится для тестов.
import * as THREE from 'three';
import { project, type XZ } from '../geo';
import { buildBorder } from './border';
import { Dem } from './dem';
import { buildForest, type Clearing, type Forest } from './forest';
import type { P2 } from './polygon';
import { buildTerrain } from './terrain';
import type { WorldData } from './types';
import { buildReservoirs, buildRivers, prepareWater, riverLines, waterLevelAt, waterTime, type WaterBody } from './water';

export type { WorldData } from './types';

export interface World {
  group: THREE.Group;
  /** Высота поверхности (ед. мира): рельеф или уровень водохранилища, что выше. */
  heightAt(x: number, z: number): number;
  /** Только рельеф (дно под водой опущено на шаг). */
  terrainHeightAt(x: number, z: number): number;
  /** Водохранилища с уровнями (м и ед. мира). */
  water: readonly WaterBody[];
  /** Анимация воды: время в секундах. Дёшево — одна запись uniform. */
  update(timeSec: number): void;
  /** Деревья вокруг камеры: подгрузка и скрытие квадратов леса. Вызывать каждый кадр. */
  updateView(camera: THREE.Camera): void;
  forest: Forest;
  stats: { triangles: number; meshes: number };
}

export interface WorldOptions {
  /** Площадки миниатюр: рельеф под ними выровнен, деревьев нет. */
  clearings?: readonly Clearing[];
  /** Дальность видимости деревьев, км (на телефоне меньше). */
  treeRadius?: number;
}

export function buildWorld(data: WorldData, opts: WorldOptions = {}): World {
  const dem = new Dem(data.terrain);
  const water = prepareWater(data.water, dem);
  const rivers = riverLines(data.rivers);
  const border: P2[][] = data.border.rings.map((r) =>
    r.map(([lat, lon]) => {
      const p = project(lat, lon);
      return [p.x, p.z] as P2;
    }),
  );

  const terrain = buildTerrain({ dem, border, water, rivers, landcover: data.landcover, pads: opts.clearings });
  const surface = (x: number, z: number) => {
    const h = terrain.heightAt(x, z);
    const w = waterLevelAt(water, x, z);
    return w === null ? h : Math.max(h, w);
  };

  const group = new THREE.Group();
  group.name = 'world';
  const meshes = [terrain.mesh, terrain.sides, buildReservoirs(water), buildRivers(rivers, terrain.heightAt, water), buildBorder(border, surface)];
  // порядок отрисовки: непрозрачное, рельеф первым; ленты поверх воды и рельефа
  meshes.forEach((m, i) => {
    m.renderOrder = i;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    group.add(m);
  });

  const forest = buildForest({ ground: terrain.ground, heightAt: terrain.heightAt, clearings: opts.clearings, radius: opts.treeRadius });
  group.add(forest.group);

  let triangles = 0;
  for (const m of meshes) {
    const g = m.geometry;
    triangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  }

  return {
    group,
    heightAt: surface,
    terrainHeightAt: terrain.heightAt,
    water,
    update(timeSec: number) {
      waterTime.value = timeSec;
    },
    updateView(camera: THREE.Camera) {
      forest.update(camera);
    },
    forest,
    stats: { triangles, meshes: meshes.length },
  };
}

/** Осевая линия реки в координатах мира (по течению). Для путей полёта камеры. */
export function riverPolyline(data: WorldData, id: string): XZ[] {
  const r = data.rivers[id];
  if (!r) throw new Error(`нет реки «${id}» в data/rivers.json`);
  return r.points.map(([lat, lon]) => project(lat, lon));
}
