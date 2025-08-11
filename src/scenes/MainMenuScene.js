import { makeTextButton, formatStat } from '../utils.js';
import { music } from '../music.js';

export class MainMenuScene extends Phaser.Scene {
  constructor() { super('MainMenu'); }
  create() {
    const state = window.PathHeroesState;
    const { width, height } = this.scale;
    music.stop();
    music.playMenuTheme();

    const title = this.add.text(width/2, 70, 'Path Heroes', { fontSize: 52, color: '#e9f1ff', fontFamily: 'Arial', fontStyle: 'bold', shadow: { color: '#50e3c2', fill: true, blur: 8, offsetX: 0, offsetY: 0 } }).setOrigin(0.5);
    this.tweens.add({ targets: title, scale: { from: 0.97, to: 1.02 }, yoyo: true, duration: 1600, ease: 'Sine.easeInOut', repeat: -1 });
    this.add.text(width/2, 110, 'HTML5 RPG Auto-Battler', { fontSize: 18, color: '#a8c3e6' }).setOrigin(0.5);

    const btnW = 360; const btnH = 68; let y = 180; const gap = 78;
    const storyBtn = this._animButton(makeTextButton(this, width/2, y, btnW, btnH, 'Сюжет (Карта островов)', () => this.scene.start('Map')));
    // Extra worlds button (unlocked after island 5 complete): square button to the LEFT of story button
    const extraUnlocked = window.PathHeroesState.isIslandUnlocked(6);
    if (extraUnlocked) {
      const extraBg = this.add.rectangle(width/2 - btnW/2 - 70, y, 68, 68, 0x19324d, 0.95).setStrokeStyle(3, 0xffd54f).setOrigin(0.5).setInteractive({ useHandCursor: true });
      const extraIcon = this.add.image(extraBg.x, extraBg.y, 'icon-sword-yellow').setDisplaySize(38, 38);
      extraBg.on('pointerdown', () => extraBg.setFillStyle(0x255079, 1)).on('pointerup', () => { extraBg.setFillStyle(0x19324d, 0.95); this.scene.start('ExtendedMap'); }).on('pointerout', () => extraBg.setFillStyle(0x19324d, 0.95));
      this.tweens.add({ targets: [extraBg, extraIcon], scale: { from: 1, to: 1.08 }, yoyo: true, duration: 1100, ease: 'Sine.easeInOut', repeat: -1 });
    }
    // Donation button to the right
    const donateBg = this.add.rectangle(width/2 + btnW/2 + 70, y, 68, 68, 0x19324d, 0.95).setStrokeStyle(3, 0x50e3c2).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const donateIcon = this.add.image(donateBg.x, donateBg.y, 'icon-oak').setDisplaySize(38, 38);
    donateBg.on('pointerdown', () => donateBg.setFillStyle(0x255079, 1)).on('pointerup', () => { donateBg.setFillStyle(0x19324d, 0.95); this.scene.start('Donation'); }).on('pointerout', () => donateBg.setFillStyle(0x19324d, 0.95));
    this.tweens.add({ targets: [donateBg, donateIcon], scale: { from: 1, to: 1.08 }, yoyo: true, duration: 1100, ease: 'Sine.easeInOut', repeat: -1 });
    y += gap;
    const summonBtn = this._animButton(makeTextButton(this, width/2, y, btnW, btnH, 'Призыв', () => this.scene.start('Summon')));
    // Void summon square button to the left
    const voidBg = this.add.rectangle(width/2 - btnW/2 - 70, y, 68, 68, 0x19324d, 0.95).setStrokeStyle(3, 0x8a7aff).setOrigin(0.5).setInteractive({ useHandCursor: true });
    let voidIcon;
    if (this.textures.exists && this.textures.exists('void-hole')) {
      voidIcon = this.add.image(voidBg.x, voidBg.y, 'void-hole').setDisplaySize(38, 38).setAlpha(0.95);
    } else {
      voidIcon = this.add.text(voidBg.x, voidBg.y, 'V', { fontSize: 28, color: '#8a7aff' }).setOrigin(0.5);
    }
    // sucking effect: slow rotation and pulsing scale
    this.tweens.add({ targets: voidIcon, angle: 360, duration: 3000, repeat: -1, ease: 'Linear' });
    this.tweens.add({ targets: [voidBg, voidIcon], scale: { from: 1, to: 1.08 }, yoyo: true, duration: 1400, ease: 'Sine.easeInOut', repeat: -1 });
    voidBg.on('pointerdown', () => voidBg.setFillStyle(0x1a2740, 1)).on('pointerup', () => { voidBg.setFillStyle(0x131d2d, 0.95); this.scene.start('VoidSummon'); }).on('pointerout', () => voidBg.setFillStyle(0x131d2d, 0.95));
    // Label and counter
    this.add.text(voidBg.x + 52, voidBg.y - 18, 'Призыв (Пустотный свиток)', { fontSize: 16, color: '#e9f1ff' }).setOrigin(0,0.5);
    const voidCnt = this.add.text(voidBg.x, voidBg.y + 48, `x${formatStat(window.PathHeroesState.data.voidScrolls||0)}`, { fontSize: 16, color: '#a8c3e6' }).setOrigin(0.5,0.5);
    this._voidCountText = voidCnt;
    // star summon square button to the right
    const starBtnBg = this.add.rectangle(width/2 + btnW/2 + 70, y, 68, 68, 0x19324d, 0.95).setStrokeStyle(3, 0xffd54f).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const starIcon = this.add.image(starBtnBg.x, starBtnBg.y, 'star').setDisplaySize(38, 38);
    starBtnBg.on('pointerdown', () => starBtnBg.setFillStyle(0x255079, 1)).on('pointerup', () => { starBtnBg.setFillStyle(0x19324d, 0.9); this.scene.start('StarSummon'); }).on('pointerout', () => starBtnBg.setFillStyle(0x19324d, 0.9));
    this.tweens.add({ targets: [starBtnBg, starIcon], scale: { from: 1, to: 1.08 }, yoyo: true, duration: 1100, ease: 'Sine.easeInOut', repeat: -1 });
    y += gap;
    this._animButton(makeTextButton(this, width/2, y, btnW, btnH, 'Инвентарь', () => this.scene.start('Inventory')));
    y += gap;
    this._animButton(makeTextButton(this, width/2, y, btnW, btnH, 'Настройки', () => this.scene.start('Settings')));
    // Achievements button to the right
    const achBg = this.add.rectangle(width/2 + btnW/2 + 70, y, 68, 68, 0x19324d, 0.95).setStrokeStyle(3, 0x50e3c2).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const achIcon = this.add.image(achBg.x, achBg.y, 'icon-medal').setDisplaySize(38, 38);
    achBg.on('pointerdown', () => achBg.setFillStyle(0x255079, 1)).on('pointerup', () => { achBg.setFillStyle(0x19324d, 0.95); this.scene.start('Achievements'); }).on('pointerout', () => achBg.setFillStyle(0x19324d, 0.95));
    this.tweens.add({ targets: [achBg, achIcon], scale: { from: 1, to: 1.08 }, yoyo: true, duration: 1100, ease: 'Sine.easeInOut', repeat: -1 });

    // bottom resources bar
    const bar = this.add.rectangle(width/2, height - 40, Math.min(720, width*0.9), 52, 0x0a1421, 0.8).setStrokeStyle(2, 0x50e3c2).setOrigin(0.5);
    this.scrollText = this.add.text(bar.x - bar.width/2 + 16, bar.y, '', { fontSize: 20, color: '#e9f1ff' }).setOrigin(0,0.5);
    this.stoneText = this.add.text(bar.x + bar.width/2 - 16, bar.y, '', { fontSize: 20, color: '#e9f1ff' }).setOrigin(1,0.5);
    this.refreshResources();
  }

  _animButton(btn) {
    const t = this.tweens.add({ targets: [btn.bg, btn.txt], scale: { from: 1, to: 1.03 }, yoyo: true, duration: 900, ease: 'Sine.easeInOut', repeat: -1 });
    btn.bg.on('pointerover', () => { btn.bg.setScale(1.04); btn.txt.setScale(1.04); });
    btn.bg.on('pointerout', () => { btn.bg.setScale(1); btn.txt.setScale(1); });
    return btn;
  }

  refreshResources() {
    const s = window.PathHeroesState.data;
    this.scrollText.setText(`Свитки: ${formatStat(s.scrolls)}  |  Звёздные: ${formatStat(s.starScrolls)}  |  Пустотные: ${formatStat(s.voidScrolls||0)}`);
    this.stoneText.setText(`Камни жизни: ${formatStat(s.lifeStones)}`);
    if (this._voidCountText) this._voidCountText.setText(`x${formatStat(s.voidScrolls||0)}`);
  }
}

