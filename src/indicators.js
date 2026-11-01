// Индикаторы соперников за экраном: цветная стрелка у края экрана и ник.
// Элементы создаются один раз для каждой дыры и переиспользуются.
import * as THREE from 'three';

const v = new THREE.Vector3();
const PAD_X = 26; // отступ стрелки от левого/правого края
const PAD_TOP = 74; // сверху оставляем место под таймер и лидерборд
const PAD_BOTTOM = 30;

const hex = (c) => '#' + c.toString(16).padStart(6, '0');

export class Indicators {
  constructor(camera) {
    this.camera = camera;
    this.layer = document.getElementById('indicators');
    this.items = new Map(); // hole -> { el, arrow, name, halfW }
  }

  create(hole) {
    const el = document.createElement('div');
    el.className = 'indicator';
    el.style.setProperty('--c', hex(hole.color));
    const arrow = document.createElement('div');
    arrow.className = 'arrow';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = hole.name;
    el.append(arrow, name);
    this.layer.appendChild(el);
    const item = { el, arrow, name, halfW: name.offsetWidth / 2, shown: true };
    this.items.set(hole, item);
    return item;
  }

  // Убрать все индикаторы (новый раунд, меню)
  clear() {
    for (const it of this.items.values()) it.el.remove();
    this.items.clear();
  }

  hideAll() {
    for (const it of this.items.values()) this.toggle(it, false);
  }

  toggle(it, show) {
    if (it.shown === show) return;
    it.shown = show;
    it.el.style.display = show ? '' : 'none';
  }

  update(holes, player) {
    const cam = this.camera;
    cam.updateMatrixWorld();
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();

    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;
    const cy = (PAD_TOP + h - PAD_BOTTOM) / 2; // центр рабочей области экрана
    const hw = w / 2 - PAD_X;
    const hh = (h - PAD_BOTTOM - PAD_TOP) / 2;

    for (const hole of holes) {
      if (hole === player) continue;
      const it = this.items.get(hole) || this.create(hole);
      if (!hole.alive) {
        this.toggle(it, false);
        continue;
      }

      v.set(hole.position.x, 0.5, hole.position.z).project(cam);
      let sx = (v.x * 0.5 + 0.5) * w;
      let sy = (-v.y * 0.5 + 0.5) * h;
      if (v.z > 1) {
        // точка за камерой: зеркалим, чтобы стрелка смотрела в верную сторону
        sx = w - sx;
        sy = h - sy;
      }

      const dx = sx - cx;
      const dy = sy - cy;
      const onScreen = Math.abs(dx) < hw && Math.abs(dy) < hh && v.z <= 1;
      if (onScreen) {
        this.toggle(it, false);
        continue;
      }
      this.toggle(it, true);

      // Точка пересечения луча «центр → соперник» с рамкой экрана
      const k = Math.min(hw / (Math.abs(dx) || 1e-6), hh / (Math.abs(dy) || 1e-6));
      const ex = cx + dx * k;
      const ey = cy + dy * k;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;

      it.el.style.transform = `translate(${ex.toFixed(1)}px, ${ey.toFixed(1)}px)`;

      // Крупные соперники — опасные: стрелка больше
      const big = hole.radius > player.radius * 1.15;
      it.arrow.style.transform = `rotate(${Math.atan2(dy, dx)}rad) scale(${big ? 1.3 : 1})`;

      // Ник смещаем от стрелки внутрь экрана с учётом его ширины
      const ox = -ux * (24 + it.halfW * Math.abs(ux));
      const oy = -uy * (22 + 10 * Math.abs(uy));
      it.name.style.transform = `translate(calc(-50% + ${ox.toFixed(1)}px), calc(-50% + ${oy.toFixed(1)}px))`;
    }
  }
}
