// Состояние игры: меню → раунд (2:00) → итоги. Таймер, боты, поедание дыр, респавн, лидерборд.
import * as THREE from 'three';
import { Hole, START_RADIUS } from './hole.js';
import { BotBrain, BOT_NAMES } from './ai.js';
import { COLORS } from './ui.js';
import { roadC, N } from './world.js';
import { Traffic } from './traffic.js';
import { Indicators } from './indicators.js';

import { CONFIG } from './config.js';

export const ROUND_TIME = CONFIG.roundTime; // секунд
const START = { x: 0, z: 27 }; // улица рядом с центральным парком
const BOT_COUNT = CONFIG.botCount;
const RESPAWN_TIME = CONFIG.respawnTime; // секунд до возрождения
const EAT_RATIO = CONFIG.eatRatio; // чтобы съесть дыру, нужно быть заметно крупнее
const RETAIN = CONFIG.respawnKeep; // какая доля очков сохраняется после того, как тебя съели
const ZERO = { x: 0, z: 0 };

export class Game {
  constructor({ scene, rig, input, absorber, ui, mapHalf }) {
    this.scene = scene;
    this.rig = rig;
    this.input = input;
    this.absorber = absorber;
    this.ui = ui;
    this.mapHalf = mapHalf;
    this.traffic = new Traffic(absorber, mapHalf);
    this.indicators = new Indicators(rig.camera);

    this.state = 'menu'; // 'menu' | 'playing' | 'ended'
    this.player = null;
    this.holes = [];
    this.settings = { name: 'Игрок', color: 0xe53935 };
    this.timeLeft = ROUND_TIME;
    this.menuTime = 0;
    this.boardTimer = 0;
    this.orbit = new THREE.Vector3();

    this.input.setEnabled(false);
    this.rig.snap(this.menuOrbit(), 3);
    this.openMenu();
  }

  // В меню камера медленно кружит над городом
  menuOrbit() {
    const a = this.menuTime * 0.12;
    return this.orbit.set(Math.cos(a) * 45, 0, Math.sin(a) * 45);
  }

  clearHoles() {
    for (const h of this.holes) this.scene.remove(h.group);
    this.holes = [];
    this.player = null;
    this.indicators.clear();
  }

  // Вызывается раз в кадр перед отрисовкой: стрелки должны совпадать с актуальной камерой
  updateIndicators() {
    if (this.state === 'playing') this.indicators.update(this.holes, this.player);
    else this.indicators.hideAll();
  }

  openMenu() {
    this.state = 'menu';
    this.input.setEnabled(false);
    this.clearHoles();
    this.absorber.reset();
    this.ui.hideHud();
    this.ui.setToast(null);
    this.ui.showMenu((settings) => this.startRound(settings));
  }

  // Случайная точка на улице, не ближе minDist к живым дырам
  spawnPoint(minDist) {
    const half = this.mapHalf - 20;
    let x = 0;
    let z = 0;
    for (let t = 0; t < 40; t++) {
      const line = roadC((Math.random() * (N + 1)) | 0);
      const s = (Math.random() * 2 - 1) * half;
      if (Math.random() < 0.5) {
        x = s;
        z = line;
      } else {
        x = line;
        z = s;
      }
      const free = this.holes.every((h) => !h.alive || Math.hypot(h.position.x - x, h.position.z - z) > minDist);
      if (free) break;
      minDist *= 0.95;
    }
    return { x, z };
  }

  startRound(settings) {
    this.settings = settings;
    this.clearHoles();
    this.absorber.reset();

    this.player = new Hole({
      name: settings.name,
      color: settings.color,
      x: START.x,
      z: START.z,
      radius: START_RADIUS,
      isPlayer: true,
    });
    this.scene.add(this.player.group);
    this.holes = [this.player];

    // Боты: свои цвета (без цвета игрока) и случайные ники
    const palette = COLORS.filter((c) => c !== settings.color);
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    for (let i = 0; i < BOT_COUNT; i++) {
      const p = this.spawnPoint(50);
      const bot = new Hole({
        name: names[i],
        color: palette[i % palette.length],
        x: p.x,
        z: p.z,
        radius: START_RADIUS,
      });
      bot.speedMul = CONFIG.botSpeedMul; // боты чуть медленнее игрока
      bot.brain = new BotBrain();
      this.scene.add(bot.group);
      this.holes.push(bot);
    }

    this.timeLeft = ROUND_TIME;
    this.boardTimer = 0;
    this.state = 'playing';
    this.input.setEnabled(true);
    this.rig.snap(this.player.position, this.player.radius);

    this.ui.hideOverlay();
    this.ui.showHud();
    this.ui.setTimer(ROUND_TIME);
    this.ui.setToast(null);
    this.refreshBoard();
  }

