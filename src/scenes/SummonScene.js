import { CHARACTERS, CHARACTER_ORDER, choiceWeighted, makeTextButton, formatStat } from '../utils.js';
import { music } from '../music.js';

export class SummonScene extends Phaser.Scene {
  constructor() { super('Summon'); }
  create() {
    const { width } = this.scale;
    music.stop();
    music.playMenuTheme();
    this.add.text(24, 20, 'Призыв', { fontSize: 28, color: '#e9f1ff' });
    const back = makeTextButton(this, width - 90, 32, 140, 44, 'Назад', () => this.scene.start('MainMenu'), { fontSize: 18 });

    this.info = this.add.text(60, 90, this._infoText(), { fontSize: 18, color: '#a8c3e6', lineSpacing: 8 });

    this.resultText = this.add.text(width/2, 220, '—', { fontSize: 26, color: '#e9f1ff' }).setOrigin(0.5);
    this.sprite = this.add.image(width/2, 330, 'ui-button').setDisplaySize(110, 110);
    this.tweens.add({ targets: this.sprite, angle: { from: -2, to: 2 }, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.summonBtn = makeTextButton(this, width/2, 480, 260, 64, 'Призвать (1 свиток)', () => this.doSummon());
    // Void summon quick access to the left of the main summon button
    const voidBg = this.add.rectangle(width/2 - 260/2 - 70, 480, 68, 68, 0x19324d, 0.95).setStrokeStyle(3, 0x8a7aff).setOrigin(0.5).setInteractive({ useHandCursor: true });
    let voidIcon;
    if (this.textures.exists && this.textures.exists('void-hole')) {
      voidIcon = this.add.image(voidBg.x, voidBg.y, 'void-hole').setDisplaySize(38, 38).setAlpha(0.95);
    } else {
      voidIcon = this.add.text(voidBg.x, voidBg.y, 'V', { fontSize: 28, color: '#8a7aff' }).setOrigin(0.5);
    }
    this.tweens.add({ targets: voidIcon, angle: 360, duration: 3000, repeat: -1, ease: 'Linear' });
    this.tweens.add({ targets: [voidBg, voidIcon], scale: { from: 1, to: 1.08 }, yoyo: true, duration: 1400, ease: 'Sine.easeInOut', repeat: -1 });
    voidBg.on('pointerdown', () => voidBg.setFillStyle(0x1a2740, 1)).on('pointerup', () => { voidBg.setFillStyle(0x131d2d, 0.95); this.scene.start('VoidSummon'); }).on('pointerout', () => voidBg.setFillStyle(0x131d2d, 0.95));
    this.add.text(voidBg.x + 52, voidBg.y - 18, 'Призыв (Пустотный свиток)', { fontSize: 16, color: '#e9f1ff' }).setOrigin(0,0.5);
    this._voidCountText2 = this.add.text(voidBg.x, voidBg.y + 48, `x${formatStat(window.PathHeroesState.data.voidScrolls||0)}`, { fontSize: 16, color: '#a8c3e6' }).setOrigin(0.5,0.5);
    this.refresh();
  }

  _infoText() {
    const s = window.PathHeroesState.data;
    return `Свитков: ${formatStat(s.scrolls)}\nШансы:\n` +
      CHARACTER_ORDER.map(k => {
        const c = CHARACTERS[k]; return `- ${c.name}: ${c.chance}%`; }).join('\n');
  }

  refresh() {
    const s = window.PathHeroesState.data;
    const can = s.scrolls > 0;
    if (!can) this.summonBtn.bg.disableInteractive(); else this.summonBtn.bg.setInteractive({ useHandCursor: true });
    this.info.setText(this._infoText());
    if (this._voidCountText2) this._voidCountText2.setText(`x${formatStat(s.voidScrolls||0)}`);
  }

  doSummon() {
    const state = window.PathHeroesState;
    if (!state.useScroll()) return;
    const picked = choiceWeighted(CHARACTER_ORDER.map(id => ({ key: id, weight: CHARACTERS[id].chance })));
    state.ownCharacter(picked, 1);
    const c = CHARACTERS[picked];
    this.resultText.setText(`Выпал герой: ${c.name}`);
    this.sprite.setTexture(c.sprite);
    this.refresh();
  }
}

