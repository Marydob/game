// Точка входа: сцена Three.js, свет, камера и игровой цикл
import * as THREE from 'three';
import { buildWorld, MAP_SIZE } from './world.js';
import { Input } from './input.js';
import { CameraRig } from './camera.js';
import { Absorber } from './absorb.js';
import { UI } from './ui.js';
import { Game } from './game.js';

const container = document.getElementById('game');

// ===== Рендерер (stencil нужен для «вырезания» земли под дырой) =====
const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true });
const coarse = window.matchMedia('(pointer: coarse)').matches; // телефон / планшет
renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 2)); // ограничиваем нагрузку на телефонах
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// ===== Сцена, небо и туман =====
const scene = new THREE.Scene();
const SKY = 0x8fc7f0;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 60, 160); // границы дымки подстроит камера

// ===== Камера и свет =====
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 900);

scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.9)); // мягкий ambient

const sun = new THREE.DirectionalLight(0xfff2d6, 1.4);
sun.castShadow = true;
sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
scene.add(sun);
scene.add(sun.target);

// ===== Мир и игра =====
const world = buildWorld(scene);
console.log(`Город готов: ${world.objects.length} съедобных объектов`);

const input = new Input();
const rig = new CameraRig(camera, sun, scene);
const absorber = new Absorber(world);
const ui = new UI();
const game = new Game({ scene, rig, input, absorber, ui, mapHalf: MAP_SIZE / 2 });

// ===== Адаптивность =====
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);

// ===== Игровой цикл с фиксированным шагом обновления =====
const STEP = 1 / 60;
let accumulator = 0;
let last = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  accumulator += Math.min((now - last) / 1000, 0.1); // защита от больших скачков
  last = now;
  while (accumulator >= STEP) {
    game.update(STEP);
    accumulator -= STEP;
  }
  game.updateIndicators();
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// Для отладки: в консоли  game.player.addScore(100)  — быстро вырастить дыру
window.game = game;
