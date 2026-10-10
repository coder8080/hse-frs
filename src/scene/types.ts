// Форматы файлов data/ (их пишут scripts/dem.ts и scripts/osm.ts) и разобранные данные мира.

/** [lat, lon] */
export type LatLonPair = [number, number];

export interface TerrainMeta {
  width: number;
  height: number;
  bbox: { south: number; north: number; west: number; east: number };
  minElev: number;
  maxElev: number;
  format: string;
}

export interface BorderData {
  /** Внешние кольца границы Татарстана, [lat, lon], против часовой стрелки на карте. */
  rings: LatLonPair[][];
}

export interface Reservoir {
  id: string;
  name: string;
  /** Полигоны: [внешнее кольцо, ...острова]. */
  polygons: LatLonPair[][][];
}

export interface WaterData {
  reservoirs: Reservoir[];
}

export interface River {
  id: string;
  name: string;
  width_km?: number;
  /** Осевая линия по течению: от истока (или входа на карту) к устью. */
  points: LatLonPair[];
}

export type RiversData = Record<string, River>;

/** Всё содержимое data/, разобранное. Собирается в браузере (data.ts) или в Node из fs (тесты). */
export interface WorldData {
  terrain: { meta: TerrainMeta; heights: Int16Array };
  border: BorderData;
  water: WaterData;
  rivers: RiversData;
}

/** Собирает WorldData из сырых частей; terrain.bin — Int16 little-endian. */
export function makeWorldData(
  meta: TerrainMeta,
  terrainBin: ArrayBuffer | ArrayBufferView,
  border: BorderData,
  water: WaterData,
  rivers: RiversData,
): WorldData {
  const buf =
    terrainBin instanceof ArrayBuffer
      ? terrainBin
      : terrainBin.buffer.slice(terrainBin.byteOffset, terrainBin.byteOffset + terrainBin.byteLength);
  const heights = new Int16Array(buf as ArrayBuffer, 0, meta.width * meta.height);
  return { terrain: { meta, heights }, border, water, rivers };
}
