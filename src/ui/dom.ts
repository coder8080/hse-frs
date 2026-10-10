// Мини-помощники для DOM без фреймворка.

type Attrs = Record<string, string | number | boolean | undefined | null>;
type Child = Node | string | null | undefined | false;

/** Создать элемент: h('div.ui-a.ui-b', {attrs}, ...children). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tagWithClasses: K | `${K}.${string}`,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const [tag, ...classes] = tagWithClasses.split('.');
  const el = document.createElement(tag as K);
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, ...children);
  return el;
}

export function append(el: Element, ...children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
}

/** Пользователь просит меньше движения. */
export function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Длительность переходов в мс (совпадает с --ui-fade в styles.css). */
export const FADE_MS = 220;

/**
 * Плавно показать/скрыть корневой элемент через data-state.
 * hidden ставится после окончания перехода, чтобы элемент не ловил клики.
 */
export function setShown(el: HTMLElement, shown: boolean): void {
  const timer = Number(el.dataset.hideTimer);
  if (timer) clearTimeout(timer);
  delete el.dataset.hideTimer;
  if (shown) {
    el.hidden = false;
    // кадр на применение hidden=false, затем запуск перехода
    void el.offsetWidth;
    el.dataset.state = 'open';
  } else {
    el.dataset.state = 'closed';
    const done = () => {
      el.hidden = true;
      delete el.dataset.hideTimer;
    };
    if (reducedMotion()) done();
    else el.dataset.hideTimer = String(setTimeout(done, FADE_MS + 20));
  }
}

/** Неразрывные пробелы: «30 %», «100 тыс.», «2,3 млрд т», «№ 3» не разрываются переносом строки. */
export function typo(s: string): string {
  // \b в JS не работает с кириллицей, поэтому конец слова — явный просмотр вперёд
  const end = '(?=[\\s,.;:)»]|$)';
  return s
    .replace(new RegExp(`(\\d) (?=%|‰|тыс\\.|млн${end}|млрд${end}|км|м${end}|т${end}|г\\.|год)`, 'g'), '$1\u00a0')
    .replace(/(№|ст\.) (?=\d)/g, '$1\u00a0')
    .replace(new RegExp(`(млн|млрд|тыс\\.) (?=т${end}|км|чел)`, 'g'), '$1\u00a0');
}

/** Автор и лицензия фото в одну строку. */
export function attributionText(p: { author: string; license: string }): string {
  return `Фото: ${[p.author, p.license].filter(Boolean).join(', ')}`;
}
