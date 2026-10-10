// Загрузка данных мира в браузере: JSON встраивается в бандл, terrain.bin грузится отдельным файлом.
import terrainMeta from '../../data/terrain.json';
import border from '../../data/border.json';
import water from '../../data/water.json';
import rivers from '../../data/rivers.json';
import terrainUrl from '../../data/terrain.bin?url';
import { makeWorldData, type BorderData, type RiversData, type TerrainMeta, type WaterData, type WorldData } from './types';

export type { WorldData } from './types';
export { riverPolyline } from './world';

let pending: Promise<WorldData> | null = null;

/** Данные мира (кэшируются: повторный вызов не качает terrain.bin заново). */
export function loadWorldData(): Promise<WorldData> {
  pending ??= (async () => {
    const res = await fetch(terrainUrl);
    if (!res.ok) throw new Error(`terrain.bin: HTTP ${res.status}`);
    const bin = await res.arrayBuffer();
    return makeWorldData(
      terrainMeta as TerrainMeta,
      bin,
      border as unknown as BorderData,
      water as unknown as WaterData,
      rivers as unknown as RiversData,
    );
  })();
  pending.catch(() => {
    pending = null;
  });
  return pending;
}
