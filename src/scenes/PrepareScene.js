import { CHARACTERS, CHARACTER_ORDER, makeTextButton, formatStat, generateMonsterTeam } from '../utils.js';

export class PrepareScene extends Phaser.Scene {
  constructor() { super('Prepare'); }
  init(data) { this.island = data.island; this.level = data.level; this.replay = !!data.replay; }
  create() {
    const { width, height } = this.scale;
    this.add.text(24, 20, `Подготовка к бою — Остров ${this.island}, Уровень ${this.level}`, { fontSize: 26, color: '#e9f1ff' });
    makeTextButton(this, width - 90, 32, 140, 44, 'Назад', () => this.scene.start('Map'), { fontSize: 18 });
    this._playEnemyIntro();
  }

  _playEnemyIntro() {
    const { width, height } = this.scale;
    const enemies = generateMonsterTeam(this.island, this.level);
    console.log(`[I${this.island}L${this.level}] Enemy preview:`, enemies);
    const c = this.add.container(0, 0);
    const banner = this.add.text(width/2, 90, 'Предстоящие враги', { fontSize: 22, color: '#ffd54f' }).setOrigin(0.5);
    c.add(banner);
    const leftX = width * 0.72; const rightX = width * 0.72; const topY = 160; const gapY = 70;
    const sprites = [];
    for (let i = 0; i < 5; i++) {
      const e = enemies[i]; if (!e) continue;
      const y = topY + i * gapY;
      const s = this.add.image(width + 60, y, e.spriteKey).setDisplaySize(64, 64).setTint(0xff7b7b);
      c.add(s);
      sprites.push(s);
      this.tweens.add({ targets: s, x: rightX, duration: 350, ease: 'Sine.easeOut', delay: i * 120 });
    }
    // After 1.8s, fade out and build UI
    this.time.delayedCall(1800, () => {
      this.tweens.add({ targets: [banner, ...sprites], alpha: 0, duration: 250, onComplete: () => { c.destroy(true); this._buildUI(); } });
    });
  }

  _buildUI() {
    const { width, height } = this.scale;
    // ordered selection of keys "id#idx"
    this.selectedKeys = [];

    // build flat list of instances and render with pagination (as в инвентаре)
    this.pageIndex = 0;
    this.perPage = 6;
    this.buildFlatList();
    this.renderPage();

    this.counter = this.add.text(width/2, height - 110, 'Выбрано: 0/5', { fontSize: 22, color: '#e9f1ff' }).setOrigin(0.5);
    this.startBtn = makeTextButton(this, width/2, height - 60, 280, 60, 'В бой', () => this.startBattle());
    if (this.flat.length === 0) {
      this.add.text(width/2, height/2, 'Нет доступных героев. Перейдите в Призыв.', { fontSize: 18, color: '#a8c3e6' }).setOrigin(0.5);
      this.startBtn.bg.disableInteractive();
      this.startBtn.bg.setAlpha(0.6);
    }
    this.refresh();
  }

  buildFlatList() {
    this.flat = [];
    for (const id of CHARACTER_ORDER) {
      const arr = window.PathHeroesState.getInstances(id);
      for (let idx = 0; idx < arr.length; idx++) this.flat.push({ id, idx });
    }
  }

  renderPage() {
    if (this.cards) for (const c of this.cards) for (const n of c.nodes || []) n.destroy();
    this.cards = [];
    const { width } = this.scale;
    const startX = 120, startY = 110, gapX = 210, gapY = 140;
    const start = this.pageIndex * this.perPage;
    const end = Math.min(this.flat.length, start + this.perPage);
    for (let i = start; i < end; i++) {
      const pos = i - start; const col = pos % 3; const row = Math.floor(pos / 3);
      const x = startX + col * gapX; const y = startY + row * gapY;
      const e = this.flat[i];
      this.cards.push(this.createInstanceCard(e.id, e.idx, x, y));
    }
    if (this.prevBtn) { this.prevBtn.bg.destroy(); this.prevBtn.txt.destroy(); }
    if (this.nextBtn) { this.nextBtn.bg.destroy(); this.nextBtn.txt.destroy(); }
    if (this.pageIndex > 0) this.prevBtn = makeTextButton(this, width/2 - 120, 500, 80, 40, '<', () => { this.pageIndex--; this.renderPage(); });
    if (end < this.flat.length) this.nextBtn = makeTextButton(this, width/2 + 140, 500, 80, 40, '>', () => { this.pageIndex++; this.renderPage(); });
    this.refreshSelectionBadges();
  }

