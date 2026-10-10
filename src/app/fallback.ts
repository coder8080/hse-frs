// Лёгкая HTML-версия без WebGL: все остановки с фото и текстами из тех же Markdown-файлов.
// Не тянет three.js — грузится, даже если 3D недоступно.
import type { RouteData, StopData } from '../content-types';
import { DATA_ATTRIBUTION } from './attribution';
import '../ui/fonts.css';
import './fallback.css';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function stopSection(stop: StopData, n: number): HTMLElement {
  const s = el('section', 'fb-stop');
  s.id = stop.slug;
  const head = el('header', 'fb-head');
  head.append(el('span', 'fb-num', String(n)), el('h2', '', stop.title));
  if (stop.subtitle) head.append(el('p', 'fb-sub', stop.subtitle));
  s.append(head);
  if (stop.link) s.append(el('p', 'fb-link', stop.link));
  const gallery = el('div', 'fb-gallery');
  for (const p of stop.photos) {
    const fig = el('figure');
    const img = el('img');
    img.src = p.src;
    img.alt = p.caption;
    img.loading = 'lazy';
    img.width = p.width;
    img.height = p.height;
    img.onerror = () => fig.classList.add('broken');
    const cap = el('figcaption');
    cap.append(el('span', '', p.caption), el('small', '', `Фото: ${p.author}, ${p.license}`));
    fig.append(img, cap);
    gallery.append(fig);
  }
  s.append(gallery);
  const body = el('div', 'fb-body');
  body.innerHTML = stop.html;
  s.append(body);
  s.append(sourcesList(stop));
  return s;
}

function sourcesList(stop: StopData): HTMLElement {
  const box = el('details', 'fb-sources');
  box.append(el('summary', '', 'Источники'));
  const ul = el('ul');
  for (const src of stop.sources) {
    const li = el('li');
    if (src.url) {
      const a = el('a', '', src.title);
      a.href = src.url;
      a.target = '_blank';
      a.rel = 'noopener';
      li.append(a);
    } else li.textContent = src.title;
    ul.append(li);
  }
  box.append(ul);
  return box;
}

export function renderFallback(root: HTMLElement, route: RouteData, reason: string): void {
  root.innerHTML = '';
  const page = el('main', 'fb');
  const hero = el('header', 'fb-hero');
  hero.append(el('h1', '', route.title));
  if (route.subtitle) hero.append(el('p', 'fb-lead', route.subtitle));
  hero.append(el('p', 'fb-note', reason));
  const nav = el('nav', 'fb-nav');
  route.stops.forEach((s, i) => {
    const a = el('a', '', `${i}. ${s.title}`);
    a.href = `#${s.slug}`;
    nav.append(a);
  });
  hero.append(nav);
  page.append(hero);
  route.stops.forEach((s, i) => page.append(stopSection(s, i)));
  const foot = el('footer', 'fb-foot');
  foot.append(el('p', '', DATA_ATTRIBUTION));
  page.append(foot);
  root.append(page);
}
