export class PreloadScene extends Phaser.Scene {
  constructor() { super('Preload'); }
  preload() {
    const { width, height } = this.scale;
    const barBg = this.add.rectangle(width/2, height/2, Math.min(520, width*0.8), 18, 0x0a1421).setStrokeStyle(2, 0x50e3c2);
    const bar = this.add.rectangle(barBg.x - barBg.width/2 + 2, barBg.y, 2, 12, 0x50e3c2).setOrigin(0,0.5);
    this.load.on('progress', (p) => { bar.width = (barBg.width - 4) * p; });

    // Placeholder images
    this.load.image('ui-button', 'assets/ui/button.svg');
    this.load.image('monster', 'assets/sprites/characters/monster.svg');
    this.load.image('executioner', 'assets/sprites/characters/executioner.svg');
    this.load.image('elder', 'assets/sprites/characters/elder.svg');
    this.load.image('r9', 'assets/sprites/characters/r9.svg');
    this.load.image('assassin', 'assets/sprites/characters/assassin.svg');
    this.load.image('fobos', 'assets/sprites/characters/fobos.svg');
    this.load.image('lord', 'assets/sprites/characters/lord.svg');
    this.load.image('star', 'assets/ui/star.svg');
    this.load.image('shield', 'assets/ui/shield.svg');
    this.load.image('meteor', 'assets/sprites/meteor.svg');
    this.load.image('sun', 'assets/sprites/sun.svg');
    // White versions for imitators
    this.load.image('shield-white', 'assets/ui/shield-white.svg');
    this.load.image('meteor-white', 'assets/sprites/meteor-white.svg');
    this.load.image('sun-white', 'assets/sprites/sun-white.svg');
    this.load.image('star-white', 'assets/ui/star-white.svg');
    this.load.image('bastin', 'assets/sprites/characters/bastin.svg');
    this.load.image('geomis', 'assets/sprites/characters/geomis.svg');
    this.load.image('anubis', 'assets/sprites/characters/anubis.svg');
    this.load.image('starlord', 'assets/sprites/characters/starlord.svg');
    this.load.image('imitator', 'assets/sprites/characters/imitator.svg');
    this.load.image('boss-red', 'assets/sprites/characters/boss-red.svg');
    this.load.image('boss-forest', 'assets/sprites/characters/boss-forest.svg');
    this.load.image('boss-beach', 'assets/sprites/characters/boss-beach.svg');
    this.load.image('boss-cloud', 'assets/sprites/characters/boss-cloud.svg');
    this.load.image('stickman-blue', 'assets/sprites/characters/stickman-blue.svg');
    // New enemies for Island 3
    this.load.image('boss-meat', 'assets/sprites/characters/boss-meat.svg');
    this.load.image('zombie-stickman-red', 'assets/sprites/characters/zombie-stickman-red.svg');
    this.load.image('zombie-stickman-green', 'assets/sprites/characters/zombie-stickman-green.svg');
    this.load.image('remnant-red', 'assets/sprites/characters/remnant-red.svg');
    // Island backgrounds and icons
    this.load.image('bg-jungle', 'assets/backgrounds/bg-jungle.svg');
    this.load.image('bg-beach', 'assets/backgrounds/bg-beach.svg');
    this.load.image('bg-village', 'assets/backgrounds/bg-village.svg');
    this.load.image('bg-fog', 'assets/backgrounds/bg-fog.svg');
    this.load.image('bg-desert', 'assets/backgrounds/bg-desert.svg');
    this.load.image('icon-jungle', 'assets/icons/icon-jungle.svg');
    this.load.image('icon-beach', 'assets/icons/icon-beach.svg');
    this.load.image('icon-village', 'assets/icons/icon-village.svg');
    this.load.image('icon-fog', 'assets/icons/icon-fog.svg');
    this.load.image('icon-desert', 'assets/icons/icon-desert.svg');
    // Donation UI assets
    this.load.image('icon-oak', 'assets/icons/icon-oak.svg');
    this.load.image('big-tree', 'assets/ui/big-tree.svg');
    this.load.image('reward-scroll', 'assets/ui/reward-scroll.svg');
    this.load.image('reward-star-scroll', 'assets/ui/reward-star-scroll.svg');
    // Achievements
    this.load.image('icon-medal', 'assets/icons/icon-medal.svg');
    this.load.image('ach-1', 'assets/icons/ach-1.svg');
    this.load.image('ach-1-2', 'assets/icons/ach-1-2.svg');
    this.load.image('ach-1-3', 'assets/icons/ach-1-3.svg');
    this.load.image('ach-1-4', 'assets/icons/ach-1-4.svg');
    this.load.image('ach-2', 'assets/icons/ach-2.svg');
    this.load.image('ach-2-2', 'assets/icons/ach-2-2.svg');
    this.load.image('ach-3', 'assets/icons/ach-3.svg');
    this.load.image('ach-3-2', 'assets/icons/ach-3-2.svg');
    this.load.image('ach-3-3', 'assets/icons/ach-3-3.svg');
    this.load.image('ach-3-4', 'assets/icons/ach-3-4.svg');
    this.load.image('ach-3-5', 'assets/icons/ach-3-5.svg');
  }
  create() {
    // Version watermark
    try { this.add.text(10, this.scale.height - 16, 'v20250810', { fontSize: 12, color: '#7a8fa8' }).setOrigin(0,1); } catch(e) {}
    this.scene.start('MainMenu');
  }
}

