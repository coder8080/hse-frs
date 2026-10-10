// Общая запись data/ATTRIBUTION.json: каждый скрипт данных дописывает свой раздел.
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'ATTRIBUTION.json');

export interface AttributionEntry {
  source: string;
  license: string;
  /** Обязательный текст уведомления. */
  notice: string;
  url: string;
}

export async function writeAttribution(key: string, entry: AttributionEntry): Promise<void> {
  let all: Record<string, AttributionEntry> = {};
  try {
    all = JSON.parse(await readFile(FILE, 'utf8'));
  } catch {
    // файла ещё нет
  }
  all[key] = entry;
  await writeFile(FILE, JSON.stringify(all, null, 2) + '\n');
}