  endRound() {
    this.state = 'ended';
    this.input.setEnabled(false);
    this.ui.setToast(null);
    const p = this.player;
    const prevBest = this.ui.getBest();
    const isRecord = p.score > prevBest;
    if (isRecord) this.ui.setBest(p.score);
    const place = [...this.holes].sort((a, b) => b.score - a.score).indexOf(p) + 1;
    this.ui.showResults(
      { score: p.score, eaten: p.eaten, best: Math.max(prevBest, p.score), isRecord, place, total: this.holes.length },
      () => this.startRound(this.settings),
      () => this.openMenu()
    );
  }

  refreshBoard() {
    const rows = [...this.holes]
      .sort((a, b) => b.score - a.score)
      .map((h) => ({ name: h.name, score: h.score, me: h.isPlayer }));
    this.ui.setLeaderboard(rows);
    this.ui.setKills(this.player ? this.player.kills : 0);
  }

  // Крупная дыра съедает мелкую, если накрывает её центр
  checkHoleEating() {
    for (const a of this.holes) {
      if (!a.alive) continue;
      for (const b of this.holes) {
        if (b === a || !b.alive || a.radius < b.radius * EAT_RATIO) continue;
        const d = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
        if (d < a.radius * 0.85) this.eatHole(a, b);
      }
    }
  }

  eatHole(a, b) {
    a.kills += 1;
    a.addScore(30 + Math.floor(b.score * 0.5));
    b.kill();
    b.respawnT = RESPAWN_TIME;
  }

  respawnHole(h) {
    const p = this.spawnPoint(45);
    h.respawn(p.x, p.z, Math.floor(h.score * RETAIN));
    if (h.brain) h.brain.reset();
    if (h.isPlayer) this.rig.snap(h.position, h.radius);
  }

  update(dt) {
    if (this.state === 'playing') {
      const alive = [];
      for (const h of this.holes) {
        if (!h.alive) {
          h.update(dt, ZERO, this.mapHalf); // доигрываем анимацию исчезновения
          h.respawnT -= dt;
          if (h.respawnT <= 0) this.respawnHole(h);
          continue;
        }
        const move = h.isPlayer
          ? this.input.getMove()
          : h.brain.update(dt, h, this.holes, this.absorber, this.mapHalf);
        h.update(dt, move, this.mapHalf);
        alive.push(h);
      }

      this.checkHoleEating();
      this.absorber.update(dt, this.holes.filter((h) => h.alive));
      this.traffic.update(dt, alive);
      this.rig.update(dt, this.player.position, this.player.radius);

      this.ui.setToast(this.player.alive ? null : `Вас съели! Возрождение через ${Math.max(1, Math.ceil(this.player.respawnT))}`);

      this.timeLeft -= dt;
      this.ui.setTimer(this.timeLeft);

      this.boardTimer -= dt;
      if (this.boardTimer <= 0) {
        this.boardTimer = 0.2; // лидерборд обновляем 5 раз в секунду, а не каждый кадр
        this.refreshBoard();
      }
      if (this.timeLeft <= 0) {
        this.refreshBoard();
        this.endRound();
      }
    } else if (this.state === 'ended') {
      // Все дыры плавно останавливаются, падающие объекты доигрывают анимацию, город живёт
      for (const h of this.holes) h.update(dt, ZERO, this.mapHalf);
      this.absorber.update(dt, []);
      this.traffic.update(dt, []);
      this.rig.update(dt, this.player.position, this.player.radius);
    } else {
      this.menuTime += dt;
      this.absorber.update(dt, []);
      this.traffic.update(dt, []);
      this.rig.update(dt, this.menuOrbit(), 3);
    }
  }
}
