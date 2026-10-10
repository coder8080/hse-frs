// Камера: исполняет полёты, мгновенные прыжки и «доводку» анимации до конца.
import * as THREE from 'three';
import { easeInOut, type Flight, type Viewpoint } from './flight';

export class CameraRig {
  private flight: Flight | null = null;
  private elapsed = 0;
  private speed = 1;
  private onDone: (() => void) | null = null;
  private readonly target = new THREE.Vector3();
  /** Лёгкое покачивание у остановки, чтобы диорама не выглядела застывшей. */
  private idleBase: Viewpoint | null = null;
  private idleT = 0;
  /** Покачивание выключается в «Путешествии», где камерой управляет пользователь */
  idleEnabled = true;

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  get flying(): boolean {
    return this.flight !== null;
  }

  /** Полёт; fast — быстрый перелёт 0,5 с (R3, «Назад»). */
  fly(flight: Flight, opts: { fast?: boolean; onDone?: () => void } = {}): void {
    this.flight = flight;
    this.elapsed = 0;
    this.speed = opts.fast ? flight.duration / 0.5 : 1;
    if (opts.fast) this.flight = { ...flight, hold: undefined };
    this.onDone = opts.onDone ?? null;
    this.idleBase = null;
  }

  /** Мгновенно поставить камеру (F5, Home, «нажатие во время полёта»). */
  jump(view: Viewpoint): void {
    this.flight = null;
    this.onDone = null;
    this.set(view.position, view.target);
    this.idleBase = { position: view.position.clone(), target: view.target.clone() };
    this.idleT = 0;
  }

  /** Довести текущий полёт до конца прямо сейчас. */
  finish(): void {
    if (!this.flight) return;
    const f = this.flight;
    this.set(f.position.getPoint(1), f.target.getPoint(1));
    this.complete(f);
  }

  update(dt: number): void {
    const f = this.flight;
    if (!f) {
      this.idle(dt);
      return;
    }
    this.elapsed += dt * this.speed;
    const hold = f.hold;
    const total = f.duration + (hold ? hold.seconds : 0);
    let u: number;
    if (!hold) {
      u = easeInOut(Math.min(1, this.elapsed / f.duration));
    } else {
      const t1 = f.duration * hold.at;
      const t2 = t1 + hold.seconds;
      if (this.elapsed < t1) u = hold.at * easeInOut(this.elapsed / t1);
      else if (this.elapsed < t2) u = hold.at;
      else u = hold.at + (1 - hold.at) * easeInOut(Math.min(1, (this.elapsed - t2) / (f.duration - t1)));
    }
    this.set(f.position.getPoint(u), f.target.getPoint(u));
    if (this.elapsed >= total) this.complete(f);
  }

  private complete(f: Flight): void {
    const done = this.onDone;
    this.flight = null;
    this.onDone = null;
    this.idleBase = { position: f.position.getPoint(1), target: f.target.getPoint(1) };
    this.idleT = 0;
    done?.();
  }

  private idle(dt: number): void {
    if (!this.idleBase || !this.idleEnabled) return;
    this.idleT += dt;
    // медленный облёт: ±3° вокруг точки взгляда
    const a = Math.sin(this.idleT * 0.15) * 0.05;
    const { position, target } = this.idleBase;
    const off = position.clone().sub(target);
    off.applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
    this.set(target.clone().add(off), target);
  }

  private set(position: THREE.Vector3, target: THREE.Vector3): void {
    this.camera.position.copy(position);
    this.target.copy(target);
    this.camera.lookAt(this.target);
  }
}
