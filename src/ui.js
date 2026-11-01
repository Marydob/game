// Интерфейс: HUD (таймер, убийства, лидерборд), главное меню и экран итогов
export const COLORS = [0xe53935, 0x1e88e5, 0x43a047, 0xfb8c00, 0x8e24aa, 0x00acc1, 0xfdd835, 0xec407a];

// localStorage может быть недоступен (приватный режим Safari) — тогда просто не сохраняем
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v === null ? d : v;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, String(v));
    } catch {
      /* ничего */
    }
  },
};

const hex = (c) => '#' + c.toString(16).padStart(6, '0');

export class UI {
  constructor() {
    this.overlay = document.getElementById('overlay');
    this.hud = document.getElementById('hud');
    this.timerEl = document.getElementById('timer');
    this.killsEl = document.getElementById('kills');
    this.boardEl = document.getElementById('leaderboard');
    this.lastSec = -1;

    // Крупная надпись по центру («Вас съели!»)
    this.toastEl = document.createElement('div');
    this.toastEl.id = 'toast';
    this.toastEl.classList.add('hidden');
    document.body.appendChild(this.toastEl);

    this.hideHud();
  }

  setToast(text) {
    if (!text) {
      this.toastEl.classList.add('hidden');
    } else {
      this.toastEl.textContent = text;
      this.toastEl.classList.remove('hidden');
    }
  }

  // ---------- Настройки и рекорд ----------
  loadSettings() {
    const saved = Number(store.get('yumy.color', COLORS[0]));
    return {
      name: store.get('yumy.name', ''),
      color: COLORS.includes(saved) ? saved : COLORS[0],
    };
  }
  getBest() {
    return Number(store.get('yumy.best', 0)) || 0;
  }
  setBest(v) {
    store.set('yumy.best', v);
  }

  // ---------- HUD ----------
  showHud() {
    this.hud.classList.remove('hidden');
  }
  hideHud() {
    this.hud.classList.add('hidden');
  }

  setTimer(sec) {
    const s = Math.max(0, Math.ceil(sec));
    if (s === this.lastSec) return; // обновляем DOM только когда сменилась секунда
    this.lastSec = s;
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    this.timerEl.textContent = `${mm}:${ss}`;
    this.timerEl.classList.toggle('warn', s <= 10);
  }

  setKills(n) {
    this.killsEl.textContent = `Убийств: ${n}`;
  }

  // rows: [{ name, score, me }] — уже отсортированы по очкам
  setLeaderboard(rows) {
    const top = rows.slice(0, 5).map((r, i) => ({ ...r, rank: i + 1 }));
    // Если игрок не в пятёрке — показываем его последней строкой со своим местом
    const me = rows.findIndex((r) => r.me);
    if (me >= 5) top[4] = { ...rows[me], rank: me + 1 };
    this.boardEl.replaceChildren(
      ...top.map((r) => {
        const li = document.createElement('li');
        if (r.me) li.className = 'me';
        li.textContent = `${r.rank} — ${r.score}pts ${r.name}`;
        return li;
      })
    );
  }

  // ---------- Оверлей ----------
  hideOverlay() {
    this.overlay.classList.add('hidden');
    this.overlay.replaceChildren();
  }

  showMenu(onPlay) {
    const s = this.loadSettings();
    let color = s.color;

    const menu = document.createElement('div');
    menu.className = 'menu';
    menu.innerHTML = `
      <div class="logo">yumy.io</div>
      <div class="subtitle">Игры Чёрной дыры</div>
      <div class="hole-preview"></div>
      <input id="nick" type="text" maxlength="14" placeholder="Твой ник" autocomplete="off" />
      <div class="swatches"></div>
      <button class="btn-play" type="button">Играть</button>
      <div class="best"></div>
      <div class="hint">ПК: мышь или WASD · Телефон: веди пальцем</div>`;

    const preview = menu.querySelector('.hole-preview');
    const nick = menu.querySelector('#nick');
    const swatches = menu.querySelector('.swatches');
    nick.value = s.name;
    menu.querySelector('.best').textContent = `Лучший результат: ${this.getBest()}`;

    const paint = () => {
      preview.style.setProperty('--ring', hex(color));
      swatches.querySelectorAll('.swatch').forEach((b) => b.classList.toggle('active', Number(b.dataset.c) === color));
    };
    for (const c of COLORS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.dataset.c = c;
      b.style.background = hex(c);
      b.setAttribute('aria-label', 'Цвет кольца');
      b.addEventListener('click', () => {
        color = c;
        paint();
      });
      swatches.appendChild(b);
    }
    paint();

    const play = () => {
      const name = nick.value.trim().slice(0, 14) || 'Игрок';
      store.set('yumy.name', name);
      store.set('yumy.color', color);
      onPlay({ name, color });
    };
    menu.querySelector('.btn-play').addEventListener('click', play);
    nick.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') play();
    });

    this.overlay.replaceChildren(menu);
    this.overlay.classList.remove('hidden');
  }

  showResults({ score, eaten, best, isRecord, place, total }, onAgain, onMenu) {
    const box = document.createElement('div');
    box.className = 'menu';
    box.innerHTML = `
      <div class="result-title">Время вышло!</div>
      ${isRecord ? '<div class="record">Новый рекорд!</div>' : ''}
      <div class="result-score"></div>
      <div class="result-label">очков</div>
      <div class="result-place"></div>
      <div class="stats">
        <div><b class="s-eaten"></b><span>съедено</span></div>
        <div><b class="s-best"></b><span>рекорд</span></div>
      </div>
      <button class="btn-play" type="button">Играть снова</button>
      <button class="btn-ghost" type="button">В меню</button>`;
    box.querySelector('.result-score').textContent = score;
    box.querySelector('.result-place').textContent = `${place} место из ${total}`;
    box.querySelector('.s-eaten').textContent = eaten;
    box.querySelector('.s-best').textContent = best;
    box.querySelector('.btn-play').addEventListener('click', onAgain);
    box.querySelector('.btn-ghost').addEventListener('click', onMenu);
    this.overlay.replaceChildren(box);
    this.overlay.classList.remove('hidden');
  }
}
