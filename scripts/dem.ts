// Рельеф: тайлы Copernicus GLO-30 (публичный AWS-бакет, без ключа) → регулярная сетка lat/lon в BBOX.
//
//   npm run data:dem
//
// Берём обзорный уровень COG (~120 м), кэшируем его в .cache/dem/ и усредняем окном ячейки.
// Результат: data/terrain.bin (Int16 LE, метры, строки с севера на юг) + data/terrain.json.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromUrl } from 'geotiff';
import { BBOX, KM_PER_DEG_LAT, KM_PER_DEG_LON } from '../src/geo.ts';
import { writeAttribution } from './lib/attribution.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.cache', 'dem');
const DATA = join(ROOT, 'data');

/** Ширина сетки в отсчётах; высота подбирается так, чтобы ячейка была квадратной в км. */
const GRID_W = 640;
/** Номер обзорного уровня COG: 0 — 30 м, 1 — 60 м, 2 — 120 м, 3 — 240 м. */
const OVERVIEW = 2;

interface Tile {
  w: number;
  h: number;
  data: Float32Array;
}

function tileName(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  const la = String(Math.abs(lat)).padStart(2, '0');
  const lo = String(Math.abs(lon)).padStart(3, '0');
  return `Copernicus_DSM_COG_10_${ns}${la}_00_${ew}${lo}_00_DEM`;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** Тайл с юго-западным углом (lat, lon); null — тайла нет (вода/вне покрытия). */
async function loadTile(lat: number, lon: number): Promise<Tile | null> {
  const name = tileName(lat, lon);
  const cached = join(CACHE, `${name}.ov${OVERVIEW}.bin`);
  const none = join(CACHE, `${name}.none`);
  if (await exists(none)) return null;
  if (await exists(cached)) {
    const buf = await readFile(cached);
    const w = buf.readUInt32LE(0);
    const h = buf.readUInt32LE(4);
    const data = new Float32Array(buf.buffer.slice(buf.byteOffset + 8, buf.byteOffset + 8 + w * h * 4));
    return { w, h, data };
  }
  const url = `https://copernicus-dem-30m.s3.amazonaws.com/${name}/${name}.tif`;
  const head = await fetch(url, { method: 'HEAD' });
  if (head.status === 404 || head.status === 403) {
    console.log(`  ${name}: нет тайла (${head.status})`);
    await writeFile(none, '');
    return null;
  }
  if (!head.ok) throw new Error(`${name}: HTTP ${head.status}`);
  const tiff = await fromUrl(url);
  const count = await tiff.getImageCount();
  const img = await tiff.getImage(Math.min(OVERVIEW, count - 1));
  const w = img.getWidth();
  const h = img.getHeight();
  const rasters = await img.readRasters({ samples: [0] });
  const data = Float32Array.from(rasters[0] as ArrayLike<number>);
  const out = Buffer.alloc(8 + w * h * 4);
  out.writeUInt32LE(w, 0);
  out.writeUInt32LE(h, 4);
  Buffer.from(data.buffer).copy(out, 8);
  await writeFile(cached, out);
  console.log(`  ${name}: ${w}×${h}`);
  return { w, h, data };
}

async function main(): Promise<void> {
  await mkdir(CACHE, { recursive: true });
  await mkdir(DATA, { recursive: true });

  const lat0 = Math.floor(BBOX.south);
  const lat1 = Math.floor(BBOX.north);
  const lon0 = Math.floor(BBOX.west);
  const lon1 = Math.floor(BBOX.east);
  const tiles = new Map<string, Tile | null>();
  console.log(`Тайлы N${lat0}–N${lat1} × E${lon0}–E${lon1}`);
  for (let la = lat0; la <= lat1; la++) {
    for (let lo = lon0; lo <= lon1; lo++) {
      tiles.set(`${la},${lo}`, await loadTile(la, lo));
    }
  }

  const widthKm = (BBOX.east - BBOX.west) * KM_PER_DEG_LON;
  const heightKm = (BBOX.north - BBOX.south) * KM_PER_DEG_LAT;
  const W = GRID_W;
  const H = Math.round((W * heightKm) / widthKm);
  const dLon = (BBOX.east - BBOX.west) / (W - 1);
  const dLat = (BBOX.north - BBOX.south) / (H - 1);

  /** Среднее высот тайлов в прямоугольнике [la-hl, la+hl] × [lo-hw, lo+hw]. */
  function boxMean(la: number, lo: number): number {
    let sum = 0;
    let n = 0;
    const steps = 4;
    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < steps; j++) {
        const sla = la + ((i + 0.5) / steps - 0.5) * dLat;
        const slo = lo + ((j + 0.5) / steps - 0.5) * dLon;
        const t = tiles.get(`${Math.floor(sla)},${Math.floor(slo)}`);
        if (!t) continue;
        // пиксели тайла: строка 0 — северный край
        const fx = (slo - Math.floor(slo)) * t.w;
        const fy = (Math.floor(sla) + 1 - sla) * t.h;
        const x = Math.min(t.w - 1, Math.max(0, Math.floor(fx)));
        const y = Math.min(t.h - 1, Math.max(0, Math.floor(fy)));
        const v = t.data[y * t.w + x];
        if (!Number.isFinite(v) || v < -500) continue;
        sum += v;
        n++;
      }
    }
    return n ? sum / n : NaN;
  }

  const grid = new Int16Array(W * H);
  let minE = Infinity;
  let maxE = -Infinity;
  let missing = 0;
  for (let r = 0; r < H; r++) {
    const la = BBOX.north - r * dLat;
    for (let c = 0; c < W; c++) {
      const lo = BBOX.west + c * dLon;
      let v = boxMean(la, lo);
      if (!Number.isFinite(v)) {
        v = 0;
        missing++;
      }
      const m = Math.round(v);
      grid[r * W + c] = m;
      if (m < minE) minE = m;
      if (m > maxE) maxE = m;
    }
  }

  await writeFile(join(DATA, 'terrain.bin'), Buffer.from(grid.buffer));
  const meta = {
    width: W,
    height: H,
    bbox: BBOX,
    minElev: minE,
    maxElev: maxE,
    format: 'int16le, метры над уровнем моря, строки с севера на юг, столбцы с запада на восток; узлы сетки лежат на краях bbox',
    source: `Copernicus GLO-30 DSM, обзорный уровень ${OVERVIEW}, усреднение по ячейке`,
  };
  await writeFile(join(DATA, 'terrain.json'), JSON.stringify(meta, null, 2) + '\n');
  await writeAttribution('dem', {
    source: 'Copernicus DEM GLO-30 (AWS Open Data, s3://copernicus-dem-30m)',
    license: 'Copernicus DEM licence (бесплатное использование с указанием источника)',
    notice:
      '© DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018 provided under COPERNICUS by the European Union and ESA; all rights reserved. Produced using Copernicus WorldDEM-30.',
    url: 'https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model',
  });
  console.log(`terrain: ${W}×${H}, ${minE}…${maxE} м, без данных: ${missing}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
