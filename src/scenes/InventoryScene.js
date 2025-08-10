import { CHARACTERS, CHARACTER_ORDER, makeTextButton, formatStat } from '../utils.js';
import { music } from '../music.js';

export class InventoryScene extends Phaser.Scene {
  constructor() { super('Inventory'); }
  create() {
    const state = window.PathHeroesState;
    const { width, height } = this.scale;
    music.stop();
    music.playMenuTheme();
    this.add.text(24, 20, 'Инвентарь', { fontSize: 28, color: '#e9f1ff' });
    const back = makeTextButton(this, width - 90, 32, 140, 44, 'Назад', () => this.scene.start('MainMenu'), { fontSize: 18 });

    // resources display
    this.stonesText = this.add.text(24, 60, `Камни жизни: ${formatStat(state.data.lifeStones)}`, { fontSize: 18, color: '#a8c3e6' });
    this.scrollsText = this.add.text(280, 60, `Свитки: ${formatStat(state.data.scrolls)}`, { fontSize: 18, color: '#a8c3e6' });

    // pagination setup (6 per page)
    this.pageIndex = 0;
    this.perPage = 6;
    this.buildFlatList();
    this.renderPage();
  }

  buildFlatList() {
    // Expand to instances: [ {charId, instanceIndex} ]
    this.flat = [];
    for (const id of CHARACTER_ORDER) {
      const arr = window.PathHeroesState.getInstances(id);
      for (let k = 0; k < arr.length; k++) this.flat.push({ id, idx: k });
    }
  }

  renderPage() {
    if (this.cards) for (const c of this.cards) for (const n of c.nodes || []) n.destroy();
    this.cards = [];
    const { width } = this.scale;
    const startX = 120, startY = 130, gapX = 210, gapY = 196;
    const start = this.pageIndex * this.perPage;
    const end = Math.min(this.flat.length, start + this.perPage);
    for (let i = start; i < end; i++) {
      const pos = i - start;
      const col = pos % 3, row = Math.floor(pos / 3);
      const x = startX + col * gapX; const y = startY + row * gapY;
      const entry = this.flat[i];
      this.cards.push(this.createCard(entry.id, entry.idx, x, y));
    }
    // arrows
    if (this.prevBtn) { this.prevBtn.bg.destroy(); this.prevBtn.txt.destroy(); }
    if (this.nextBtn) { this.nextBtn.bg.destroy(); this.nextBtn.txt.destroy(); }
    if (this.pageIndex > 0) this.prevBtn = makeTextButton(this, width/2 - 120, 500, 80, 40, '<', () => { this.pageIndex--; this.renderPage(); });
    if (end < this.flat.length) this.nextBtn = makeTextButton(this, width/2 + 120, 500, 80, 40, '>', () => { this.pageIndex++; this.renderPage(); });
  }

  createCard(id, instanceIndex, x, y) {
    const state = window.PathHeroesState;
    const up = state.getUpgradeLevelInstance(id, instanceIndex);
    const c = CHARACTERS[id];
    const bg = this.add.rectangle(x, y, 190, 176, 0x0a1421, 0.9).setStrokeStyle(2, 0x50e3c2);
    const img = this.add.image(x - 66, y - 18, c.sprite).setDisplaySize(56, 56);
    const title = this.add.text(x - 20, y - 50, `${c.name} #${instanceIndex+1}`, { fontSize: 18, color: '#e9f1ff' }).setOrigin(0, 0.5);
    const cls = this.add.text(x - 20, y - 22, c.cls, { fontSize: 14, color: '#a8c3e6' }).setOrigin(0, 0.5);
    const stats = state.getCharacterDisplayStatsForUpgrade(id, up);
    const st = this.add.text(x - 80, y + 6, `HP ${formatStat(stats.hp)}\nATK ${formatStat(stats.atk)}\nSPD ${stats.atkSpeed}/с`, { fontSize: 14, color: '#cde2ff', lineSpacing: 6 }).setOrigin(0,0.5);
    const lvlTxt = this.add.text(x - 80, y + 56, `Уровень: ${up}/10`, { fontSize: 14, color: '#e9f1ff', lineSpacing: 6 }).setOrigin(0,0.5);
    const target = Math.min(10, up + 1);
    const cost = state.getUpgradeCost(id, target);
    const btn = makeTextButton(this, x, y + 78, 140, 36, up >= 10 ? 'MAX' : `Апгрейд (${cost})`, () => this.doUpgrade(id, instanceIndex), { fontSize: 16 });
    if (up >= 10 || state.data.lifeStones < cost) btn.bg.disableInteractive();

    // delete button (small red X)
    const delBg = this.add.rectangle(x + 88, y - 66, 18, 18, 0x7a1a1a).setStrokeStyle(1, 0xffaaaa);
    const delTxt = this.add.text(x + 88, y - 66, '×', { fontSize: 12, color: '#ffffff' }).setOrigin(0.5);
    delBg.setInteractive({ useHandCursor: true }).on('pointerup', () => this.deleteInstance(id, instanceIndex));

    return { id, instanceIndex, nodes: [bg, img, title, cls, st, lvlTxt, btn.bg, btn.txt, delBg, delTxt], btn };
  }

  doUpgrade(id, index) {
    const ok = window.PathHeroesState.applyUpgradeInstance(id, index);
    if (!ok) return;
    this.buildFlatList();
    this.renderPage();
    // refresh resources text
    const s = window.PathHeroesState.data;
    this.stonesText.setText(`Камни жизни: ${formatStat(s.lifeStones)}`);
  }

  deleteInstance(id, index) {
    const ok = window.PathHeroesState.deleteInstance(id, index);
    if (!ok) return;
    this.buildFlatList();
    if (this.pageIndex * this.perPage >= this.flat.length && this.pageIndex > 0) this.pageIndex--; // fix overflow
    this.renderPage();
    // refresh resources text after refund
    const s = window.PathHeroesState.data;
    this.stonesText.setText(`Камни жизни: ${formatStat(s.lifeStones)}`);
  }
}

