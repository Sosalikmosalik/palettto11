import { makeTextButton, formatStat } from '../utils.js';
import { music } from '../music.js';

export class DonationScene extends Phaser.Scene {
  constructor() { super('Donation'); }
  create() {
    music.stop(); music.playMenuTheme();
    const state = window.PathHeroesState;
    const { width, height } = this.scale;
    this.add.text(24, 20, 'Дерево даров', { fontSize: 28, color: '#e9f1ff' });
    makeTextButton(this, width - 90, 32, 140, 44, 'Назад', () => this.scene.start('MainMenu'), { fontSize: 18 });

    const c = this.add.container(width/2, height/2 + 20);
    this.tree = this.add.image(0, 40, 'big-tree').setOrigin(0.5).setScale(1);
    c.add(this.tree);

    // Info panel
    this.progressText = this.add.text(width/2, 100, '', { fontSize: 18, color: '#a8c3e6' }).setOrigin(0.5);
    this.stonesText = this.add.text(width/2, 130, '', { fontSize: 18, color: '#e9f1ff' }).setOrigin(0.5);
    this.refreshTexts();

    // Donate button
    this.donateBtn = makeTextButton(this, width/2, height - 80, 320, 64, 'Пожертвовать камень жизни', () => this.onDonate());
  }

  refreshTexts() {
    const s = window.PathHeroesState.data;
    this.progressText.setText(`Пожертвовано: ${formatStat(s.donation.progress)} | Всего набрано (суммарно): ${formatStat(s.donation.total)}`);
    this.stonesText.setText(`Камни жизни: ${formatStat(s.lifeStones)}`);
  }

  onDonate() {
    // Animate growth
    const scaleTo = Math.min(1.4, this.tree.scale + 0.04);
    this.tweens.add({ targets: this.tree, scale: scaleTo, duration: 200, yoyo: false, ease: 'Sine.easeOut' });
    const res = window.PathHeroesState.donateOneStone();
    if (!res.ok) return;
    this.refreshTexts();
    if (res.reward) {
      this._grantReward(res.reward);
      // shrink back
      this.tweens.add({ targets: this.tree, scale: 1, duration: 260, ease: 'Sine.easeInOut' });
    }
  }

  _grantReward(reward) {
    const { width, height } = this.scale;
    // Spawn reward icon and animate drop
    let tex = null;
    if (reward.type === 'scroll') tex = 'reward-scroll';
    if (reward.type === 'starScroll') tex = 'reward-star-scroll';
    if (reward.type === 'character') tex = null; // characters handled directly

    if (reward.type === 'character') {
      window.PathHeroesState.ownCharacter(reward.value, 1);
      const nameMap = { executioner: 'Палач', elder: 'Старейшина', r9: 'R-9', fobos: 'Fob0s', lord: 'Лорд', bastin: 'Бастин' };
      const txt = this.add.text(width/2, -30, `Персонаж: ${nameMap[reward.value] || reward.value}`, { fontSize: 22, color: '#ffd54f' }).setOrigin(0.5);
      this.tweens.add({ targets: txt, y: height/2, alpha: { from: 0, to: 1 }, duration: 600, ease: 'Sine.easeOut', onComplete: () => {
        this.time.delayedCall(700, () => this.tweens.add({ targets: txt, y: height + 40, alpha: 0, duration: 500, onComplete: () => txt.destroy() }));
      }});
    } else if (reward.type === 'scroll' || reward.type === 'starScroll') {
      if (reward.type === 'scroll') window.PathHeroesState.addScrolls(reward.value|0);
      if (reward.type === 'starScroll') window.PathHeroesState.addStarScrolls(reward.value|0);
      const img = this.add.image(width/2, -60, tex).setDisplaySize(80, 80);
      this.tweens.add({ targets: img, y: height/2, duration: 700, ease: 'Quad.easeOut', onComplete: () => {
        this.time.delayedCall(600, () => this.tweens.add({ targets: img, y: height + 60, alpha: 0, duration: 500, ease: 'Sine.easeIn', onComplete: () => img.destroy() }));
      }});
    } else {
      // nothing: show small leaf rustle text
      const txt = this.add.text(width/2, -30, 'Дерево шепчет... (ничего)', { fontSize: 18, color: '#a8c3e6' }).setOrigin(0.5);
      this.tweens.add({ targets: txt, y: height/2, alpha: { from: 0, to: 1 }, duration: 500, ease: 'Sine.easeOut', onComplete: () => {
        this.time.delayedCall(600, () => this.tweens.add({ targets: txt, y: height + 30, alpha: 0, duration: 400, onComplete: () => txt.destroy() }));
      }});
    }
    this.refreshTexts();
  }
}


