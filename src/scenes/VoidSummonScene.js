import { CHARACTERS, VOID_SUMMON_ORDER, VOID_SUMMON_CHANCES, choiceWeighted, makeTextButton, formatStat } from '../utils.js';
import { music } from '../music.js';

export class VoidSummonScene extends Phaser.Scene {
  constructor() { super('VoidSummon'); }
  create() {
    const { width } = this.scale;
    music.stop();
    music.playMenuTheme();
    this.add.text(24, 20, 'Пустотный призыв', { fontSize: 28, color: '#e9f1ff' });
    makeTextButton(this, width - 90, 32, 140, 44, 'Назад', () => this.scene.start('MainMenu'), { fontSize: 18 });

    this.info = this.add.text(60, 90, this._infoText(), { fontSize: 18, color: '#a8c3e6', lineSpacing: 8 });

    this.resultText = this.add.text(width/2, 220, '—', { fontSize: 26, color: '#e9f1ff' }).setOrigin(0.5);
    this.sprite = this.add.image(width/2, 330, 'ui-button').setDisplaySize(110, 110);
    this.tweens.add({ targets: this.sprite, angle: { from: -2, to: 2 }, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.summonBtn = makeTextButton(this, width/2, 480, 320, 64, 'Призвать (1 пустотный свиток)', () => this.doSummon());
    this.refresh();
  }

  _infoText() {
    const s = window.PathHeroesState.data;
    // Only show percentages for void summon
    return `Пустотных свитков: ${formatStat(s.voidScrolls || 0)}\nШансы (пустотный):\n` +
      VOID_SUMMON_ORDER.map(id => `${CHARACTERS[id].name}: ${VOID_SUMMON_CHANCES[id]}%`).join('\n');
  }

  refresh() {
    const s = window.PathHeroesState.data;
    const can = (s.voidScrolls || 0) > 0;
    if (!can) this.summonBtn.bg.disableInteractive(); else this.summonBtn.bg.setInteractive({ useHandCursor: true });
    this.info.setText(this._infoText());
  }

  doSummon() {
    const state = window.PathHeroesState;
    if (!state.useVoidScroll()) return;
    const picked = choiceWeighted(VOID_SUMMON_ORDER.map(id => ({ key: id, weight: VOID_SUMMON_CHANCES[id] })));
    state.ownCharacter(picked, 1);
    const c = CHARACTERS[picked];
    this.resultText.setText(`Выпал герой: ${c.name}`);
    this.sprite.setTexture(c.sprite);
    this.refresh();
  }
}