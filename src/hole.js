// Чёрная дыра: игрок и боты.
// Дыра рисуется через stencil-буфер: цветное кольцо + чёрный диск «вырезают» землю
// (материалы земли в world.js не рисуются там, где stencil == 1), поэтому объекты
// действительно проваливаются под землю, а не просто исчезают.
import * as THREE from 'three';

import { CONFIG } from './config.js';

export const START_RADIUS = CONFIG.startRadius; // стартовый радиус тёмной части
const HOLE_Y = 0.45; // уровень плоскости дыры (между асфальтом 0 и газоном 0.55)

// Радиус дыры от очков: плавный рост, который со временем замедляется
export const radiusForScore = (score) => START_RADIUS + CONFIG.growth * Math.sqrt(score);

// Материал, который пишет единицу в stencil и не трогает глубину
function stencilMat(color) {
  return new THREE.MeshBasicMaterial({
    color,
    depthTest: false,
    depthWrite: false,
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: THREE.AlwaysStencilFunc,
    stencilZPass: THREE.ReplaceStencilOp,
  });
}

// Подпись: золотая звёздочка + белый ник с тёмной обводкой
function makeLabel(name) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  g.font = 'bold 54px "Segoe UI", Arial, sans-serif';
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  const star = '★';
  const gap = 14;
  const starW = g.measureText(star).width;
  const nameW = g.measureText(name).width;
  let x = 256 - (starW + gap + nameW) / 2;
  g.lineJoin = 'round';
  g.lineWidth = 10;
  g.strokeStyle = 'rgba(0,0,0,0.75)';
  g.strokeText(star, x, 50);
  g.fillStyle = '#ffd23f';
  g.fillText(star, x, 50);
  x += starW + gap;
  g.strokeText(name, x, 50);
  g.fillStyle = '#ffffff';
  g.fillText(name, x, 50);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, fog: false })
  );
  sprite.renderOrder = 10; // рисуется поверх всего
  return sprite;
}

export class Hole {
  constructor({ name = 'Игрок', color = 0xe53935, x = 0, z = 0, radius = START_RADIUS, isPlayer = false } = {}) {
    this.name = name;
    this.color = color;
    this.isPlayer = isPlayer;
    this.radius = radius; // текущий радиус тёмной части (плавно догоняет targetRadius)
    this.targetRadius = radius;
    this.score = 0;
    this.kills = 0;
    this.eaten = 0; // сколько объектов съедено
    this.vel = new THREE.Vector2();
    this.alive = true;
    this.dyingT = 0; // время до конца анимации исчезновения
    this.respawnT = 0; // время до возрождения
    this.speedMul = 1; // множитель скорости (у ботов чуть меньше 1)

    this.group = new THREE.Group(); // позиция дыры
    this.group.position.set(x, 0, z);

    // body масштабируется радиусом: внутри всё считается для радиуса 1
    this.body = new THREE.Group();
    this.body.position.y = HOLE_Y;
    this.group.add(this.body);

    const flat = -Math.PI / 2; // повернуть плоскость на «землю»

    // Порядок отрисовки: сначала кольцо, потом чёрный диск, потом ободок — всё раньше земли
    const ringDisc = new THREE.Mesh(new THREE.CircleGeometry(1.16, 48), stencilMat(color));
    ringDisc.rotation.x = flat;
    ringDisc.renderOrder = -10;
    this.body.add(ringDisc);

    const black = new THREE.Mesh(new THREE.CircleGeometry(1, 48), stencilMat(0x000000));
    black.rotation.x = flat;
    black.renderOrder = -9;
    this.body.add(black);

    // Тёмно-серый внутренний ободок даёт ощущение глубины
    const rim = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), stencilMat(0x14141b));
    rim.rotation.x = flat;
    rim.renderOrder = -8;
    this.body.add(rim);

    this.label = makeLabel(name);
    this.group.add(this.label);

    this.applyRadius();
  }

  get position() {
    return this.group.position;
  }

  // Очки за съеденное: от них зависит целевой радиус
  addScore(points) {
    this.score += points;
    this.targetRadius = radiusForScore(this.score);
  }

  applyRadius() {
    this.body.scale.setScalar(this.radius);
    // Подпись растёт вместе с дырой, но медленнее
    const w = 3.2 + this.radius * 1.4;
    this.label.scale.set(w, (w * 96) / 512, 1);
    this.label.position.set(0, HOLE_Y + this.radius * 1.1 + 1.6, 0);
  }

  // Дыру съели: быстро сжимается и пропадает
  kill() {
    this.alive = false;
    this.dyingT = 0.35;
    this.vel.set(0, 0);
    this.label.visible = false;
  }

  // Возрождение на новом месте с заданным количеством очков
  respawn(x, z, score) {
    this.score = score;
    this.radius = this.targetRadius = radiusForScore(score);
    this.vel.set(0, 0);
    this.group.position.set(x, 0, z);
    this.alive = true;
    this.dyingT = 0;
    this.group.visible = true;
    this.label.visible = true;
    this.applyRadius();
  }

  // move — вектор {x, z} длиной 0..1 (куда хочет двигаться дыра)
  update(dt, move, mapHalf) {
    if (!this.alive) {
      if (this.dyingT > 0) {
        this.dyingT -= dt;
        this.body.scale.setScalar(this.radius * Math.max(this.dyingT / 0.35, 0.001));
        if (this.dyingT <= 0) this.group.visible = false;
      }
      return;
    }

    // Плавный рост радиуса
    if (Math.abs(this.targetRadius - this.radius) > 0.001) {
      this.radius += (this.targetRadius - this.radius) * (1 - Math.exp(-6 * dt));
      this.applyRadius();
    }

    // Крупные дыры чуть быстрее, но не пропорционально размеру
    const speed = (CONFIG.speedBase + this.radius * CONFIG.speedPerRadius) * this.speedMul;
    const k = 1 - Math.exp(-10 * dt); // плавный разгон и торможение
    this.vel.x += (move.x * speed - this.vel.x) * k;
    this.vel.y += (move.z * speed - this.vel.y) * k;

    const p = this.group.position;
    p.x += this.vel.x * dt;
    p.z += this.vel.y * dt;

    // Не выходим за границы карты
    const lim = mapHalf - this.radius;
    p.x = THREE.MathUtils.clamp(p.x, -lim, lim);
    p.z = THREE.MathUtils.clamp(p.z, -lim, lim);
  }
}
