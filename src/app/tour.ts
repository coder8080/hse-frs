// Режим «Путешествие»: свободная карта, список остановок, полное слайдшоу у каждой остановки.
import type { RouteData } from '../content-types';
import { Slideshow } from '../ui';
import { modeUrl } from './mode';
import { openSources } from './sources';
import type { Stage } from './stage';

export function startTour(route: RouteData, stage: Stage, opts: { phone: boolean }): void {
  const stops = route.stops;
  let current = -1;
  let cameraAt = 0;

  const slideshow = new Slideshow({
    variant: 'tour',
    onOpen: () => stage.setPaused(true),
    onClose: () => stage.setPaused(false),
    onRequestClose: () => {
      slideshow.close();
      stage.setFreeCamera(true);
    },
    onStopNav: (dir) => go(current + dir),
  });

  const panel = document.createElement('nav');
  panel.className = 'app-tour';
  panel.innerHTML = `<header class="app-tour__head">
      <h1></h1><p></p>
    </header>
    <ol class="app-tour__list"></ol>
    <div class="app-tour__actions">
      <button type="button" class="app-btn app-btn--primary" data-act="talk">Начать презентацию</button>
      <button type="button" class="app-btn" data-act="sources">Источники</button>
    </div>`;
  panel.querySelector('h1')!.textContent = route.title;
  panel.querySelector('p')!.textContent = route.subtitle ?? '';
  const list = panel.querySelector('ol')!;
  stops.forEach((s, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.stop = String(i);
    b.innerHTML = `<span class="app-tour__num">${i}</span><span class="app-tour__title"></span><span class="app-tour__card"></span>`;
    b.querySelector('.app-tour__title')!.textContent = s.title;
    b.querySelector('.app-tour__card')!.textContent = s.card;
    b.addEventListener('click', () => {
      panel.classList.remove('is-open');
      go(i);
    });
    li.append(b);
    list.append(li);
  });
  const talkBtn = panel.querySelector<HTMLButtonElement>('[data-act="talk"]')!;
  talkBtn.hidden = opts.phone;
  talkBtn.addEventListener('click', () => location.assign(modeUrl(location.href, 'talk')));
  panel.querySelector('[data-act="sources"]')!.addEventListener('click', () => openSources(route));
  document.body.append(panel);

  // на телефоне список — выезжающая шторка
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'app-btn app-tour__toggle';
  toggle.textContent = 'Остановки';
  toggle.addEventListener('click', () => panel.classList.toggle('is-open'));
  document.body.append(toggle);

  function mark(i: number) {
    list.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', Number(b.dataset.stop) === i));
  }

  function go(i: number): void {
    if (i < 0 || i >= stops.length) return;
    current = i;
    mark(i);
    slideshow.close();
    stage.setFreeCamera(false);
    const open = () => {
      slideshow.open(stops[i], 0, {
        label: `Остановка ${i} · ${stops[i].category}`,
        prevTitle: stops[i - 1]?.title,
        nextTitle: stops[i + 1]?.title,
      });
    };
    if (cameraAt === i && !stage.flying) {
      stage.jumpTo(i);
      open();
      return;
    }
    const from = cameraAt;
    cameraAt = i;
    stage.flyTo(from, i, { onDone: open });
  }

  stage.onPick((i) => go(i));
  stage.jumpTo(0);
  stage.setLabels(true);
  stage.setFreeCamera(true);
}
