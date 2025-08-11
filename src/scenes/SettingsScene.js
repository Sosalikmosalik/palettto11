import { makeTextButton } from '../utils.js';
import { music } from '../music.js';

export class SettingsScene extends Phaser.Scene {
  constructor() { super('Settings'); }
  create() {
    const state = window.PathHeroesState;
    const { width } = this.scale;
    music.stop();
    music.playMenuTheme();
    this.add.text(24, 20, 'Настройки', { fontSize: 28, color: '#e9f1ff' });
    const back = makeTextButton(this, width - 90, 32, 140, 44, 'Назад', () => this.scene.start('MainMenu'), { fontSize: 18 });

    // Sound toggle
    const soundBtn = makeTextButton(this, 200, 120, 260, 54, `Звук: ${state.data.soundOn ? 'Вкл' : 'Выкл'}`, () => {
      state.data.soundOn = !state.data.soundOn; state._save(); this.scene.restart();
    });

    // Graphics quality
    const qualities = ['low','medium','high'];
    const qBtn = makeTextButton(this, 200, 190, 260, 54, `Графика: ${state.data.graphicsQuality}`, () => {
      const idx = (qualities.indexOf(state.data.graphicsQuality) + 1) % qualities.length;
      state.data.graphicsQuality = qualities[idx]; state._save(); this.scene.restart();
    });

    // Music volume
    const vols = ['low','medium','high'];
    const volBtn = makeTextButton(this, 200, 260, 260, 54, `Музыка: ${state.data.musicVolume}`, () => {
      const idx = (vols.indexOf(state.data.musicVolume) + 1) % vols.length;
      state.data.musicVolume = vols[idx]; state._save(); music.applyVolumeFromState(); this.scene.restart();
    });

    // Export / Import
    makeTextButton(this, width/2, 300, 260, 54, 'Экспорт прогресса', () => state.exportToFile());
    makeTextButton(this, width/2, 370, 260, 54, 'Импорт прогресса', () => this.doImport());

    // Reset with confirm
    makeTextButton(this, width/2, 450, 280, 54, 'Сбросить прогресс', () => this.doReset());
  }

  doImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      const text = await file.text();
      try {
        const obj = JSON.parse(text);
        const ok = window.PathHeroesState.importFromObject(obj);
        if (ok) location.reload();
      } catch (e) { alert('Некорректный файл сохранения'); }
    };
    input.click();
  }

  doReset() {
    if (!confirm('Точно сбросить весь прогресс?')) return;
    window.PathHeroesState.resetProgress();
    this.scene.start('MainMenu');
  }
}

