import { buildTeamFromSelection, generateMonsterTeam, makeTextButton, drawHpBar, nearestLivingIndex, softFlash, formatStat } from '../utils.js';
import { music } from '../music.js';

export class BattleScene extends Phaser.Scene {
  constructor() { super('Battle'); }
     init(data) { this.island = data.island; this.level = data.level; this.teamIds = data.team; this.replay = !!data.replay; this._prebuiltEnemyTeam = data.enemyTeam || null; }

  create() {
    this.ended = false;
    const { width, height } = this.scale;
    music.stop();
    // Ensure achievements container exists to avoid undefined errors in kill handlers
    try {
      if (window.PathHeroesState) {
        if (!window.PathHeroesState.data) window.PathHeroesState.data = {};
        if (!window.PathHeroesState.data.achievements) {
          window.PathHeroesState.data.achievements = { monstersKilled: 0, scrollsSpent: 0, series1_stage: 1, series2_stage: 1, series3_stage: 1 };
        }
      }
    } catch (e) {}
    // background by island
    const bgKey = ['bg-jungle','bg-beach','bg-village','bg-fog','bg-desert'][Math.max(0, Math.min(4, (this.island|0) - 1))];
    if (bgKey) this.add.image(width/2, height/2, bgKey).setDisplaySize(width, height);
         this.add.text(24, 20, `Бой — Остров ${this.island}, Уровень ${this.level}`, { fontSize: 22, color: '#e9f1ff' });
     // Debug overlay of enemy IDs
     try { const ids = (this.enemyTeam||[]).map(e=>e?.id||'-').join(' | ');
       this.add.text(24, 44, ids, { fontSize: 12, color: '#7a8fa8' }); } catch(e) {}
    this.add.text(width - 24, 20, '5 vs 5', { fontSize: 18, color: '#a8c3e6' }).setOrigin(1,0);

    // Build teams
    this.playerTeam = buildTeamFromSelection(window.PathHeroesState, this.teamIds);
    while (this.playerTeam.length < 5) this.playerTeam.push(null); // empty slots
         this.enemyTeam = this._prebuiltEnemyTeam ? JSON.parse(JSON.stringify(this._prebuiltEnemyTeam)) : generateMonsterTeam(this.island, this.level);
    // Safety: ensure boss-only layout for specific boss levels
    if (this.island === 3 && this.level === 10) {
      for (let i = 0; i < 5; i++) if (i !== 2) this.enemyTeam[i] = null;
      if (!this.enemyTeam[2] || this.enemyTeam[2].id !== 'bossMeat') {
        this.enemyTeam[2] = { id: 'bossMeat', name: 'Кровавый фарш', hp: 16000, atk: 350, atkSpeed: 1, currentHp: 16000, isAlive: true, spriteKey: 'boss-meat', isBoss: true };
      }
    }
    // Debug: enemy team ids
    // try { console.log(`${this._logPrefix || `[I${this.island}L${this.level}]`} Enemy team:`, this.enemyTeam.map(e=>e?.id||null)); } catch(e) {}

    // Layout slots
    const leftX = width * 0.25; const rightX = width * 0.75; const topY = 100; const gapY = 70;

    this.playerSprites = []; this.enemySprites = [];
    this.playerHpBars = []; this.enemyHpBars = [];
    for (let i = 0; i < 5; i++) {
      const y = topY + i * gapY;
      const p = this.playerTeam[i];
      const e = this.enemyTeam[i];
      // player slot
      if (p) {
        const s = this.add.image(leftX - 40, y, p.spriteKey).setDisplaySize(60, 60);
        s.setTint(0xffffff);
        // entrance tween
        this.tweens.add({ targets: s, x: leftX, duration: 350, ease: 'Sine.easeOut' });
        const hp = drawHpBar(this, leftX - 40, y - 40, 120, 10, 0x2ee26b, 1);
        this.playerSprites[i] = s; this.playerHpBars[i] = hp;
        // Bastin: 3s invulnerability with shield visual
        if (p.id === 'bastin') {
          p.invulnUntil = this.time.now + 3000;
          const shield = this.add.image(leftX + 36, y, 'shield').setDisplaySize(30, 30).setAlpha(0.95);
          this.tweens.add({ targets: shield, angle: { from: -8, to: 8 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          p._shieldSprite = shield;
          this.time.delayedCall(3000, () => { if (p._shieldSprite) { p._shieldSprite.destroy(); p._shieldSprite = null; } p.invulnUntil = 0; });
        }
      } else {
        const txt = this.add.text(leftX - 30, y - 10, '— пусто —', { fontSize: 14, color: '#7a8fa8' });
        this.playerSprites[i] = null; this.playerHpBars[i] = { set() {}, destroy() {} };
      }

      // enemy slot
      if (e) {
        const s2 = this.add.image(rightX + 40, y, e.spriteKey).setDisplaySize(60, 60);
        s2.setTint(0x77ff88);
        // entrance tween
        this.tweens.add({ targets: s2, x: rightX, duration: 350, ease: 'Sine.easeOut' });
        const hp2 = drawHpBar(this, rightX - 80, y - 40, 120, 10, 0xff5a5a, 1);
        this.enemySprites[i] = s2; this.enemyHpBars[i] = hp2;
        // Floating animation for cloud boss and blue stickmen
        if (e.id === 'bossCloud' || e.id?.startsWith('summonedBlue')) {
          this.tweens.add({ targets: s2, y: { from: y - 4, to: y + 4 }, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
                // Imitator wobble animation (chaotic)
         if (e.isImitator) {
           this.tweens.add({ targets: s2, angle: { from: -6, to: 6 }, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
           this.tweens.add({ targets: s2, x: { from: rightX - 4, to: rightX + 4 }, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
         }
         // Meat boss: add subtle unsettling jitter
         if (e.id === 'bossMeat') {
           this._applyJitter(s2, { angle: 12, y: 3, scale: 0.03 });
         }
         // Zombies: jittery weird motion
         if (e.id && String(e.id).startsWith('zombieStick_')) {
           this._applyJitter(s2);
         }
        // Imitator Bastin: 3s invulnerability with white shield visual
        if (e.originalId === 'bastin') {
          e.invulnUntil = this.time.now + 3000;
          const shield = this.add.image(rightX - 36, y, 'shield-white').setDisplaySize(30, 30).setAlpha(0.95);
          this.tweens.add({ targets: shield, angle: { from: -8, to: 8 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          e._shieldSprite = shield;
          this.time.delayedCall(3000, () => { if (e._shieldSprite) { e._shieldSprite.destroy(); e._shieldSprite = null; } e.invulnUntil = 0; });
        }
      }
    }

    // Start simulation
    this.killedEnemies = 0;
    this.sunBuffUntil = 0;
    this.enemySunBuffUntil = 0;
    this._anubisBuffTimer = null;
    this._imitatorAnubisBuffTimer = null;
    this._activeSunSprite = null;
    this._activeEnemySunSprite = null;
    this._logPrefix = `[I${this.island}L${this.level}]`;
         this._setupAttackLoops();
    // console.debug(this._logPrefix, 'Ready.');

    // After 1 second, transform imitators into copies of opposing player unit in the same row
    this.time.delayedCall(1000, () => this._transformImitators());
  }

  _applyJitter(sprite, opts = {}) {
    if (!sprite) return;
    const angleAmp = opts.angle ?? Phaser.Math.Between(10, 30);
    const yAmp = opts.y ?? Phaser.Math.Between(2, 8);
    const scaleAmp = opts.scale ?? 0.05;
    const durationA = Phaser.Math.Between(200, 500);
    const durationY = Phaser.Math.Between(260, 600);
    const durationS = Phaser.Math.Between(240, 520);
    this.tweens.add({ targets: sprite, angle: { from: -angleAmp, to: angleAmp }, duration: durationA, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Phaser.Math.Between(0, 250) });
    this.tweens.add({ targets: sprite, y: { from: sprite.y - yAmp, to: sprite.y + yAmp }, duration: durationY, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Phaser.Math.Between(0, 250) });
    this.tweens.add({ targets: sprite, scaleX: { from: sprite.scaleX * (1 - scaleAmp), to: sprite.scaleX * (1 + scaleAmp) }, scaleY: { from: sprite.scaleY * (1 + scaleAmp), to: sprite.scaleY * (1 - scaleAmp) }, duration: durationS, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Phaser.Math.Between(0, 250) });
  }

  _incMonstersKilledSafe(isPlayerKill) {
    if (!isPlayerKill) return;
    try {
      if (!window.PathHeroesState) window.PathHeroesState = { data: { achievements: { monstersKilled: 0, scrollsSpent: 0, series1_stage: 1, series2_stage: 1, series3_stage: 1 } } };
      if (!window.PathHeroesState.data) window.PathHeroesState.data = {};
      if (!window.PathHeroesState.data.achievements) window.PathHeroesState.data.achievements = { monstersKilled: 0, scrollsSpent: 0, series1_stage: 1, series2_stage: 1, series3_stage: 1 };
      const a = window.PathHeroesState.data.achievements;
      a.monstersKilled = (a.monstersKilled || 0) + 1;
    } catch (e) { /* ignore */ }
  }

  _handleEnemyDeathAtIndex(index, unit) {
    // Logging
    // console.debug(`${this._logPrefix} Enemy died at line ${index+1}:`, unit?.id);
    if (!unit) return;
    // Free the slot for potential spawns
    this.enemyTeam[index] = null;
    // Island 3 L10 boss death => spawn 3 zombies at lines 2,3,4
    if (this.island === 3 && this.level === 10 && unit.id === 'bossMeat') {
      // console.debug(`${this._logPrefix} BossMeat dead -> spawning zombies on lines 2,3,4`);
      const slots = [1,2,3];
      for (const slot of slots) {
        if (!this.enemyTeam[slot]) {
          const colorKey = Math.random() < 0.5 ? 'zombie-stickman-red' : 'zombie-stickman-green';
          const z = { id: `zombieStick_${Date.now()%100000}_${slot}`,
            name: 'Зомби', hp: 3500, atk: 200, atkSpeed: 2, currentHp: 3500, isAlive: true, spriteKey: colorKey };
          this._spawnEnemyUnitAt(slot, z, { size: 56, hpColor: 0xff5a5a, jitter: true });
          // console.debug(`${this._logPrefix} Spawned zombie at line ${slot+1}`);
        }
      }
    }
    // Zombie death => spawn 1 red remnant at the same slot
    if (unit.id && String(unit.id).startsWith('zombieStick_')) {
      const slot = index;
      if (!this.enemyTeam[slot]) {
        const r = { id: `remnant_${Date.now()%100000}_${slot}`, name: 'Остаток', hp: 2000, atk: 100, atkSpeed: 2, currentHp: 2000, isAlive: true, spriteKey: 'remnant-red' };
        this._spawnEnemyUnitAt(slot, r, { size: 44, hpColor: 0xff3a3a, jitter: true });
        // console.debug(`${this._logPrefix} Spawned remnant at line ${slot+1}`);
      }
    }
  }

  _spawnEnemyUnitAt(slot, unit, options = {}) {
    const { width } = this.scale; const rightX = width * 0.75; const topY = 100; const gapY = 70; const y = topY + slot * gapY;
    this.enemyTeam[slot] = unit;
    const size = options.size || 56;
    const s2 = this.add.image(rightX, y, unit.spriteKey).setDisplaySize(size, size).setAlpha(0);
    this.tweens.add({ targets: s2, alpha: 1, duration: 250 });
    this.enemySprites[slot] = s2;
    const hpColor = options.hpColor || 0xff5a5a;
    const hp2 = drawHpBar(this, rightX - 80, y - 40, 120, 10, hpColor, 1);
    this.enemyHpBars[slot] = hp2;
    if (options.jitter) this._applyJitter(s2);
    // start its attack loop
    this._createAttacker(false, slot);
  }

  _transformImitators() {
    for (let i = 0; i < 5; i++) {
      const enemy = this.enemyTeam[i];
      if (!enemy || !enemy.isImitator) continue;
      const player = this.playerTeam[i];
      if (!player) continue;
      // copy stats and identity
      enemy.id = `imitate_${player.id}`;
      enemy.name = `Имитация: ${player.name}`;
      enemy.atk = player.atk;
      enemy.atkSpeed = player.atkSpeed;
      // imitator has 3x HP of the copied character
      const hpOld = enemy.currentHp; const hpNewMax = player.hp * 3;
      enemy.hp = hpNewMax; enemy.currentHp = Math.min(hpNewMax, hpOld);
      enemy.spriteKey = player.spriteKey; // visually mimic
      // white tint
      const s = this.enemySprites[i]; if (s) { s.setTexture(player.spriteKey); s.setTint(0xeef3ff); this._flashTransform(s); }
      // set flags for special abilities in attacker loops via copied faction and id
      enemy.faction = player.faction; // robot, mage, etc.
      enemy.originalId = player.id; // store for ability logic

      // start or restart attack loop for this slot with new properties
      if (enemy.timer) enemy.timer.remove(false);
      this._createAttacker(false, i);
    }
  }

  _flashTransform(sprite) {
    if (!sprite) return;
    sprite.setScale(sprite.scaleX * 1.2);
    this.tweens.add({ targets: sprite, alpha: { from: 0.2, to: 1 }, duration: 280 });
    this.tweens.add({ targets: sprite, scaleX: { from: sprite.scaleX, to: sprite.scaleX/1.2 }, scaleY: { from: sprite.scaleY, to: sprite.scaleY/1.2 }, duration: 320, ease: 'Sine.easeOut' });
  }

  _setupAttackLoops() {
    // For each living unit create timed loop per atkSpeed
    for (let i = 0; i < 5; i++) {
      const p = this.playerTeam[i]; if (p) this._createAttacker(true, i);
      const e = this.enemyTeam[i]; if (e) this._createAttacker(false, i);
    }
  }

  _createAttacker(isPlayer, startIndex) {
    const team = isPlayer ? this.playerTeam : this.enemyTeam;
    const opp = isPlayer ? this.enemyTeam : this.playerTeam;
    const hpBars = isPlayer ? this.enemyHpBars : this.playerHpBars;
    const sprites = isPlayer ? this.enemySprites : this.playerSprites;
    const selfSprites = isPlayer ? this.playerSprites : this.enemySprites;

    const unit = team[startIndex];
    if (!unit) return;
    const interval = 1000 / unit.atkSpeed;
    unit.timer = this.time.addEvent({ delay: interval, loop: true, callback: () => {
      if (this.ended) return;
      if (!unit.isAlive) return;
      // find target: slot j nearest to startIndex that is alive
      const living = opp.map(x => x && x.isAlive);
      const targetIndex = nearestLivingIndex(living, startIndex);
      if (targetIndex === -1) { this._onTeamWiped(isPlayer ? 'enemy' : 'player'); return; }
      const target = opp[targetIndex];
      // attack
      // Bastin invulnerability: monsters can't damage him for 3s at start
      if (!isPlayer && (target?.id === 'bastin' || target?.originalId === 'bastin') && (target.invulnUntil || 0) > this.time.now) {
        return; // damage ignored
      }
      // Imitator Bastin invulnerability: players can't damage him for 3s at start
      if (isPlayer && target?.originalId === 'bastin' && (target.invulnUntil || 0) > this.time.now) {
        return; // damage ignored
      }
      // Beach boss special attack: damage 2 random targets
      if (!isPlayer && unit.id === 'bossBeach') {
        this._beachBossAttack(unit, opp, sprites, hpBars, selfSprites, startIndex);
        return;
      }
      
      let damage = unit.atk;
      if (isPlayer && (this.sunBuffUntil || 0) > this.time.now) damage *= 3;
      if (!isPlayer && (this.enemySunBuffUntil || 0) > this.time.now) damage *= 3;
      target.currentHp -= damage;
      // attack animation: slight nudge
      const attacker = selfSprites[startIndex];
      if (attacker) {
        const ox = attacker.x; const dx = ox + (isPlayer ? 8 : -8);
        this.tweens.add({ targets: attacker, x: dx, yoyo: true, duration: 80, onComplete: ()=> attacker.setX(ox) });
      }
      if (target.currentHp <= 0) {
        target.isAlive = false; target.currentHp = 0;
        const sprite = sprites[targetIndex];
        if (sprite) this.tweens.add({ targets: sprite, alpha: 0, scale: 0.7, duration: 220, ease: 'Sine.easeIn', onComplete: () => sprite.setVisible(false) });
                 // achievements: monsters killed +1 for player kills
         this._incMonstersKilledSafe(isPlayer);
         if (hpBars[targetIndex]?.set) hpBars[targetIndex].set(0);
        // Bonus stones 50% only when player kills an enemy
        if (isPlayer) { this.killedEnemies++; this._maybeBonusStone(); }
        // Handle death hooks
        if (isPlayer) this._handleEnemyDeathAtIndex(targetIndex, target);
        // check wipe (recompute after potential spawns)
        const still = opp.some(u => u && u.isAlive);
        if (!still) { this._onTeamWiped(isPlayer ? 'enemy' : 'player'); return; }
      } else {
        const hp01 = target.currentHp / target.hp;
        if (hpBars[targetIndex]?.set) hpBars[targetIndex].set(hp01);
      }
    }});

    // Robot faction special: every 2 seconds fire extra hit for 2x ATK with star particles
    if ((isPlayer && unit.faction === 'robot') || (!isPlayer && unit.faction === 'robot')) {
      unit.robotTimer = this.time.addEvent({ delay: 2000, loop: true, callback: () => {
        if (this.ended || !unit.isAlive) return;
        const living = opp.map(x => x && x.isAlive);
        const targetIndex = nearestLivingIndex(living, startIndex);
        if (targetIndex === -1) return;
        const target = opp[targetIndex];
        // damage
        let damage = unit.atk * 2;
        // Imitator benefits from enemy sun buff instead of player sun buff
        if (isPlayer && (this.sunBuffUntil || 0) > this.time.now) damage *= 3;
        if (!isPlayer && (this.enemySunBuffUntil || 0) > this.time.now) damage *= 3;
        target.currentHp -= damage;
        // star burst from attacker position towards target
        const attackerSprite = selfSprites[startIndex];
        const targetSprite = sprites[targetIndex];
        this._spawnStars(attackerSprite?.x || 0, attackerSprite?.y || 0, isPlayer ? 1 : -1, !isPlayer);
        if (target.currentHp <= 0) {
          target.isAlive = false; target.currentHp = 0;
          const sprite = sprites[targetIndex];
          if (sprite) this.tweens.add({ targets: sprite, alpha: 0, scale: 0.7, duration: 220, ease: 'Sine.easeIn', onComplete: () => sprite.setVisible(false) });
          if (hpBars[targetIndex]?.set) hpBars[targetIndex].set(0);
          if (isPlayer) { this.killedEnemies++; this._maybeBonusStone(); }
          if (isPlayer) this._handleEnemyDeathAtIndex(targetIndex, target);
          const still = opp.some(u => u && u.isAlive);
          if (!still) { this._onTeamWiped(isPlayer ? 'enemy' : 'player'); return; }
        } else {
          const hp01 = target.currentHp / target.hp;
          if (hpBars[targetIndex]?.set) hpBars[targetIndex].set(hp01);
        }
      }});
    }

    // Geomis special: every 3 seconds drop a meteor on a random enemy for 3x ATK
    if ((isPlayer && unit.id === 'geomis') || (!isPlayer && unit.originalId === 'geomis')) {

      unit.meteorTimer = this.time.addEvent({ delay: 3000, loop: true, callback: () => {
        if (this.ended || !unit.isAlive) return;

        const livingIdx = [];
        for (let j = 0; j < opp.length; j++) if (opp[j]?.isAlive) livingIdx.push(j);
        if (livingIdx.length === 0) return;
        const targetIndex = livingIdx[Math.floor(Math.random() * livingIdx.length)];
        const target = opp[targetIndex];
        const targetSprite = sprites[targetIndex];
        if (!target || !targetSprite) return;
        const startX = targetSprite.x + Phaser.Math.Between(-40, 40);
        const startY = targetSprite.y - 240;
        const meteorKey = !isPlayer ? 'meteor-white' : 'meteor';
        const meteor = this.add.image(startX, startY, meteorKey).setDisplaySize(48, 48).setAlpha(0.95);
        this.tweens.add({ targets: meteor, x: targetSprite.x, y: targetSprite.y - 6, duration: 500, ease: 'Quad.easeIn', onComplete: () => {
          meteor.destroy();
          // impact flash
          softFlash(targetSprite);
          // apply damage
          let damage = unit.atk * 3;
          if (isPlayer && (this.sunBuffUntil || 0) > this.time.now) damage *= 3;
          if (!isPlayer && (this.enemySunBuffUntil || 0) > this.time.now) damage *= 3;
          target.currentHp -= damage;
          if (target.currentHp <= 0) {
            target.isAlive = false; target.currentHp = 0;
            const sprite = sprites[targetIndex];
            if (sprite) this.tweens.add({ targets: sprite, alpha: 0, scale: 0.7, duration: 220, ease: 'Sine.easeIn', onComplete: () => sprite.setVisible(false) });
            if (hpBars[targetIndex]?.set) hpBars[targetIndex].set(0);
            if (isPlayer) { this.killedEnemies++; this._maybeBonusStone(); }
            if (isPlayer) this._handleEnemyDeathAtIndex(targetIndex, target);
            const still = opp.some(u => u && u.isAlive);
            if (!still) { this._onTeamWiped(isPlayer ? 'enemy' : 'player'); return; }
          } else {
            const hp01 = target.currentHp / target.hp;
            if (hpBars[targetIndex]?.set) hpBars[targetIndex].set(hp01);
          }
        }});
      }});
    }

    // Star Lord special: every 5 seconds deal 2x ATK to all living enemies
    if ((isPlayer && unit.id === 'starlord') || (!isPlayer && unit.originalId === 'starlord')) {
      unit.starLordTimer = this.time.addEvent({ delay: 5000, loop: true, callback: () => {
        if (this.ended || !unit.isAlive) return;
        const attackerSprite = selfSprites[startIndex];
        // small star burst from the attacker to hint AoE
        this._spawnStars(attackerSprite?.x || 0, attackerSprite?.y || 0, isPlayer ? 1 : -1, !isPlayer);
        let anyKilled = false;
        for (let j = 0; j < opp.length; j++) {
          const target = opp[j]; if (!target || !target.isAlive) continue;
          const targetSprite = sprites[j];
          let damage = unit.atk * 2;
          if (isPlayer && (this.sunBuffUntil || 0) > this.time.now) damage *= 3;
          if (!isPlayer && (this.enemySunBuffUntil || 0) > this.time.now) damage *= 3;
          target.currentHp -= damage;
          softFlash(targetSprite);
          if (target.currentHp <= 0) {
            target.isAlive = false; target.currentHp = 0; anyKilled = true;
            const sprite = sprites[j];
            if (sprite) this.tweens.add({ targets: sprite, alpha: 0, scale: 0.7, duration: 220, ease: 'Sine.easeIn', onComplete: () => sprite.setVisible(false) });
            if (hpBars[j]?.set) hpBars[j].set(0);
            if (isPlayer) { this.killedEnemies++; this._maybeBonusStone(); }
            if (isPlayer) this._handleEnemyDeathAtIndex(j, target);
          } else {
            const hp01 = target.currentHp / target.hp;
            if (hpBars[j]?.set) hpBars[j].set(hp01);
          }
        }
        const still = opp.some(u => u && u.isAlive);
        if (!still) { this._onTeamWiped(isPlayer ? 'enemy' : 'player'); return; }
      }});
    }

    // Anubis aura: every 3 seconds summon a falling sun that empowers player attacks x3 for 2 seconds
    if (isPlayer && unit.id === 'anubis' && !this._anubisBuffTimer) {
      this._anubisBuffTimer = this.time.addEvent({ delay: 3000, loop: true, callback: () => {
        if (this.ended) return;
        const anyAnubisAlive = this.playerTeam.some(u => u && u.id === 'anubis' && u.isAlive);
        if (!anyAnubisAlive) return;
        this.sunBuffUntil = this.time.now + 2000;
        this._spawnSun();
      }});
    }

    // Imitator Anubis aura: every 3 seconds summon a white falling sun that empowers enemy attacks x3 for 2 seconds
    if (!isPlayer && unit.originalId === 'anubis' && !this._imitatorAnubisBuffTimer) {
      this._imitatorAnubisBuffTimer = this.time.addEvent({ delay: 3000, loop: true, callback: () => {
        if (this.ended) return;
        const anyImitatorAnubisAlive = this.enemyTeam.some(u => u && u.originalId === 'anubis' && u.isAlive);
        if (!anyImitatorAnubisAlive) return;
        this.enemySunBuffUntil = this.time.now + 2000;
        this._spawnEnemySun();
      }});
    }

    // Cloud boss summoning: enemy side, island4 level10 boss spawns blue stickmen into empty slots every 3s
    if (!isPlayer && unit.id === 'bossCloud') {
      unit.summonTimer = this.time.addEvent({ delay: 3000, loop: true, callback: () => {
        if (this.ended || !unit.isAlive) return;
        // find empty enemy slots except index 2 (boss position)
        const emptyIdx = [];
        for (let j = 0; j < this.enemyTeam.length; j++) {
          if (j === 2) continue;
          if (!this.enemyTeam[j]) emptyIdx.push(j);
        }
        if (emptyIdx.length === 0) return;
        const slot = emptyIdx[Math.floor(Math.random()*emptyIdx.length)];
        // create summoned unit
        const summoned = { id: `summonedBlue${Date.now()%100000}`, name: 'Призванный', hp: 5000, atk: 500, atkSpeed: 1, currentHp: 5000, isAlive: true, spriteKey: 'stickman-blue' };
        this.enemyTeam[slot] = summoned;
        // create sprite & hp bar
        const { width } = this.scale; const rightX = width * 0.75; const topY = 100; const gapY = 70; const y = topY + slot * gapY;
        const s2 = this.add.image(rightX, y, summoned.spriteKey).setDisplaySize(56, 56).setAlpha(0);
        this.tweens.add({ targets: s2, alpha: 1, duration: 250 });
        this.enemySprites[slot] = s2;
        const hp2 = drawHpBar(this, rightX - 80, y - 40, 120, 10, 0x66bbff, 1);
        this.enemyHpBars[slot] = hp2;
        // floating animation
        this.tweens.add({ targets: s2, y: { from: y - 3, to: y + 3 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        // start its attack loop
        this._createAttacker(false, slot);
      }});
    }
  }

  _spawnSun() {
    const { width } = this.scale;
    if (this._activeSunSprite) { try { this._activeSunSprite.destroy(); } catch (e) {} }
    const sun = this.add.image(width/2, -80, 'sun').setDisplaySize(140, 140).setAlpha(0.95);
    this._activeSunSprite = sun;
    this.tweens.add({ targets: sun, y: 80, duration: 400, ease: 'Quad.easeIn' });
    this.time.delayedCall(2000, () => {
      if (!sun.scene) return;
      this.tweens.add({ targets: sun, alpha: 0, duration: 220, onComplete: () => { if (sun.scene) sun.destroy(); if (this._activeSunSprite === sun) this._activeSunSprite = null; } });
    });
  }

  _spawnEnemySun() {
    const { width } = this.scale;
    if (this._activeEnemySunSprite) { try { this._activeEnemySunSprite.destroy(); } catch (e) {} }
    const sun = this.add.image(width/2, -80, 'sun-white').setDisplaySize(140, 140).setAlpha(0.95);
    this._activeEnemySunSprite = sun;
    this.tweens.add({ targets: sun, y: 80, duration: 400, ease: 'Quad.easeIn' });
    this.time.delayedCall(2000, () => {
      if (!sun.scene) return;
      this.tweens.add({ targets: sun, alpha: 0, duration: 220, onComplete: () => { if (sun.scene) sun.destroy(); if (this._activeEnemySunSprite === sun) this._activeEnemySunSprite = null; } });
    });
  }

  _spawnStars(x, y, dir, isEnemyAttack = false) {
    // spawn simple star shapes flying out
    for (let i = 0; i < 5; i++) {
      const starKey = isEnemyAttack ? 'star-white' : 'star';
      const star = this.add.image(x, y, starKey);
      star.setDisplaySize(12, 12).setAlpha(0.9);
      const dx = (Math.random() * 60 + 40) * dir;
      const dy = (Math.random() - 0.5) * 60;
      this.tweens.add({ targets: star, x: x + dx, y: y + dy, alpha: 0, duration: 400, ease: 'Quad.easeOut', onComplete: () => star.destroy() });
      this.tweens.add({ targets: star, angle: Phaser.Math.Between(-180, 180), duration: 400 });
    }
  }

  _maybeBonusStone() {
    // 50% chance +1 stone on enemy death
    if (Math.random() < 0.5) window.PathHeroesState.addStones(1);
  }

  _onTeamWiped(side) {
    // side: 'player' or 'enemy' wiped
    if (this.ended) return; this.ended = true;
    // stop timers
    for (const u of [...this.playerTeam, ...this.enemyTeam]) {
      if (!u) continue;
      if (u.timer) u.timer.remove(false);
      if (u.robotTimer) u.robotTimer.remove(false);
      if (u.meteorTimer) u.meteorTimer.remove(false);
      if (u.starLordTimer) u.starLordTimer.remove(false);
      if (u.summonTimer) u.summonTimer.remove(false);
      if (u._shieldSprite) { u._shieldSprite.destroy(); u._shieldSprite = null; }
    }
    // stop global timers
    if (this._anubisBuffTimer) { this._anubisBuffTimer.remove(false); this._anubisBuffTimer = null; }
    if (this._imitatorAnubisBuffTimer) { this._imitatorAnubisBuffTimer.remove(false); this._imitatorAnubisBuffTimer = null; }

    if (side === 'enemy') {
      // victory
      const isBoss510 = (this.island === 5 && this.level === 10);
      if (isBoss510) {
        if (!this.replay && !window.PathHeroesState.isLevelCompleted(this.island, this.level)) {
          window.PathHeroesState.addStarScrolls(3);
          window.PathHeroesState.addStones(50);
          window.PathHeroesState.markLevelCompleted(this.island, this.level);
          this._showEndPanel(true, { stones: 50, scrolls: 0, starScrolls: 3 });
        } else {
          const stones = 5;
          window.PathHeroesState.addStones(stones);
          this._showEndPanel(true, { stones, scrolls: 0, starScrolls: 0 });
        }
      } else if (this.island === 1 && this.level === 10) {
        if (!this.replay && !window.PathHeroesState.isLevelCompleted(this.island, this.level)) {
          window.PathHeroesState.addStarScrolls(1);
          window.PathHeroesState.addStones(25);
          window.PathHeroesState.markLevelCompleted(this.island, this.level);
          this._showEndPanel(true, { stones: 25, scrolls: 0, starScrolls: 1 });
        } else {
          const stones = 5;
          window.PathHeroesState.addStones(stones);
          this._showEndPanel(true, { stones, scrolls: 0, starScrolls: 0 });
        }
      } else {
      const baseStones = 5; // guaranteed
      if (!this.replay) window.PathHeroesState.addScrolls(1);
      window.PathHeroesState.addStones(baseStones);
      if (!this.replay) window.PathHeroesState.markLevelCompleted(this.island, this.level);
        this._showEndPanel(true, { stones: baseStones, scrolls: 1, starScrolls: 0 });
      }
    } else {
      this._showEndPanel(false, { stones: 0, scrolls: 0, starScrolls: 0 });
    }
  }

  _showEndPanel(win, reward) {
    const { width, height } = this.scale;
    const c = this.add.container(width/2, height/2);
    const bg = this.add.rectangle(0, 0, Math.min(580, width*0.9), 300, 0x0a1421, 0.95).setStrokeStyle(2, 0x50e3c2);
    c.add(bg);
    c.add(this.add.text(0, -110, win ? 'You won!' : 'Game Over', { fontSize: 32, color: win ? '#2ee26b' : '#ff6b6b' }).setOrigin(0.5));
    if (win) {
      const parts = [];
      if (reward.scrolls) parts.push(`+${reward.scrolls} свиток`);
      if (reward.starScrolls) parts.push(`+${reward.starScrolls} звёздных свитка`);
      if (reward.stones) parts.push(`+${reward.stones} камней жизни`);
      const line = parts.length ? `Награды: ${parts.join(', ')}` : 'Награды: —';
      c.add(this.add.text(0, -50, `${line}\nДоп. шанс камней учитывался по мере убийств`, { fontSize: 18, color: '#e9f1ff', align: 'center' }).setOrigin(0.5));
    }
    const toMenu = makeTextButton(this, 0, 60, 220, 54, 'В главное меню', () => this.scene.start('MainMenu'));
    c.add(toMenu.bg); c.add(toMenu.txt);
    if (win) {
      const toMap = makeTextButton(this, 0, 120, 220, 54, 'К карте', () => this.scene.start('Map'));
      c.add(toMap.bg); c.add(toMap.txt);
    }
  }

  _beachBossAttack(unit, opp, sprites, hpBars, selfSprites, startIndex) {
    // Beach boss attacks 2 random alive targets
    const livingIndices = [];
    for (let j = 0; j < opp.length; j++) {
      if (opp[j]?.isAlive) livingIndices.push(j);
    }
    
    if (livingIndices.length === 0) {
      this._onTeamWiped('player');
      return;
    }
    
    // Select up to 2 random targets
    const targetsToAttack = [];
    const numTargets = Math.min(2, livingIndices.length);
    
    for (let i = 0; i < numTargets; i++) {
      const randomIndex = Math.floor(Math.random() * livingIndices.length);
      const targetIdx = livingIndices[randomIndex];
      targetsToAttack.push(targetIdx);
      // Remove from available targets to avoid hitting same target twice
      livingIndices.splice(randomIndex, 1);
    }
    
    // Attack animation
    const attacker = selfSprites[startIndex];
    if (attacker) {
      const ox = attacker.x; const dx = ox - 8;
      this.tweens.add({ targets: attacker, x: dx, yoyo: true, duration: 80, onComplete: ()=> attacker.setX(ox) });
    }
    
    // Apply damage to each target
    let anyKilled = false;
    for (const targetIdx of targetsToAttack) {
      const target = opp[targetIdx];
      if (!target || !target.isAlive) continue;
      
      // Check Bastin invulnerability
      if ((target?.id === 'bastin' || target?.originalId === 'bastin') && (target.invulnUntil || 0) > this.time.now) {
        continue; // damage ignored
      }
      
      let damage = unit.atk;
      if ((this.enemySunBuffUntil || 0) > this.time.now) damage *= 3;
      target.currentHp -= damage;
      
      // Visual feedback
      const targetSprite = sprites[targetIdx];
      if (targetSprite) {
        // Flash effect
        targetSprite.setAlpha(0.7);
        this.tweens.add({ targets: targetSprite, alpha: 1, duration: 120 });
      }
      
      if (target.currentHp <= 0) {
        target.isAlive = false;
        target.currentHp = 0;
        anyKilled = true;
        const sprite = sprites[targetIdx];
        if (sprite) this.tweens.add({ targets: sprite, alpha: 0, scale: 0.7, duration: 220, ease: 'Sine.easeIn', onComplete: () => sprite.setVisible(false) });
        if (hpBars[targetIdx]?.set) hpBars[targetIdx].set(0);
        // Enemy killed a player — still call generic hook for parity (no special behavior)
      } else {
        const hp01 = target.currentHp / target.hp;
        if (hpBars[targetIdx]?.set) hpBars[targetIdx].set(hp01);
      }
    }
    
    // Check if all players are dead
    const stillAlive = opp.some(u => u && u.isAlive);
    if (!stillAlive) {
      this._onTeamWiped('player');
    }
  }
}

