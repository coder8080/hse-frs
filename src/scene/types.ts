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

export interface LandcoverMeta {
  width: number;
  height: number;
  bbox: TerrainMeta['bbox'];
  format: string;
}

/** Классы ESA WorldCover (код в data/landcover.png). */
export const LC = {
  tree: 10,
  shrub: 20,
  grass: 30,
  crop: 40,
  built: 50,
  bare: 60,
  water: 80,
  wetland: 90,
} as const;

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
  /** Растительный покров: код класса на пиксель, строки с севера на юг; пиксели покрывают BBOX целиком. */
  landcover: { meta: LandcoverMeta; classes: Uint8Array };
}

/** Собирает WorldData из сырых частей; terrain.bin — Int16 little-endian. */
export function makeWorldData(
  meta: TerrainMeta,
  terrainBin: ArrayBuffer | ArrayBufferView,
  border: BorderData,
  water: WaterData,
  rivers: RiversData,
  landcover: { meta: LandcoverMeta; classes: Uint8Array },
): WorldData {
  const buf =
    terrainBin instanceof ArrayBuffer
      ? terrainBin
      : terrainBin.buffer.slice(terrainBin.byteOffset, terrainBin.byteOffset + terrainBin.byteLength);
  const heights = new Int16Array(buf as ArrayBuffer, 0, meta.width * meta.height);
  return { terrain: { meta, heights }, border, water, rivers, landcover };
}
