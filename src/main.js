import { BootScene } from './scenes/BootScene.js?v=20250810';
import { PreloadScene } from './scenes/PreloadScene.js?v=20250810';
import { MainMenuScene } from './scenes/MainMenuScene.js?v=20250810';
import { MapScene } from './scenes/MapScene.js?v=20250810';
import { SummonScene } from './scenes/SummonScene.js?v=20250810';
import { InventoryScene } from './scenes/InventoryScene.js?v=20250810';
import { SettingsScene } from './scenes/SettingsScene.js?v=20250810';
import { DonationScene } from './scenes/DonationScene.js?v=20250810';
import { AchievementsScene } from './scenes/AchievementsScene.js?v=20250810';
import { PrepareScene } from './scenes/PrepareScene.js?v=20250810';
import { BattleScene } from './scenes/BattleScene.js?v=20250810';
import { StarSummonScene } from './scenes/StarSummonScene.js?v=20250810';
import { State } from './state.js?v=20250810';

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

