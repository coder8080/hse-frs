// Предзагрузка фото «Доклада» (R17): fetch без декодирования, ограниченная параллельность,
// общий таймаут. Ошибки не роняют загрузку — просто считаются выполненными.

export async function preloadPhotos(
  urls: string[],
  onProgress: (done: number, total: number) => void = () => {},
  timeoutMs = 10000,
  concurrency = 4,
): Promise<void> {
  const list = [...new Set(urls.filter(Boolean))];
  const total = list.length;
  let done = 0;
  onProgress(0, total);
  if (total === 0) return;

  const abort = typeof AbortController === 'function' ? new AbortController() : null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      abort?.abort();
      resolve();
    }, timeoutMs);
  });

  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const url = list[next++];
      try {
        const res = await fetch(url, { signal: abort?.signal });
        // дочитываем тело, чтобы файл целиком лёг в HTTP-кэш
        await res.arrayBuffer();
      } catch {
        // битое фото покажет заглушку (R18)
      }
      if (abort?.signal.aborted) return;
      done++;
      onProgress(done, total);
    }
  };

  const all = Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker)).then(() => {});
  await Promise.race([all, timeout]);
  clearTimeout(timer);
}