  createInstanceCard(id, index, x, y) {
    const up = window.PathHeroesState.getUpgradeLevelInstance(id, index);
    const stats = window.PathHeroesState.getCharacterDisplayStatsForUpgrade(id, up);
    const bg = this.add.rectangle(x, y, 200, 120, 0x0a1421, 0.9).setStrokeStyle(2, 0x295a78);
    const img = this.add.image(x - 72, y, CHARACTERS[id].sprite).setDisplaySize(56, 56);
    const title = this.add.text(x - 20, y - 24, `${CHARACTERS[id].name} #${index+1}`, { fontSize: 16, color: '#e9f1ff' }).setOrigin(0,0.5);
    const st = this.add.text(x - 20, y + 6, `HP ${formatStat(stats.hp)}  ATK ${formatStat(stats.atk)}\nLV ${up}/10`, { fontSize: 14, color: '#cde2ff', lineSpacing: 4 }).setOrigin(0,0.5);
    bg.setInteractive({ useHandCursor: true }).on('pointerup', () => this.toggleSelect(id, index, bg));
    const key = `${id}#${index}`;
    const badge = this.add.text(x + 88, y - 48, '', { fontSize: 16, color: '#ffd54f' }).setOrigin(0.5);
    return { id, index, key, nodes: [bg, img, title, st, badge], bg, badge };
  }

  totalSelected() { return this.selectedKeys.length; }

  toggleSelect(id, index, bg) {
    const key = `${id}#${index}`;
    const pos = this.selectedKeys.indexOf(key);
    if (pos >= 0) {
      this.selectedKeys.splice(pos, 1);
    } else {
      if (this.selectedKeys.length >= 5) return;
      
      // Anubis restriction: only one Anubis can be selected
      if (id === 'anubis') {
        const hasAnubis = this.selectedKeys.some(k => k.startsWith('anubis#'));
        if (hasAnubis) return; // prevent selecting second Anubis
      }
      
      this.selectedKeys.push(key);
    }
    const on = this.selectedKeys.includes(key);
    bg.setStrokeStyle(2, on ? 0x50e3c2 : 0x295a78);
    this.refreshSelectionBadges();
    this.refresh();
  }

  refreshSelectionBadges() {
    const indexByKey = new Map(this.selectedKeys.map((k, i) => [k, i + 1]));
    if (this.cards) {
      for (const c of this.cards) {
        const n = indexByKey.get(c.key) || 0;
        if (n > 0) {
          c.badge.setText(`${n}`);
          c.badge.setVisible(true);
        } else {
          c.badge.setText('');
          c.badge.setVisible(false);
        }
      }
    }
  }

  refresh() {
    const total = this.totalSelected();
    this.counter.setText(`Выбрано: ${total}/5`);
    if (total >= 1) {
      this.startBtn.bg.setInteractive({ useHandCursor: true });
      this.startBtn.bg.setAlpha(1);
    } else {
      this.startBtn.bg.disableInteractive();
      this.startBtn.bg.setAlpha(0.6);
    }
    
    // Update Anubis availability visual state
    if (this.cards) {
      const hasAnubis = this.selectedKeys.some(k => k.startsWith('anubis#'));
      for (const c of this.cards) {
        const [cardId] = c.key.split('#');
        const isSelected = this.selectedKeys.includes(c.key);
        if (cardId === 'anubis' && hasAnubis && !isSelected) {
          // Disable unselected Anubis cards
          c.bg.setAlpha(0.5);
          c.bg.disableInteractive();
        } else {
          // Enable all other cards normally
          c.bg.setAlpha(1);
          c.bg.setInteractive({ useHandCursor: true });
        }
      }
    }
  }

  startBattle() {
    const team = [];
    for (const key of this.selectedKeys) {
      const [id, idxStr] = key.split('#');
      team.push({ id, index: parseInt(idxStr, 10) });
    }
    // keep user selection order as battlefield order
    this.scene.start('Battle', { island: this.island, level: this.level, team, replay: this.replay });
  }
}

