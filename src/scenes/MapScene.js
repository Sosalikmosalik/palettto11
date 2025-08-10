import { ISLANDS, makeTextButton } from '../utils.js';
import { music } from '../music.js';

export class MapScene extends Phaser.Scene {
  constructor() { super('Map'); }
  create() {
    const { width, height } = this.scale;
    music.stop();
    music.playMenuTheme();
    this.add.text(24, 20, 'Карта островов', { fontSize: 28, color: '#e9f1ff' });
    const back = makeTextButton(this, width - 90, 32, 140, 44, 'В меню', () => this.scene.start('MainMenu'), { fontSize: 18 });

    // positions for islands (spread)
    const points = [
      { x: width*0.2, y: height*0.3 },
      { x: width*0.45, y: height*0.2 },
      { x: width*0.7, y: height*0.35 },
      { x: width*0.4, y: height*0.65 },
      { x: width*0.75, y: height*0.7 },
    ];

    // lines between consecutive islands
    const g = this.add.graphics();
    g.lineStyle(3, 0x50e3c2, 0.7);
    for (let i = 0; i < ISLANDS - 1; i++) {
      const a = points[i]; const b = points[i+1];
      g.strokeLineShape(new Phaser.Geom.Line(a.x, a.y, b.x, b.y));
    }

    // island buttons with icons
    this.islandButtons = [];
    for (let i = 1; i <= ISLANDS; i++) {
      const pos = points[i-1];
      const unlocked = window.PathHeroesState.isIslandUnlocked(i);
      const label = `Остров ${i}`;
      const btn = makeTextButton(this, pos.x, pos.y + 36, 170, 70, label, () => this.openIsland(i), { fontSize: 20 });
      const iconKeys = ['icon-jungle','icon-beach','icon-village','icon-fog','icon-desert'];
      const icon = this.add.image(pos.x, pos.y - 26, iconKeys[i-1]).setDisplaySize(56, 56);
      this.tweens.add({ targets: icon, scale: { from: 1, to: 1.05 }, yoyo: true, duration: 1400, ease: 'Sine.easeInOut', repeat: -1 });
      if (!unlocked) {
        btn.bg.setFillStyle(0x2b2b2b, 0.8);
        btn.bg.disableInteractive();
        icon.setTint(0x666666);
      }
      // small completed counter
      const done = window.PathHeroesState.getCompletedCountOnIsland(i);
      this.add.text(pos.x, pos.y + 80, `${done}/10 уровней`, { fontSize: 14, color: '#a8c3e6' }).setOrigin(0.5);
      this.islandButtons.push(btn);
    }

    this.panel = this.add.container(width/2, height/2).setVisible(false);
    const panelBg = this.add.rectangle(0, 0, Math.min(740, width*0.9), Math.min(420, height*0.8), 0x0a1421, 0.95).setStrokeStyle(2, 0x50e3c2);
    this.panel.add(panelBg);
    this.panelTitle = this.add.text(0, -panelBg.height/2 + 28, '', { fontSize: 24, color: '#e9f1ff' }).setOrigin(0.5);
    this.panel.add(this.panelTitle);
    const closeBtn = makeTextButton(this, panelBg.width/2 - 60, -panelBg.height/2 + 28, 100, 40, 'Закрыть', () => this.hidePanel(), { fontSize: 16 });
    this.panel.add(closeBtn.bg); this.panel.add(closeBtn.txt);

    // levels grid 2 rows of 5
    this.levelButtons = [];
    for (let i = 1; i <= 10; i++) {
      const col = (i - 1) % 5;
      const row = Math.floor((i - 1) / 5);
      const x = -280 + col * 140;
      const y = -100 + row * 140;
      const btn = makeTextButton(this, x, y, 120, 80, `Уровень\n${i}`, () => this.pickLevel(i), { fontSize: 18 });
      this.panel.add(btn.bg); this.panel.add(btn.txt);
      this.levelButtons.push(btn);
    }
  }

  openIsland(island) {
    this.currentIsland = island;
    this.panel.setVisible(true);
    this.panelTitle.setText(`Остров ${island}`);
    // refresh buttons enabled state
    const completedArr = window.PathHeroesState.data.completed[island] || new Array(10).fill(false);
    const nextPlayableIndex = completedArr.findIndex(v => v === false); // 0-based; -1 means all done
    const replayIndex = nextPlayableIndex > 0 ? nextPlayableIndex - 1 : -1; // allow replay of immediate previous only until next is passed
    for (let i = 1; i <= 10; i++) {
      const idx = i - 1; const b = this.levelButtons[idx];
      const completed = completedArr[idx];
      const isNext = (idx === nextPlayableIndex);
      if (completed && idx !== replayIndex) {
        b.bg.setFillStyle(0x2b2b2b, 0.8);
        b.bg.disableInteractive();
        b.txt.setText(`Пройден\n${i}`);
      } else if (isNext) {
        b.bg.setFillStyle(0x19324d, 0.9);
        b.bg.setInteractive({ useHandCursor: true });
        b.txt.setText(`Уровень\n${i}`);
        b.txt.setColor('#e9f1ff');
      } else if (idx === replayIndex) {
        // replay of last passed level while next is not yet passed
        b.bg.setFillStyle(0x471a1a, 0.9);
        b.bg.setInteractive({ useHandCursor: true });
        b.txt.setText(`Повтор\n${i}`);
        b.txt.setColor('#ff6b6b');
      } else {
        b.bg.setFillStyle(0x222a33, 0.7);
        b.bg.disableInteractive();
        b.txt.setText(`Закрыто\n${i}`);
        b.txt.setColor('#e9f1ff');
      }
    }
  }

  hidePanel() { this.panel.setVisible(false); }

  pickLevel(level) {
    const island = this.currentIsland;
    const completedArr = window.PathHeroesState.data.completed[island] || new Array(10).fill(false);
    const nextPlayableIndex = completedArr.findIndex(v => v === false);
    const replayIndex = nextPlayableIndex > 0 ? nextPlayableIndex - 1 : -1;
    const idx = level - 1;
    let replay = false;
    if (idx === nextPlayableIndex) replay = false; else if (idx === replayIndex) replay = true; else return; // disallow
    this.scene.start('Prepare', { island, level, replay });
  }
}

