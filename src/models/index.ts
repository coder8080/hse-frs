// Реестр миниатюр остановок: slug → процедурная модель (модельные единицы, см. geo.ts).
import type { Miniature } from './kit';
import { buildPlaceholder } from './placeholder';
import { buildBolgar } from './bolgar';
import { buildSviyazhsk } from './sviyazhsk';
import { buildKazanKremlin } from './kazan-kremlin';
import { buildStaroTatarskayaSloboda } from './staro-tatarskaya-sloboda';
import { buildRaifa } from './raifa';
import { buildVolgaKama } from './volga-kama';
import { buildChistopol } from './chistopol';
import { buildNizhnekamsk } from './nizhnekamsk';
import { buildElabuga } from './elabuga';
import { buildNaberezhnyeChelny } from './naberezhnye-chelny';
import { buildAlmetyevsk } from './almetyevsk';
import { buildInnopolis } from './innopolis';

export type { Miniature } from './kit';
export { MINIATURE_MATERIAL } from './kit';

const BUILDERS: Record<string, () => Miniature> = {
  bolgar: buildBolgar,
  sviyazhsk: buildSviyazhsk,
  'kazan-kremlin': buildKazanKremlin,
  'staro-tatarskaya-sloboda': buildStaroTatarskayaSloboda,
  raifa: buildRaifa,
  'volga-kama': buildVolgaKama,
  chistopol: buildChistopol,
  nizhnekamsk: buildNizhnekamsk,
  elabuga: buildElabuga,
  'naberezhnye-chelny': buildNaberezhnyeChelny,
  almetyevsk: buildAlmetyevsk,
  innopolis: buildInnopolis,
};

/** Slug-и остановок в порядке маршрута. */
export const MINIATURE_SLUGS: string[] = Object.keys(BUILDERS);

/** Собрать миниатюру; для неизвестного slug — нейтральный обелиск. */
export function buildMiniature(slug: string): Miniature {
  return (BUILDERS[slug] ?? buildPlaceholder)();
}
