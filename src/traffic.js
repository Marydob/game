// Движущийся мир: машины едут по полосам, пешеходы гуляют по кварталам и убегают от дыр
import { CELL } from './world.js';

const CAR_SPEED = 7; // одинаковая скорость на всех полосах — машины не наезжают друг на друга
const WALK_SPEED = 1.5;
const RUN_SPEED = 5.5;
const BLOCK_LIMIT = 18.5; // насколько далеко от центра квартала могут гулять люди

export class Traffic {
  constructor(absorber, mapHalf) {
    this.absorber = absorber;
    this.edge = mapHalf - 3;
  }

  update(dt, holes) {
    for (const o of this.absorber.dynamic) {
      if (o.userData.kind === 'person') this.walk(o, dt, holes);
      else this.drive(o, dt);
    }
  }

  // Машина едет прямо по курсу; доехав до края карты, появляется с противоположной стороны
  drive(o, dt) {
    const h = o.userData.heading;
    const p = o.position;
    p.x += Math.sin(h) * CAR_SPEED * dt;
    p.z += Math.cos(h) * CAR_SPEED * dt;
    const e = this.edge;
    if (p.x > e) p.x = -e;
    else if (p.x < -e) p.x = e;
    if (p.z > e) p.z = -e;
    else if (p.z < -e) p.z = e;
  }

  walk(o, dt, holes) {
    const u = o.userData;
    const p = o.position;
    let w = u.walk;
    if (!w) {
      // Квартал, в котором живёт человек (центры кварталов кратны CELL)
      w = u.walk = {
        cx: Math.round(p.x / CELL) * CELL,
        cz: Math.round(p.z / CELL) * CELL,
        heading: u.heading,
        timer: 0,
      };
    }

    // Убегаем от близких дыр
    let fx = 0;
    let fz = 0;
    let flee = false;
    for (const h of holes) {
      const dx = p.x - h.position.x;
      const dz = p.z - h.position.z;
      const lim = h.radius * 2.2 + 6;
      const d2 = dx * dx + dz * dz;
      if (d2 < lim * lim) {
        const d = Math.sqrt(d2) || 0.01;
        fx += dx / d;
        fz += dz / d;
        flee = true;
      }
    }

    let speed = WALK_SPEED;
    if (flee) {
      w.heading = Math.atan2(fx, fz);
      speed = RUN_SPEED;
    } else {
      w.timer -= dt;
      if (w.timer <= 0) {
        w.timer = 1.5 + Math.random() * 3;
        w.heading += (Math.random() - 0.5) * 2.4;
      }
    }

    p.x += Math.sin(w.heading) * speed * dt;
    p.z += Math.cos(w.heading) * speed * dt;

    // Не выходим за пределы своего квартала: если упёрлись — поворачиваем к центру
    if (Math.abs(p.x - w.cx) > BLOCK_LIMIT || Math.abs(p.z - w.cz) > BLOCK_LIMIT) {
      p.x = Math.max(w.cx - BLOCK_LIMIT, Math.min(w.cx + BLOCK_LIMIT, p.x));
      p.z = Math.max(w.cz - BLOCK_LIMIT, Math.min(w.cz + BLOCK_LIMIT, p.z));
      w.heading = Math.atan2(w.cx - p.x, w.cz - p.z);
    }
    o.rotation.y = w.heading;
  }
}
