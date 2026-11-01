// Управление: WASD/стрелки, мышь (дыра идёт к курсору) и виртуальный джойстик на сенсорных экранах.
// getMove() всегда возвращает {x, z} длиной 0..1 в мировых осях (вверх по экрану = -Z).

const STICK_MAX = 60; // радиус хода джойстика, px
const STICK_DEAD = 8; // мёртвая зона джойстика, px
const MOUSE_DEAD = 30; // мёртвая зона у центра экрана для мыши, px

export class Input {
  constructor() {
    this.keys = new Set();
    this.mouse = null; // {x, y} позиция курсора, пока он в окне
    this.stick = null; // {id, ox, oy, x, y} активный джойстик
    this.enabled = true; // в меню и на экране итогов управление выключено

    // Элементы виртуального джойстика
    this.base = document.createElement('div');
    this.base.className = 'joy-base hidden';
    this.knob = document.createElement('div');
    this.knob.className = 'joy-knob hidden';
    document.body.append(this.base, this.knob);

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse = null;
    });
    document.addEventListener('mouseleave', () => (this.mouse = null));

    window.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
  }

  onDown(e) {
    if (!this.enabled || e.pointerType === 'mouse') return;
    if (this.stick) return; // джойстик уже занят первым пальцем
    this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
    this.base.style.left = e.clientX + 'px';
    this.base.style.top = e.clientY + 'px';
    this.base.classList.remove('hidden');
    this.knob.classList.remove('hidden');
    this.moveKnob();
  }

  onMove(e) {
    if (e.pointerType === 'mouse') {
      this.mouse = { x: e.clientX, y: e.clientY };
      return;
    }
    if (this.stick && this.stick.id === e.pointerId) {
      this.stick.x = e.clientX;
      this.stick.y = e.clientY;
      this.moveKnob();
    }
  }

  onUp(e) {
    if (this.stick && this.stick.id === e.pointerId) {
      this.stick = null;
      this.base.classList.add('hidden');
      this.knob.classList.add('hidden');
    }
  }

  setEnabled(v) {
    this.enabled = v;
    this.keys.clear();
    if (!v && this.stick) {
      this.stick = null;
      this.base.classList.add('hidden');
      this.knob.classList.add('hidden');
    }
  }

  moveKnob() {
    const s = this.stick;
    let dx = s.x - s.ox;
    let dy = s.y - s.oy;
    const len = Math.hypot(dx, dy);
    if (len > STICK_MAX) {
      dx = (dx / len) * STICK_MAX;
      dy = (dy / len) * STICK_MAX;
    }
    this.knob.style.left = s.ox + dx + 'px';
    this.knob.style.top = s.oy + dy + 'px';
  }

  getMove() {
    if (!this.enabled) return { x: 0, z: 0 };
    const k = this.keys;
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let z = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    if (x || z) {
      const l = Math.hypot(x, z);
      return { x: x / l, z: z / l };
    }

    if (this.stick) {
      const dx = this.stick.x - this.stick.ox;
      const dy = this.stick.y - this.stick.oy;
      const len = Math.hypot(dx, dy);
      if (len < STICK_DEAD) return { x: 0, z: 0 };
      const mag = Math.min(len / STICK_MAX, 1);
      return { x: (dx / len) * mag, z: (dy / len) * mag };
    }

    if (this.mouse) {
      // Дыра всегда в центре экрана, поэтому направление — от центра к курсору
      const dx = this.mouse.x - window.innerWidth / 2;
      const dy = this.mouse.y - window.innerHeight / 2;
      const len = Math.hypot(dx, dy);
      if (len < MOUSE_DEAD) return { x: 0, z: 0 };
      const full = Math.min(window.innerWidth, window.innerHeight) * 0.3;
      const mag = Math.min((len - MOUSE_DEAD) / (full - MOUSE_DEAD), 1);
      return { x: (dx / len) * mag, z: (dy / len) * mag };
    }

    return { x: 0, z: 0 };
  }
}
