// Генерация города: сетка улиц, кварталы (здания / парки / крыши), транспорт, декор
import * as THREE from 'three';
import * as P from './props.js';

export const BLOCK = 40; // размер квартала
export const ROAD = 14; // ширина улицы
export const CELL = BLOCK + ROAD;
export const N = 5; // кварталов по стороне
export const MAP_SIZE = N * CELL + ROAD; // 284
const HALF = MAP_SIZE / 2;
const TOP = 0.4; // высота тротуара: на этом уровне стоят объекты кварталов

// Детерминированный генератор случайных чисел — город одинаковый при каждом запуске
function rng(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const roadC = (k) => (k - N / 2) * CELL; // центр k-й улицы (k = 0..N)
const blockC = (i) => (i - (N - 1) / 2) * CELL; // центр i-го квартала (i = 0..N-1)

// Материалы «земли» не рисуются там, где в stencil-буфер записана дыра (см. hole.js)
function cutout(m) {
  m.stencilWrite = true;
  m.stencilFunc = THREE.NotEqualStencilFunc;
  m.stencilRef = 1;
  return m;
}
const groundMats = new Map();
function groundMat(color) {
  let m = groundMats.get(color);
  if (!m) {
    m = cutout(new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 }));
    groundMats.set(color, m);
  }
  return m;
}

function tileTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d');
  x.fillStyle = '#d9dce2';
  x.fillRect(0, 0, 32, 32);
  x.strokeStyle = '#bcc0c8';
  x.lineWidth = 2;
  x.strokeRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(BLOCK / 2, BLOCK / 2);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function buildWorld(scene) {
  const R = rng(7);
  const rand = (a, b) => a + R() * (b - a);
  const pick = (arr) => arr[(R() * arr.length) | 0];
  const objects = []; // все съедобные объекты — пригодятся на этапе 4
  const root = new THREE.Group();
  scene.add(root);

  function place(obj, x, z, rotY = 0, y = 0) {
    obj.position.set(x, y, z);
    obj.rotation.y = rotY;
    root.add(obj);
    if (obj.userData.edible !== false) objects.push(obj);
    return obj;
  }
  function decor(geometry, color, x, y, z) {
    const m = new THREE.Mesh(geometry, P.mat(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    return m;
  }
  // То же, но для поверхностей земли (вырезаются дырой)
  function ground(geometry, color, x, y, z) {
    const m = new THREE.Mesh(geometry, groundMat(color));
    m.position.set(x, y, z);
    m.receiveShadow = true;
    root.add(m);
    return m;
  }

  // ===== Земля =====
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), groundMat(0x5d9a48));
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.05;
  outer.receiveShadow = true;
  root.add(outer);

  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE), groundMat(0x45484f));
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.receiveShadow = true;
  root.add(asphalt);

  // ===== Дорожная разметка (одним InstancedMesh) =====
  const marks = [];
  const addMark = (x, z, sx, sz) => marks.push([x, z, sx, sz]);
  const nearRoad = (t, gap) => {
    for (let j = 0; j <= N; j++) if (Math.abs(t - roadC(j)) < gap) return true;
    return false;
  };
  for (let k = 0; k <= N; k++) {
    const c = roadC(k);
    for (let t = -HALF + 4; t < HALF - 2; t += 6) {
      if (nearRoad(t, ROAD / 2 + 4.5)) continue; // в зоне перекрёстка пунктира нет
      addMark(c, t, 0.3, 3); // вдоль Z
      addMark(t, c, 3, 0.3); // вдоль X
    }
  }
  // Пешеходные переходы перед перекрёстками
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const a = roadC(i);
      const b = roadC(j);
      for (const sgn of [-1, 1]) {
        const zc = b + sgn * (ROAD / 2 + 2.2);
        const xc = a + sgn * (ROAD / 2 + 2.2);
        for (let s = -ROAD / 2 + 1.2; s <= ROAD / 2 - 1.2; s += 1.7) {
          if (Math.abs(zc) < HALF - 1.5) addMark(a + s, zc, 0.9, 2.2);
          if (Math.abs(xc) < HALF - 1.5) addMark(xc, b + s, 2.2, 0.9);
        }
      }
    }
  }
  const white = cutout(new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 1 }));
  const markMesh = new THREE.InstancedMesh(P.boxG(1, 0.03, 1), white, marks.length);
  const dummy = new THREE.Object3D();
  marks.forEach(([x, z, sx, sz], idx) => {
    dummy.position.set(x, 0.03, z);
    dummy.scale.set(sx, 1, sz);
    dummy.updateMatrix();
    markMesh.setMatrixAt(idx, dummy.matrix);
  });
  markMesh.receiveShadow = true;
  root.add(markMesh);

  // ===== Кварталы =====
  const tile = tileTexture();
  const sideM = cutout(new THREE.MeshStandardMaterial({ color: 0xc4c8cf, flatShading: true }));
  const topM = cutout(new THREE.MeshStandardMaterial({ map: tile, flatShading: true }));
  const sidewalkMats = [sideM, sideM, topM, sideM, sideM, sideM];
  const bars = []; // стойки оград (потом одним InstancedMesh)

  function fenceSeg(x1, z1, x2, z2) {
    const horizontal = z1 === z2;
    const L = horizontal ? x2 - x1 : z2 - z1;
    const mx = (x1 + x2) / 2;
    const mz = (z1 + z2) / 2;
    for (const y of [0.25, 1.0]) {
      decor(horizontal ? P.boxG(L, 0.08, 0.1) : P.boxG(0.1, 0.08, L), 0x1c1d22, mx, TOP + y, mz);
    }
    for (let t = 0.4; t < L; t += 0.75) {
      bars.push(horizontal ? [x1 + t, z1] : [x1, z1 + t]);
    }
  }

  function dressSidewalk(cx, cz) {
    const e = BLOCK / 2 - 1.3;
    for (const off of [-10, 10]) {
      place(P.lamp(), cx + e, cz + off, 0, TOP);
      place(P.lamp(), cx - e, cz + off, Math.PI, TOP);
      place(P.lamp(), cx + off, cz + e, -Math.PI / 2, TOP);
      place(P.lamp(), cx + off, cz - e, Math.PI / 2, TOP);
    }
    for (let n = 0; n < 2; n++) place(P.bin(), cx + rand(-16, 16), cz + (R() < 0.5 ? -1 : 1) * 18.4, 0, TOP);
    for (let n = 0; n < 3; n++) {
      const onX = R() < 0.5;
      const s = R() < 0.5 ? -1 : 1;
      place(P.person(), cx + (onX ? s * 18.5 : rand(-16, 16)), cz + (onX ? rand(-16, 16) : s * 18.5), 0, TOP);
    }
  }

  function buildPark(cx, cz) {
    ground(P.boxG(34, 0.15, 34), 0x5fae3c, cx, TOP + 0.075, cz); // газон
    const pathY = TOP + 0.17;
    ground(P.boxG(34, 0.04, 2.4), 0xcdd0d6, cx, pathY, cz + 3); // дорожка поперёк
    ground(P.boxG(2.4, 0.04, 14), 0xcdd0d6, cx, pathY, cz + 10); // дорожка к входу
    // Ограда с воротами на южной стороне
    const f = 17.3;
    fenceSeg(cx - f, cz - f, cx + f, cz - f);
    fenceSeg(cx - f, cz - f, cx - f, cz + f);
    fenceSeg(cx + f, cz - f, cx + f, cz + f);
    fenceSeg(cx - f, cz + f, cx - 2.6, cz + f);
    fenceSeg(cx + 2.6, cz + f, cx + f, cz + f);
    const pillars = [[-f, -f], [f, -f], [-f, f], [f, f], [-2.6, f], [2.6, f], [0, -f], [-f, 0], [f, 0]];
    for (const [px, pz] of pillars) place(P.pillar(), cx + px, cz + pz, 0, TOP);

    const onPath = (x, z) => Math.abs(z - 3) < 2.6 || (Math.abs(x) < 2.6 && z > 3);
    const lawnPos = () => {
      for (let n = 0; n < 30; n++) {
        const x = rand(-15, 15);
        const z = rand(-15, 15);
        if (!onPath(x, z)) return [cx + x, cz + z];
      }
      return [cx - 12, cz - 12];
    };
    const y = TOP + 0.15;
    for (let n = 0; n < 8; n++) place(P.tree(), ...lawnPos(), rand(0, 6), y);
    for (let n = 0; n < 3; n++) place(P.bench(), ...lawnPos(), (R() < 0.5 ? 0 : Math.PI / 2), y);
    for (let n = 0; n < 5; n++) place(P.bush(), ...lawnPos(), 0, y);
    for (let n = 0; n < 3; n++) place(P.lamp(), ...lawnPos(), rand(0, 6), y);
    for (let n = 0; n < 3; n++) place(P.person(), ...lawnPos(), 0, y);
  }

  function buildCity(cx, cz) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const px = cx + sx * 8.7 + rand(-1, 1);
        const pz = cz + sz * 8.7 + rand(-1, 1);
        if (R() < 0.82) {
          const tall = R() < 0.15;
          const h = tall ? rand(26, 36) : rand(8, 22);
          place(P.building(rand(10, 15), rand(10, 15), h, pick(P.WALL_COLORS)), px, pz, 0, TOP);
        } else {
          // Мини-площадь с деревьями и киоском
          place(P.kiosk(), px, pz, 0, TOP);
          place(P.tree(), px - 5, pz - 4, 0, TOP);
          place(P.tree(), px + 5, pz + 4, 0, TOP);
          place(P.bench(), px, pz + 5, 0, TOP);
        }
      }
    }
    for (let n = 0; n < 6; n++) place(P.bush(), cx + rand(-17, 17), cz + pick([-1, 1]) * 17.2, 0, TOP);
  }

  function buildRooftop(cx, cz) {
    // Один большой невысокий дом. Мебель, вентиляция и кондиционеры — дочерние объекты крыши:
    // отдельно их съесть нельзя, они падают вместе со зданием
    const h = rand(5, 9);
    const b = place(P.building(36, 36, h, pick(P.WALL_COLORS), { roofColor: 0x7d818a, acUnits: false }), cx, cz, 0, TOP);
    const onRoof = (obj, rot = 0) => {
      obj.position.set(rand(-14, 14), h + 0.4, rand(-14, 14));
      obj.rotation.y = rot;
      b.add(obj);
    };
    for (let n = 0; n < 2; n++) onRoof(P.sofa(), pick([0, Math.PI / 2, Math.PI]));
    for (let n = 0; n < 2; n++) onRoof(P.table(), pick([0, Math.PI / 2]));
    for (let n = 0; n < 4; n++) onRoof(P.acUnit());
    for (let n = 0; n < 2; n++) onRoof(P.vent(), pick([0, Math.PI / 2, Math.PI]));
    onRoof(P.booth());
    for (let n = 0; n < 3; n++) onRoof(P.bush());
  }

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const cx = blockC(i);
      const cz = blockC(j);
      // Бордюр + тротуар с плиткой
      ground(P.boxG(BLOCK + 0.6, 0.3, BLOCK + 0.6), 0xb9bcc4, cx, 0.15, cz);
      const sw = new THREE.Mesh(P.boxG(BLOCK, TOP, BLOCK), sidewalkMats);
      sw.position.set(cx, TOP / 2, cz);
      sw.receiveShadow = true;
      root.add(sw);

      let type;
      if (i === 2 && j === 2) type = 'park'; // в центре карты — парк, как на скриншоте
      else {
        const r = R();
        type = r < 0.25 ? 'park' : r < 0.45 ? 'rooftop' : 'city';
      }
      if (type === 'park') buildPark(cx, cz);
      else if (type === 'rooftop') buildRooftop(cx, cz);
      else buildCity(cx, cz);
      dressSidewalk(cx, cz);
    }
  }

  // Стойки оград одним InstancedMesh
  const barMesh = new THREE.InstancedMesh(P.boxG(0.07, 1.0, 0.07), P.mat(0x1c1d22), bars.length);
  bars.forEach(([x, z], idx) => {
    dummy.position.set(x, TOP + 0.55, z);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    barMesh.setMatrixAt(idx, dummy.matrix);
  });
  barMesh.castShadow = true;
  root.add(barMesh);

  // ===== Улицы: машины, автобусы, светофоры, люки =====
  for (let k = 0; k <= N; k++) {
    const c = roadC(k);
    for (let j = 0; j < N; j++) {
      const s = blockC(j);
      for (const off of [3.4, -3.4]) {
        if (R() > 0.65) continue;
        const t = s + rand(-BLOCK / 2 + 4, BLOCK / 2 - 4);
        const vehicle = R() < 0.14 ? P.bus() : P.car();
        // Дорога вдоль Z (x = c)
        place(vehicle, c + off, t, off > 0 ? Math.PI : 0);
      }
      for (const off of [3.4, -3.4]) {
        if (R() > 0.65) continue;
        const t = s + rand(-BLOCK / 2 + 4, BLOCK / 2 - 4);
        const vehicle = R() < 0.14 ? P.bus() : P.car();
        // Дорога вдоль X (z = c)
        place(vehicle, t, c + off, off > 0 ? Math.PI / 2 : -Math.PI / 2);
      }
    }
  }
  for (let i = 1; i < N; i++) {
    for (let j = 1; j < N; j++) {
      const a = roadC(i);
      const b = roadC(j);
      const o = ROAD / 2 + 0.8;
      place(P.trafficLight(), a - o, b - o, 0, TOP);
      place(P.trafficLight(), a + o, b + o, Math.PI, TOP);
    }
  }
  for (let n = 0; n < 14; n++) {
    const onX = R() < 0.5;
    const road = roadC(1 + ((R() * (N - 1)) | 0));
    const t = rand(-HALF + 10, HALF - 10);
    ground(new THREE.CylinderGeometry(0.9, 0.9, 0.04, 10), 0x2e3036, onX ? t : road, 0.03, onX ? road : t);
  }

  return { root, objects, MAP_SIZE };
}
