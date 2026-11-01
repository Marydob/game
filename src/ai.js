// Боты: каждый раз «думают» 3–5 раз в секунду.
// Приоритеты: 1) убежать от крупной дыры, 2) догнать более мелкую, 3) съесть лучший объект рядом, 4) бродить.
import { EAT_SIZE } from './absorb.js';

export const BOT_NAMES = [
  'Gumby Train', 'Reno Monar', 'CosPlatoo', 'Bibi', 'IceDog', 'Sir Shove', 'Ronja',
  'Mr Void', 'Pixel', 'Tornado', 'Kuro', 'Zefir', 'Moka', 'Black Fox',
];

export class BotBrain {
  constructor() {
    this.timer = Math.random() * 0.3; // боты думают не синхронно
    this.move = { x: 0, z: 0 };
    this.wander = null; // точка, к которой бот бродит, пока нечего есть
    this.aggression = 0.5 + Math.random() * 0.5; // шанс начать охоту на мелкую дыру
  }

  reset() {
    this.timer = 0;
    this.wander = null;
  }

  update(dt, hole, holes, absorber, half) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.2 + Math.random() * 0.25;
      this.think(hole, holes, absorber, half);
    }
    return this.move;
  }

  steer(px, pz, tx, tz) {
    const dx = tx - px;
    const dz = tz - pz;
    const d = Math.hypot(dx, dz);
    if (d < 0.5) {
      this.move = { x: 0, z: 0 };
    } else {
      this.move = { x: dx / d, z: dz / d };
    }
  }

  think(hole, holes, absorber, half) {
    const px = hole.position.x;
    const pz = hole.position.z;

    // 1. Бегство от крупных дыр (чем ближе угроза, тем сильнее отталкивание)
    let fx = 0;
    let fz = 0;
    let threatened = false;
    for (const o of holes) {
      if (o === hole || !o.alive) continue;
      const dx = o.position.x - px;
      const dz = o.position.z - pz;
      const d = Math.hypot(dx, dz) || 0.01;
      if (o.radius > hole.radius * 1.12 && d < o.radius * 2 + 16) {
        fx -= dx / d / (d + 2);
        fz -= dz / d / (d + 2);
        threatened = true;
      }
    }
    if (threatened) {
      // Подталкиваем к центру карты, чтобы не загнали в угол
      const edge = half - 20;
      if (Math.abs(px) > edge) fx -= Math.sign(px) * 0.03;
      if (Math.abs(pz) > edge) fz -= Math.sign(pz) * 0.03;
      const l = Math.hypot(fx, fz) || 1;
      this.move = { x: fx / l, z: fz / l };
      return;
    }

    // 2. Охота на более мелкую дыру
    let prey = null;
    let preyDist = 1e9;
    for (const o of holes) {
      if (o === hole || !o.alive || hole.radius < o.radius * 1.2) continue;
      const d = Math.hypot(o.position.x - px, o.position.z - pz);
      if (d < 30 + hole.radius * 2 && d < preyDist) {
        prey = o;
        preyDist = d;
      }
    }
    if (prey && Math.random() < this.aggression) {
      this.steer(px, pz, prey.position.x, prey.position.z);
      return;
    }

    // 3. Самый выгодный съедобный объект рядом
    const maxSize = hole.radius * 2 * EAT_SIZE * 0.97;
    const target = absorber.nearest(px, pz, maxSize, 22 + hole.radius * 3);
    if (target) {
      this.steer(px, pz, target.position.x, target.position.z);
      return;
    }

    // 4. Бродим по карте
    if (!this.wander || Math.hypot(this.wander.x - px, this.wander.z - pz) < 5) {
      const lim = half - 20;
      this.wander = { x: (Math.random() * 2 - 1) * lim, z: (Math.random() * 2 - 1) * lim };
    }
    this.steer(px, pz, this.wander.x, this.wander.z);
  }
}
