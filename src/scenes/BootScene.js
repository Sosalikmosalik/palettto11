export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {}
  create() {
    try {
      const VER = 'v20250810';
      const k = 'ph_code_version';
      const last = localStorage.getItem(k);
      if (last !== VER) {
        // Wipe only our save to avoid incompatible stale data
        localStorage.removeItem('pathheroes_save_v1');
        localStorage.setItem(k, VER);
      }
    } catch (e) {}
    this.scene.start('Preload');
  }
}

