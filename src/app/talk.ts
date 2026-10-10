// Режим «Доклад»: машина состояний (R2) + клавиши/кликер/касания + исполнение эффектов.
import { renderSVG } from 'uqr';
import type { RouteData } from '../content-types';
import { attachTalkInput } from '../talk/input';
import { initialState, reduce, toStopInfos } from '../talk/machine';
import { parseHash, writeHash } from '../talk/hash';
import { preloadPhotos } from '../talk/preload';
import type { Effect, TalkEvent, TalkState } from '../talk/types';
import { BlackScreen, Card, FlightLabel, PreloadBar, Slideshow } from '../ui';
import { PUBLIC_URL } from './attribution';
import type { Stage } from './stage';

export interface TalkHandle {
  /** Для e2e и отладки: текущее состояние машины */
  readonly state: TalkState;
  dispatch(e: TalkEvent): void;
}

export function startTalk(route: RouteData, stage: Stage): TalkHandle {
  const stops = route.stops;
  const infos = toStopInfos(stops);
  const last = stops.length - 1;
  let state = initialState(infos);
  /** Остановка, у которой сейчас камера (откуда строить полёт) */
  let cameraAt = 0;

  const slideshow = new Slideshow({
    variant: 'talk',
    onOpen: () => stage.setPaused(true),
    onClose: () => stage.setPaused(false),
  });
  const card = new Card();
  const flight = new FlightLabel();
  const black = new BlackScreen();
  const qr = createQr();
  const cover = createCover(route);

  const label = (i: number) => `Остановка ${i} из ${last}`;

  function run(e: Effect): void {
    switch (e.type) {
      case 'flyTo': {
        const back = e.stopIndex < cameraAt;
        flight.show(stops[e.stopIndex].title, back ? 'Возвращаемся' : 'Следующая остановка');
        const from = cameraAt;
        cameraAt = e.stopIndex;
        stage.flyTo(from, e.stopIndex, {
          fast: e.fast,
          onDone: () => {
            flight.hide();
            dispatch({ type: 'animationDone' });
          },
        });
        break;
      }
      case 'finishAnimation':
        stage.finishFlight();
        break;
      case 'jumpTo':
        cameraAt = e.stopIndex;
        flight.hide();
        stage.jumpTo(e.stopIndex);
        break;
      case 'openSlideshow':
        slideshow.open(stops[e.stopIndex], e.photoIndex, { label: label(e.stopIndex) });
        break;
      case 'showPhoto':
        slideshow.showPhoto(e.photoIndex);
        break;
      case 'showCard':
        card.show(stops[e.stopIndex], { label: label(e.stopIndex) });
        break;
      case 'closeOverlay':
        slideshow.close();
        card.hide();
        break;
    }
  }

  // События, пришедшие во время исполнения эффектов (finishFlight → animationDone), идут в очередь
  const queue: TalkEvent[] = [];
  let running = false;
  function dispatch(e: TalkEvent): void {
    queue.push(e);
    if (running) return;
    running = true;
    try {
      while (queue.length) {
        const ev = queue.shift()!;
        const t = reduce(state, ev, infos);
        state = t.state;
        t.effects.forEach(run);
      }
    } finally {
      running = false;
    }
    writeHash(state);
    // QR — внизу этикетки финальной остановки (панель перерисовывается при открытии, поэтому вставляем каждый раз)
    const qrOn = state.stopIndex === last && state.phase !== 'flying';
    const panel = slideshow.el.querySelector('.ui-ss__panel');
    if (qrOn && panel && qr.el.parentElement !== panel) {
      panel.insertBefore(qr.el, panel.querySelector('.ui-ss__count'));
      slideshow.fitPanel();
    }
    qr.toggle(qrOn);
    document.body.dataset.talk = `${state.stopIndex}:${state.photoIndex}:${state.phase}`;
  }

  // Обложка: показывается при старте без хэша; первое «Вперёд» открывает остановку 0
  let coverOn = !location.hash;
  function input(e: TalkEvent): void {
    if (coverOn) {
      if (e.type === 'forward') {
        coverOn = false;
        cover.hide();
        dispatch({ type: 'restore', stopIndex: 0, photoIndex: 0 });
      }
      return;
    }
    if (e.type === 'back' && state.stopIndex === 0 && state.photoIndex === 0 && state.phase !== 'flying') {
      coverOn = true;
      slideshow.close();
      stage.jumpTo(0);
      cover.show();
      history.replaceState(null, '', location.pathname + location.search);
      return;
    }
    if (e.type === 'home') {
      coverOn = false;
      cover.hide();
    }
    dispatch(e);
  }

  attachTalkInput(window, input, { onBlack: () => black.toggle() });

  stage.setFreeCamera(false);
  stage.setLabels(false);
  if (coverOn) {
    stage.jumpTo(0);
    cover.show();
  } else {
    dispatch({ type: 'restore', ...parseHash(location.hash, infos) });
  }

  // Предзагрузка всех фото доклада (R17): полоска не мешает начать говорить
  const urls = stops.flatMap((s) => s.talkPhotos.map((p) => p.src));
  const bar = new PreloadBar();
  bar.show();
  preloadPhotos(urls, (done, total) => bar.update(done, total)).finally(() => setTimeout(() => bar.hide(), 1200));

  return {
    get state() {
      return state;
    },
    dispatch: input,
  };
}

function createCover(route: RouteData) {
  const el = document.createElement('div');
  el.className = 'app-cover';
  el.hidden = true;
  el.innerHTML = `<div class="app-cover__inner">
      <p class="app-cover__kicker">Историко-культурный маршрут</p>
      <h1></h1>
      <p class="app-cover__sub"></p>
      <div class="app-cover__foot">
        <span>НИУ ВШЭ</span><span>Основы российской государственности</span><span>→ / PageDown — начать</span>
      </div>
    </div>`;
  el.querySelector('h1')!.textContent = route.title;
  el.querySelector('.app-cover__sub')!.textContent = route.subtitle ?? '';
  document.body.append(el);
  return {
    show: () => (el.hidden = false),
    hide: () => (el.hidden = true),
  };
}

/** QR со ссылкой на сайт — на финальной остановке, внутри этикетки. */
function createQr() {
  const el = document.createElement('figure');
  el.className = 'app-qr';
  el.hidden = true;
  el.innerHTML = renderSVG(PUBLIC_URL, { border: 1 });
  const cap = document.createElement('figcaption');
  cap.innerHTML = '<span>Маршрут онлайн</span>';
  cap.append(PUBLIC_URL.replace(/^https:\/\//, ''));
  el.append(cap);
  document.body.append(el);
  return { el, toggle: (on: boolean) => (el.hidden = !on) };
}
