// Загрузка данных мира в браузере: JSON встраивается в бандл, terrain.bin и landcover.png грузятся отдельными файлами.
import terrainMeta from '../../data/terrain.json';
import landcoverMeta from '../../data/landcover.json';
import border from '../../data/border.json';
import water from '../../data/water.json';
import rivers from '../../data/rivers.json';
import terrainUrl from '../../data/terrain.bin?url';
import landcoverUrl from '../../data/landcover.png?url';
import {
  makeWorldData,
  type BorderData,
  type LandcoverMeta,
  type RiversData,
  type TerrainMeta,
  type WaterData,
  type WorldData,
} from './types';

export type { WorldData } from './types';
export { riverPolyline } from './world';

let pending: Promise<WorldData> | null = null;

async function fetchOk(url: string, name: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res;
}

/** Серый PNG → коды классов. Без преобразования цвета, иначе коды «поплывут». */
async function decodeClasses(blob: Blob, meta: LandcoverMeta): Promise<Uint8Array> {
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const { width: w, height: h } = meta;
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = rgba[i * 4];
  return out;
}

/** Данные мира (кэшируются: повторный вызов не качает файлы заново). */
export function loadWorldData(): Promise<WorldData> {
  pending ??= (async () => {
    const [bin, lc] = await Promise.all([
      fetchOk(terrainUrl, 'terrain.bin').then((r) => r.arrayBuffer()),
      fetchOk(landcoverUrl, 'landcover.png').then((r) => r.blob()).then((b) => decodeClasses(b, landcoverMeta as LandcoverMeta)),
    ]);
    return makeWorldData(
      terrainMeta as TerrainMeta,
      bin,
      border as unknown as BorderData,
      water as unknown as WaterData,
      rivers as unknown as RiversData,
      { meta: landcoverMeta as LandcoverMeta, classes: lc },
    );
  })();
  pending.catch(() => {
    pending = null;
  });
  return pending;
}
