// Выбор режима: ?mode= в URL всегда главнее; без параметра — «Путешествие» (и на телефоне, и на десктопе).
export type Mode = 'talk' | 'tour';

export function chooseMode(search: string): Mode {
  const m = new URLSearchParams(search).get('mode');
  return m === 'talk' ? 'talk' : 'tour';
}

/** URL для переключения режима с сохранением остальных параметров (например, ?debug). */
export function modeUrl(href: string, mode: Mode): string {
  const u = new URL(href);
  u.searchParams.set('mode', mode);
  u.hash = '';
  return u.toString();
}

export function hasWebGL(doc: Document = document): boolean {
  try {
    const c = doc.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
