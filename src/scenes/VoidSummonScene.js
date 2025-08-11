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
    const lines = [];
    lines.push(`Пустотных свитков: ${formatStat(s.voidScrolls || 0)}`);
    lines.push('Список (шансы и характеристики):');
    lines.push(`- ${CHARACTERS.bruno.name} — Пастор, Здоровье: 9000, Урон: 500, Скорость атаки: 1/сек, Шанс: ${VOID_SUMMON_CHANCES.bruno}%`);
    lines.push(`- ${CHARACTERS.shadow.name} — Тень, Здоровье: 10000, Урон: 450, Скорость атаки: 1/сек, Шанс: ${VOID_SUMMON_CHANCES.shadow}%, Способность: может быть атакован только когда все другие персонажи игрока мертвы`);
    lines.push(`- ${CHARACTERS.x.name} — Маг, Здоровье: 11000, Урон: 700, Скорость атаки: 2/сек, Шанс: ${VOID_SUMMON_CHANCES.x}%, Способность: каждые 2 сек. блокирует случайного монстра на 2 сек.`);
    lines.push(`- ${CHARACTERS.vampire.name} — Нежить, Здоровье: 15000, Урон: 1500, Скорость атаки: 1/сек, Шанс: ${VOID_SUMMON_CHANCES.vampire}%, Способность: 50% шанс восстановить 20% здоровья при ударе`);
    lines.push(`- ${CHARACTERS.er1ze.name} — Робот, Здоровье: 12000, Урон: 1000, Скорость атаки: 1/сек, Шанс: ${VOID_SUMMON_CHANCES.er1ze}%, Способность: 10% шанс нанести дополнительно 6000 урона`);
    lines.push(`- ${CHARACTERS.zeus.name} — Бог, Здоровье: 25000, Урон: 1500, Скорость атаки: 2/сек, Шанс: ${VOID_SUMMON_CHANCES.zeus}%, Способность: каждые 2 сек. увеличивает свой урон на 200`);
    return lines.join('\n');
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