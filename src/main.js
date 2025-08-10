import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { MapScene } from './scenes/MapScene.js';
import { SummonScene } from './scenes/SummonScene.js';
import { InventoryScene } from './scenes/InventoryScene.js';
import { SettingsScene } from './scenes/SettingsScene.js';
import { DonationScene } from './scenes/DonationScene.js';
import { AchievementsScene } from './scenes/AchievementsScene.js';
import { PrepareScene } from './scenes/PrepareScene.js';
import { BattleScene } from './scenes/BattleScene.js';
import { StarSummonScene } from './scenes/StarSummonScene.js';
import { State } from './state.js';

// Global single state instance (autosaves internally)
window.PathHeroesState = new State();

const config = {
  type: Phaser.AUTO,
  backgroundColor: '#0e1a2b',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: 'game-root',
    width: 960,
    height: 540,
    expandParent: false,
  },
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [
    BootScene,
    PreloadScene,
    MainMenuScene,
    MapScene,
    SummonScene,
    StarSummonScene,
    InventoryScene,
    SettingsScene,
    DonationScene,
    AchievementsScene,
    PrepareScene,
    BattleScene,
  ],
};

// start game
window.addEventListener('load', () => {
  window.PHGame = new Phaser.Game(config);
});

