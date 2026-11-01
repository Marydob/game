// Поглощение объектов: пространственная сетка + анимация падения в дыру.
// Правило: объект съедается, если его центр внутри дыры и его размер ≤ 80% диаметра дыры.
// Движущиеся объекты (машины, автобусы, люди) в сетке не хранятся — они лежат в списке dynamic.
import * as THREE from 'three';

const CELL = 8; // размер ячейки сетки
export const EAT_SIZE = 0.8; // доля диаметра дыры, которую можно съесть
const REACH = 0.92; // центр объекта должен быть внутри этой доли радиуса
const DYNAMIC = new Set(['car', 'bus', 'person']);

const key = (cx, cz) => cx * 4096 + cz;
const axis = new THREE.Vector3();
const tilt = new THREE.Quaternion();

export class Absorber {
  constructor(world) {
    this.root = world.root;
    this.grid = new Map(); // ячейка -> массив неподвижных объектов
    this.items = []; // все съедобные объекты (для сброса раунда)
    this.dynamic = []; // движущиеся объекты
    this.falling = []; // объекты, которые сейчас падают

    const box = new THREE.Box3();
    for (const obj of world.objects) {
      obj.updateWorldMatrix(true, true);
      box.setFromObject(obj);
      obj.userData.height = Math.max(0.5, box.max.y); // высота верха над землёй
      obj.userData.heading = obj.rotation.y; // курс (из кватерниона угол восстанавливается неоднозначно)
      obj.userData.home = {
        pos: obj.position.clone(),
        quat: obj.quaternion.clone(),
        scale: obj.scale.clone(),
      };
      this.items.push(obj);
      // Неподвижные объекты «замораживаем»: их матрицы не пересчитываются каждый кадр
      if (!DYNAMIC.has(obj.userData.kind)) this.freeze(obj);
      this.register(obj);
    }
  }

  freeze(o) {
    o.traverse((c) => {
      c.matrixAutoUpdate = false;
      c.updateMatrix();
    });
  }

  register(o) {
    if (DYNAMIC.has(o.userData.kind)) this.dynamic.push(o);
    else this.insert(o);
  }

  insert(o) {
    const k = key(Math.floor(o.position.x / CELL), Math.floor(o.position.z / CELL));
    let cell = this.grid.get(k);
    if (!cell) {
      cell = [];
      this.grid.set(k, cell);
    }
    cell.push(o);
  }

  // Вернуть все объекты на места (новый раунд)
  reset() {
    this.falling.length = 0;
    this.grid.clear();
    this.dynamic.length = 0;
    for (const o of this.items) {
      const h = o.userData.home;
      o.position.copy(h.pos);
      o.quaternion.copy(h.quat);
      o.scale.copy(h.scale);
      const dyn = DYNAMIC.has(o.userData.kind);
      o.matrixAutoUpdate = dyn;
      if (!dyn) o.updateMatrix(); // корень снова заморожен, пересчитываем матрицу один раз
      if (!o.parent) this.root.add(o);
      this.register(o);
    }
  }

  update(dt, holes) {
    for (const hole of holes) this.tryEat(hole);
    this.stepFalling(dt);
  }

  // Лучшая цель для бота: больше очков и ближе — лучше
  nearest(px, pz, maxSize, range) {
    let best = null;
    let bestV = -1;
    const consider = (o) => {
      const u = o.userData;
      if (u.size > maxSize) return;
      const d = Math.hypot(o.position.x - px, o.position.z - pz);
      if (d > range) return;
      const v = u.points / (d + 4);
      if (v > bestV) {
        bestV = v;
        best = o;
      }
    };
    const x0 = Math.floor((px - range) / CELL);
    const x1 = Math.floor((px + range) / CELL);
    const z0 = Math.floor((pz - range) / CELL);
    const z1 = Math.floor((pz + range) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const cell = this.grid.get(key(cx, cz));
        if (cell) for (const o of cell) consider(o);
      }
    }
    for (const o of this.dynamic) consider(o);
    return best;
  }

  tryEat(hole) {
    const r = hole.radius;
    const maxSize = r * 2 * EAT_SIZE;
    const reach = r * REACH;
    const reach2 = reach * reach;
    const px = hole.position.x;
    const pz = hole.position.z;

    const x0 = Math.floor((px - r) / CELL);
    const x1 = Math.floor((px + r) / CELL);
    const z0 = Math.floor((pz - r) / CELL);
    const z1 = Math.floor((pz + r) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const cell = this.grid.get(key(cx, cz));
        if (!cell) continue;
        for (let i = cell.length - 1; i >= 0; i--) {
          const o = cell[i];
          if (o.userData.size > maxSize) continue;
          const dx = o.position.x - px;
          const dz = o.position.z - pz;
          if (dx * dx + dz * dz > reach2) continue;
          cell.splice(i, 1);
          this.startFall(o, hole);
        }
      }
    }

    // Движущиеся объекты проверяем простым перебором (их немного)
    for (let i = this.dynamic.length - 1; i >= 0; i--) {
      const o = this.dynamic[i];
      if (o.userData.size > maxSize) continue;
      const dx = o.position.x - px;
      const dz = o.position.z - pz;
      if (dx * dx + dz * dz > reach2) continue;
      this.dynamic.splice(i, 1);
      this.startFall(o, hole);
    }
  }

  startFall(o, hole) {
    o.matrixAutoUpdate = true; // падающий объект снова двигается
    hole.addScore(o.userData.points);
    hole.eaten += 1;
    const h = o.userData.height;
    this.falling.push({
      obj: o,
      hole,
      t: 0,
      dur: 0.7 + Math.min(h, 40) * 0.03, // высокие здания падают дольше
      depth: h + 1, // на сколько опуститься, чтобы верх ушёл под землю
      fx: o.position.x,
      fz: o.position.z,
      y0: o.position.y,
    });
  }

  // Объект наклоняется к центру дыры, сжимается и проваливается под землю
  stepFalling(dt) {
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i];
      const o = f.obj;
      f.t += dt / f.dur;
      const t = Math.min(f.t, 1);
      const smooth = t * t * (3 - 2 * t);
      const hx = f.hole.position.x;
      const hz = f.hole.position.z;

      o.position.x = f.fx + (hx - f.fx) * 0.6 * smooth;
      o.position.z = f.fz + (hz - f.fz) * 0.6 * smooth;
      o.position.y = f.y0 - f.depth * t * t;

      const home = o.userData.home;
      o.scale.copy(home.scale).multiplyScalar(1 - 0.3 * t);

      const dx = hx - f.fx;
      const dz = hz - f.fz;
      const len = Math.hypot(dx, dz);
      if (len > 0.01) {
        axis.set(dz / len, 0, -dx / len);
        tilt.setFromAxisAngle(axis, 0.8 * t);
        o.quaternion.copy(home.quat).premultiply(tilt);
      }

      if (t >= 1) {
        this.root.remove(o);
        this.falling.splice(i, 1);
      }
    }
  }
}
