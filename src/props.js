// Фабрика low-poly объектов города. Все модели собираются из примитивов Three.js,
// без внешних файлов. Каждый объект — THREE.Group с userData:
//   kind   — тип объекта
//   size   — «размер» (диаметр, с которым сравнивается дыра)
//   points — очки за поглощение
//   edible — false, если объект нельзя съесть (декор)
import * as THREE from 'three';

// ---------- Кэш материалов и геометрий (экономит память и вызовы отрисовки) ----------
const mats = new Map();
export function mat(color) {
  let m = mats.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0 });
    mats.set(color, m);
  }
  return m;
}

const geos = new Map();
function cached(key, make) {
  let g = geos.get(key);
  if (!g) {
    g = make();
    geos.set(key, g);
  }
  return g;
}
export const boxG = (w, h, d) => cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cylG = (rt, rb, h, s = 8) => cached(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const icoG = (r) => cached(`i${r}`, () => new THREE.IcosahedronGeometry(r, 0));

function mesh(geometry, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function prop(kind, size, points) {
  const g = new THREE.Group();
  g.userData = { kind, size, points };
  return g;
}

const pick = (arr) => arr[(Math.random() * arr.length) | 0];

// ---------- Растительность ----------
const GREENS = [0x3e9a35, 0x4caf50, 0x2f8a3a, 0x5cb85c];

export function tree() {
  const t = prop('tree', 3.2, 8);
  const crown = pick(GREENS);
  t.add(mesh(cylG(0.22, 0.3, 1.8, 6), 0x7a5230, 0, 0.9, 0));
  t.add(mesh(icoG(1.5), crown, 0, 2.7, 0));
  t.add(mesh(icoG(1.0), crown, 0.5, 3.6, 0.2));
  const s = 0.9 + Math.random() * 0.5;
  t.scale.setScalar(s);
  t.userData.size *= s;
  return t;
}

export function bush() {
  const b = prop('bush', 1.6, 2);
  const m = mesh(icoG(0.8), pick(GREENS), 0, 0.5, 0);
  m.scale.y = 0.75;
  b.add(m);
  return b;
}

// ---------- Уличная мебель ----------
export function bench() {
  const b = prop('bench', 2.2, 3);
  b.add(mesh(boxG(2.2, 0.15, 0.7), 0xb5753a, 0, 0.5, 0));
  b.add(mesh(boxG(2.2, 0.5, 0.12), 0xb5753a, 0, 0.9, -0.3));
  b.add(mesh(boxG(0.15, 0.5, 0.6), 0x333333, -0.9, 0.25, 0));
  b.add(mesh(boxG(0.15, 0.5, 0.6), 0x333333, 0.9, 0.25, 0));
  return b;
}

// Фонарь: рука светильника направлена в сторону +X
export function lamp() {
  const l = prop('lamp', 0.5, 4);
  l.add(mesh(cylG(0.08, 0.1, 4.4, 6), 0x2d2f36, 0, 2.2, 0));
  l.add(mesh(boxG(1.1, 0.12, 0.25), 0xffe9a0, 0.5, 4.4, 0));
  return l;
}

export function bin() {
  const b = prop('bin', 0.7, 1);
  b.add(mesh(cylG(0.35, 0.3, 0.8, 8), 0x4a6b4f, 0, 0.4, 0));
  return b;
}

export function trafficLight() {
  const t = prop('trafficLight', 0.6, 5);
  t.add(mesh(cylG(0.1, 0.12, 5, 6), 0x2d2f36, 0, 2.5, 0));
  t.add(mesh(boxG(0.5, 1.3, 0.4), 0x1c1d22, 0, 5.1, 0));
  t.add(mesh(icoG(0.12), 0xff4040, 0, 5.5, 0.22));
  t.add(mesh(icoG(0.12), 0xffd040, 0, 5.1, 0.22));
  t.add(mesh(icoG(0.12), 0x40d060, 0, 4.7, 0.22));
  return t;
}

export function pillar() {
  const p = prop('pillar', 0.9, 2);
  p.add(mesh(boxG(0.8, 1.9, 0.8), 0xa4553a, 0, 0.95, 0));
  p.add(mesh(boxG(1.05, 0.2, 1.05), 0xd7d3c8, 0, 2.0, 0));
  return p;
}

export function kiosk() {
  const k = prop('kiosk', 3.2, 12);
  k.add(mesh(boxG(3, 2.4, 2.4), 0x55a37a, 0, 1.2, 0));
  k.add(mesh(boxG(3.4, 0.2, 2.8), 0x2f4f44, 0, 2.5, 0));
  k.add(mesh(boxG(1.4, 0.8, 0.1), 0xcfe8f5, 0, 1.5, 1.22));
  return k;
}

// ---------- Люди ----------
const SHIRTS = [0xe04b4b, 0x3b7dd8, 0xf2c14e, 0x55b36a, 0xffffff, 0xa05cc7];
export function person() {
  const p = prop('person', 0.5, 1);
  p.add(mesh(cylG(0.17, 0.17, 0.5, 6), 0x2f3a55, 0, 0.25, 0));
  p.add(mesh(cylG(0.2, 0.2, 0.55, 6), pick(SHIRTS), 0, 0.77, 0));
  p.add(mesh(icoG(0.2), 0xf1c9a5, 0, 1.2, 0));
  return p;
}

// ---------- Транспорт (нос направлен в сторону +Z) ----------
const CAR_COLORS = [0x2f5fd0, 0xd23c3c, 0xf0c030, 0xeeeeee, 0x35a853, 0xf08a30, 0x222831];

function addWheels(g, xs, zs, r) {
  for (const x of xs) {
    for (const z of zs) {
      const w = mesh(cylG(r, r, 0.3, 8), 0x1a1a1f, x, r, z);
      w.rotation.z = Math.PI / 2;
      g.add(w);
    }
  }
}

export function car(color = pick(CAR_COLORS)) {
  const c = prop('car', 2.4, 10);
  c.add(mesh(boxG(2, 0.7, 4.2), color, 0, 0.65, 0));
  c.add(mesh(boxG(1.7, 0.6, 2.2), 0xdfeaf2, 0, 1.3, -0.2));
  addWheels(c, [-1.0, 1.0], [-1.35, 1.35], 0.4);
  return c;
}

export function bus() {
  const b = prop('bus', 3.6, 30);
  b.add(mesh(boxG(2.8, 2.4, 9), pick([0xf2b632, 0x3b7dd8, 0xe04b4b]), 0, 1.6, 0));
  b.add(mesh(boxG(2.85, 0.8, 8.4), 0x7fb8d8, 0, 2.1, 0));
  addWheels(b, [-1.4, 1.4], [-3, 3], 0.5);
  return b;
}

// ---------- Крыши ----------
export function acUnit() {
  const a = prop('acUnit', 1.6, 5);
  a.add(mesh(boxG(1.6, 1, 1.4), 0xb8bec6, 0, 0.5, 0));
  a.add(mesh(cylG(0.4, 0.4, 0.05, 10), 0x555a63, 0, 1.03, 0));
  return a;
}

export function vent() {
  const v = prop('vent', 1.4, 6);
  v.add(mesh(boxG(1.1, 1, 5), 0xa9c7e6, 0, 0.5, 0));
  v.add(mesh(boxG(4, 1, 1.1), 0xa9c7e6, 1.5, 0.5, -2.45));
  return v;
}

export function sofa() {
  const s = prop('sofa', 2.4, 6);
  s.add(mesh(boxG(2.4, 0.5, 1), 0xe8dcc2, 0, 0.35, 0));
  s.add(mesh(boxG(2.4, 0.6, 0.25), 0xe8dcc2, 0, 0.8, -0.4));
  s.add(mesh(boxG(0.25, 0.7, 1), 0xd6c8a8, -1.1, 0.45, 0));
  s.add(mesh(boxG(0.25, 0.7, 1), 0xd6c8a8, 1.1, 0.45, 0));
  return s;
}

export function table() {
  const t = prop('table', 1.8, 4);
  t.add(mesh(boxG(1.8, 0.12, 1.2), 0x8a6a4a, 0, 0.6, 0));
  t.add(mesh(boxG(0.12, 0.6, 1.0), 0x5c4630, -0.7, 0.3, 0));
  t.add(mesh(boxG(0.12, 0.6, 1.0), 0x5c4630, 0.7, 0.3, 0));
  return t;
}

export function booth() {
  const b = prop('booth', 3, 10);
  b.add(mesh(boxG(3, 2.2, 2.2), 0x6f9a74, 0, 1.1, 0));
  b.add(mesh(boxG(0.9, 1.6, 0.1), 0x3f5f45, 0.4, 0.8, 1.12));
  return b;
}

// ---------- Здания с окнами (текстура рисуется на canvas) ----------
const baseTex = new Map();
function windowTexture(wallHex) {
  let t = baseTex.get(wallHex);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#' + wallHex.toString(16).padStart(6, '0');
    x.fillRect(0, 0, 64, 64);
    x.fillStyle = 'rgba(0,0,0,0.12)'; // карниз этажа
    x.fillRect(0, 60, 64, 4);
    x.fillStyle = '#26394f'; // рама окна
    x.fillRect(12, 10, 40, 38);
    x.fillStyle = '#8ed0ff'; // стекло
    x.fillRect(14, 12, 36, 34);
    x.fillStyle = 'rgba(255,255,255,0.35)'; // блик
    x.fillRect(14, 12, 36, 8);
    x.fillStyle = '#26394f'; // средник
    x.fillRect(31, 12, 2, 34);
    t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    baseTex.set(wallHex, t);
  }
  return t;
}

const wallMats = new Map();
function wallMat(wall, width, height) {
  const rx = Math.max(1, Math.round(width / 4));
  const ry = Math.max(1, Math.round(height / 3.2));
  const key = `${wall}|${rx}|${ry}`;
  let m = wallMats.get(key);
  if (!m) {
    const tex = windowTexture(wall).clone();
    tex.needsUpdate = true; // клон текстуры нужно обновить, иначе будет пустым
    tex.repeat.set(rx, ry);
    m = new THREE.MeshStandardMaterial({ map: tex, flatShading: true, roughness: 0.9 });
    wallMats.set(key, m);
  }
  return m;
}

export const WALL_COLORS = [0x4f86c6, 0xd9b88f, 0xc9d3dc, 0xb5543a, 0x6fa8a0, 0xe4c75a];

// Здание w×d×h. opts.roofColor — цвет крыши, opts.acUnits — ставить ли кондиционеры
export function building(w, d, h, wall, opts = {}) {
  const roofColor = opts.roofColor ?? 0x8f939b;
  const b = prop('building', Math.max(w, d), Math.round(h * 3));
  const side = wallMat(wall, w, h); // грани по Z (ширина w)
  const end = wallMat(wall, d, h); // грани по X (ширина d)
  const body = new THREE.Mesh(boxG(w, h, d), [end, end, mat(roofColor), mat(wall), side, side]);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  b.add(body);
  b.add(mesh(boxG(w + 0.4, 0.4, d + 0.4), roofColor, 0, h + 0.2, 0)); // парапет-плита
  if (opts.acUnits !== false) {
    const n = w > 12 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const a = acUnit();
      a.position.set((Math.random() - 0.5) * (w - 4), h + 0.4, (Math.random() - 0.5) * (d - 4));
      b.add(a);
    }
  }
  return b;
}
