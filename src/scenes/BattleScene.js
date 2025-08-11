import { buildTeamFromSelection, generateMonsterTeam, makeTextButton, drawHpBar, nearestLivingIndex, softFlash, formatStat, getMonsterStats } from '../utils.js';
import { music } from '../music.js';

export class BattleScene extends Phaser.Scene {
  constructor() { super('Battle'); }
  init(data) { this.island = data.island; this.level = data.level; this.teamIds = data.team; this.replay = !!data.replay; }

  create() {
    // Ensure state shape is normalized so battle-side increments (achievements) never access undefined
    try { window.PathHeroesState?.ensureIntegrity?.(); } catch (e) {}
    this.ended = false;
    const { width, height } = this.scale;
    music.stop();
    // background by island (1-5 story, 6-10 extended)
    const bgList = ['bg-jungle','bg-beach','bg-village','bg-fog','bg-desert','bg-dungeon','bg-museum','bg-lab','bg-hell','bg-space'];
    const islandIdx = Math.max(1, Math.min(10, (this.island|0)));
    const bgKey = bgList[islandIdx - 1];
    if (bgKey) this.add.image(width/2, height/2, bgKey).setDisplaySize(width, height);
    this.add.text(24, 20, `Бой — Остров ${this.island}, Уровень ${this.level}`, { fontSize: 22, color: '#e9f1ff' });
    this.add.text(width - 24, 20, '5 vs 5', { fontSize: 18, color: '#a8c3e6' }).setOrigin(1,0);

    // Build teams
    this.playerTeam = buildTeamFromSelection(window.PathHeroesState, this.teamIds);
    while (this.playerTeam.length < 5) this.playerTeam.push(null); // empty slots
    this.enemyTeam = generateMonsterTeam(this.island, this.level);

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
    // Defer round start until after entrance tween (~350ms)
    this.time.delayedCall(380, () => {
      if (this.ended) return;
      this.roundStartAt = this.time.now;
      // Initialize original stationary battle engine
      this._initializeUnits();
      this._setupAbilities();
      this._startEngine();
      // After 1 second from round start, transform imitators
      this.time.delayedCall(1000, () => this._transformImitators());
    });
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

      // refresh attack scheduling context
      if (!this.enemyCtx) this.enemyCtx = new Array(5).fill(null);
      const interval = 1000 / Math.max(0.0001, enemy.atkSpeed || 1);
      const sprite = this.enemySprites[i];
      const hpBar = this.enemyHpBars[i];
      this.enemyCtx[i] = { team: 'enemy', index: i, unit: enemy, sprite, hpBar, nextAttackAt: this.time.now + interval };
    }
  }

  _flashTransform(sprite) {
    if (!sprite) return;
    sprite.setScale(sprite.scaleX * 1.2);
    this.tweens.add({ targets: sprite, alpha: { from: 0.2, to: 1 }, duration: 280 });
    this.tweens.add({ targets: sprite, scaleX: { from: sprite.scaleX, to: sprite.scaleX/1.2 }, scaleY: { from: sprite.scaleY, to: sprite.scaleY/1.2 }, duration: 320, ease: 'Sine.easeOut' });
  }

  // New battle engine (single scheduler)
  _initializeUnits() {
    const now = this.time.now;
    const startBase = (this.roundStartAt || now);
    this.playerCtx = new Array(5).fill(null);
    this.enemyCtx = new Array(5).fill(null);
    for (let i = 0; i < 5; i++) {
      const p = this.playerTeam[i];
      if (p) {
        const interval = 1000 / Math.max(0.0001, p.atkSpeed || 1);
        this.playerCtx[i] = {
          team: 'player', index: i, unit: p,
          sprite: this.playerSprites[i], hpBar: this.playerHpBars[i],
          nextAttackAt: startBase + interval, atkInterval: interval,
          robotNextAt: p.faction === 'robot' ? startBase + 2000 : Infinity,
          meteorNextAt: p.id === 'geomis' ? startBase + 3000 : Infinity,
          starNextAt: p.id === 'starlord' ? startBase + 5000 : Infinity,
          summonNextAt: Infinity,
        };
      }
      const e = this.enemyTeam[i];
      if (e) {
        const interval = 1000 / Math.max(0.0001, e.atkSpeed || 1);
        this.enemyCtx[i] = {
          team: 'enemy', index: i, unit: e,
          sprite: this.enemySprites[i], hpBar: this.enemyHpBars[i],
          nextAttackAt: startBase + interval, atkInterval: interval,
          robotNextAt: e.faction === 'robot' ? startBase + 2000 : Infinity,
          meteorNextAt: (e.originalId === 'geomis') ? startBase + 3000 : Infinity,
          starNextAt: (e.originalId === 'starlord') ? startBase + 5000 : Infinity,
          summonNextAt: e.id === 'bossCloud' ? startBase + 3000 : Infinity,
        };
      }
    }
  }

  _setupAbilities() {
    const now = this.time.now;
    const startBase = Math.max(now, this.roundStartAt || now);
    this.nextAnubisBuffAt = startBase + 3000;
    this.nextEnemyAnubisBuffAt = startBase + 3000;
  }

  // New simplified lane battle: units move towards their target and attack in melee
  _startLaneBattle() {
    // Parameters
    this.attackRangePx = 26; // melee reach
    this.moveSpeedPxPerSec = 80; // march speed

    // Prepare per-unit runtime state
    const initCtxSide = (teamArr, spritesArr, hpBarsArr, isPlayer) => {
      const ctxSide = new Array(5).fill(null);
      for (let i = 0; i < 5; i++) {
        const u = teamArr[i];
        if (!u) continue;
        const interval = 1000 / Math.max(0.0001, u.atkSpeed || 1);
        ctxSide[i] = {
          unit: u,
          sprite: spritesArr[i],
          hpBar: hpBarsArr[i],
          laneIndex: i,
          isPlayer,
          targetLane: i,
          state: 'moving',
          nextAttackAt: (this.roundStartAt || this.time.now) + interval,
          atkInterval: interval,
        };
      }
      return ctxSide;
    };

    this.playerLaneCtx = initCtxSide(this.playerTeam, this.playerSprites, this.playerHpBars, true);
    this.enemyLaneCtx = initCtxSide(this.enemyTeam, this.enemySprites, this.enemyHpBars, false);

    if (this.laneEngineTimer) { try { this.laneEngineTimer.remove(false); } catch (e) {} }
    this.laneEngineTimer = this.time.addEvent({ delay: 16, loop: true, callback: () => this._laneTick() });
  }

  _laneTick() {
    if (this.ended) return;
    const now = this.time.now;
    const dt = 16; // ms per tick target

    const anyAlive = arr => arr.some(u => u && u.isAlive);
    const playersAlive = anyAlive(this.playerTeam);
    const enemiesAlive = anyAlive(this.enemyTeam);
    if (!playersAlive) { this._onTeamWiped('player'); return; }
    if (!enemiesAlive) { this._onTeamWiped('enemy'); return; }

    const findNewTargetLane = (isPlayer, fromLane) => {
      const oppTeam = isPlayer ? this.enemyTeam : this.playerTeam;
      const living = oppTeam.map(x => x && x.isAlive);
      const idx = nearestLivingIndex(living, fromLane);
      return idx; // -1 if none
    };

    const stepSide = (ctxSide, oppCtxSide) => {
      for (let i = 0; i < ctxSide.length; i++) {
        const ctx = ctxSide[i];
        if (!ctx) continue;
        const u = ctx.unit;
        if (!u || !u.isAlive) continue;

        // Ensure we have a valid target lane
        if (ctx.targetLane == null || ctx.targetLane === -1 || !(oppCtxSide[ctx.targetLane]?.unit?.isAlive)) {
          ctx.targetLane = findNewTargetLane(ctx.isPlayer, ctx.laneIndex);
          if (ctx.targetLane === -1) continue; // no targets, will be handled by wipe check
        }

        const oppCtx = oppCtxSide[ctx.targetLane];
        const oppSprite = oppCtx?.sprite;
        const oppUnit = oppCtx?.unit;
        if (!oppUnit || !oppUnit.isAlive || !oppSprite) continue;

        const mySprite = ctx.sprite;
        if (!mySprite) continue;

        // Move toward opponent until within melee range
        const dx = (oppSprite.x - mySprite.x);
        const dir = Math.sign(dx) || (ctx.isPlayer ? 1 : -1);
        const dist = Math.abs(dx);
        if (dist > this.attackRangePx) {
          const stepPx = (this.moveSpeedPxPerSec * dt) / 1000;
          const move = Math.min(stepPx, Math.max(0, dist - this.attackRangePx));
          mySprite.x += dir * move;
          ctx.state = 'moving';
        } else {
          // In range: attack on interval
          ctx.state = 'attacking';
          if (now >= ctx.nextAttackAt) {
            // Apply damage
            oppUnit.currentHp -= u.atk;
            // Small nudge
            const ox = mySprite.x; const nx = ox + (ctx.isPlayer ? 6 : -6);
            this.tweens.add({ targets: mySprite, x: nx, duration: 80, yoyo: true, onComplete: () => { try { mySprite.setX(ox); } catch (e) {} } });
            // HP bar update / death
            if (oppUnit.currentHp <= 0) {
              oppUnit.currentHp = 0; oppUnit.isAlive = false;
              const os = oppSprite;
              if (os) this.tweens.add({ targets: os, alpha: 0, scale: 0.7, duration: 220, ease: 'Sine.easeIn', onComplete: () => { try { if (os && os.scene) os.setVisible(false); } catch (e) {} } });
              oppCtx.hpBar?.set?.(0);
              // retarget next tick automatically
            } else {
              const hp01 = oppUnit.currentHp / oppUnit.hp;
              oppCtx.hpBar?.set?.(hp01);
            }
            // Schedule next swing strictly by atk speed
            ctx.nextAttackAt = now + ctx.atkInterval;
          }
        }
      }
    };

    stepSide(this.playerLaneCtx, this.enemyLaneCtx);
    stepSide(this.enemyLaneCtx, this.playerLaneCtx);
  }

  _startEngine() {
    if (this.engineTimer) { try { this.engineTimer.remove(false); } catch (e) {} }
    this.engineTimer = this.time.addEvent({ delay: 16, loop: true, callback: () => this._engineTick() });
  }

  _engineTick() {
    if (this.ended) return;
    const now = this.time.now;
    try {
      // sun buffs
      if (now >= (this.nextAnubisBuffAt || Infinity)) {
        const anyAnubisAlive = this.playerTeam.some(u => u && u.id === 'anubis' && u.isAlive);
        if (anyAnubisAlive) { this.sunBuffUntil = now + 2000; this._spawnSun(); }
        this.nextAnubisBuffAt = now + 3000;
      }
      if (now >= (this.nextEnemyAnubisBuffAt || Infinity)) {
        const anyImitatorAnubisAlive = this.enemyTeam.some(u => u && u.originalId === 'anubis' && u.isAlive);
        if (anyImitatorAnubisAlive) { this.enemySunBuffUntil = now + 2000; this._spawnEnemySun(); }
        this.nextEnemyAnubisBuffAt = now + 3000;
      }

      const step = (ctxArr, isPlayer) => {
        for (let i = 0; i < ctxArr.length; i++) {
          const ctx = ctxArr[i];
          if (!ctx) continue;
          const u = ctx.unit;
          if (!u || !u.isAlive) continue;

          // Enforce first attack strictly after round start + own interval
          if (!ctx._startGuardApplied) {
            const rs = this.roundStartAt || 0;
            if (Number.isFinite(ctx.atkInterval)) {
              ctx.nextAttackAt = Math.max(ctx.nextAttackAt || 0, rs + ctx.atkInterval);
            }
            if (ctx.robotNextAt !== undefined && ctx.robotNextAt !== Infinity) {
              ctx.robotNextAt = Math.max(ctx.robotNextAt, rs + 2000);
            }
            if (ctx.meteorNextAt !== undefined && ctx.meteorNextAt !== Infinity) {
              ctx.meteorNextAt = Math.max(ctx.meteorNextAt, rs + 3000);
            }
            if (ctx.starNextAt !== undefined && ctx.starNextAt !== Infinity) {
              ctx.starNextAt = Math.max(ctx.starNextAt, rs + 5000);
            }
            if (ctx.summonNextAt !== undefined && ctx.summonNextAt !== Infinity && u.id === 'bossCloud' && !isPlayer) {
              ctx.summonNextAt = Math.max(ctx.summonNextAt, rs + 3000);
            }
            ctx._startGuardApplied = true;
          }

          // regular attack (no catch-up to avoid burst on start)
          if (now >= ctx.nextAttackAt) {
            this._attackUnit(ctx, isPlayer);
            ctx.nextAttackAt = now + ctx.atkInterval;
            if (this.ended) return;
          }

          // robot extra
          if (now >= ctx.robotNextAt) {
            this._attackUnit(ctx, isPlayer, { multiplier: 2, special: 'robot' });
            ctx.robotNextAt = now + 2000;
          }

          // geomis meteor
          if (now >= ctx.meteorNextAt) {
            this._geomisMeteor(ctx, isPlayer);
            ctx.meteorNextAt = now + 3000;
          }

          // starlord aoe
          if (now >= ctx.starNextAt) {
            this._starLordAoe(ctx, isPlayer);
            ctx.starNextAt = now + 5000;
          }

          // cloud boss summon
          if (!isPlayer && u.id === 'bossCloud' && now >= ctx.summonNextAt) {
            this._cloudBossSummon();
            ctx.summonNextAt = now + 3000;
          }

          // Island 6 monsters: 20% each second to fully heal
          if (!isPlayer && this.island === 6 && (!u.isBoss)) {
            if (!ctx.healNextAt) ctx.healNextAt = (this.roundStartAt || now) + 1000;
            if (now >= ctx.healNextAt) {
              ctx.healNextAt = now + 1000;
              if (Math.random() < 0.2) {
                u.currentHp = u.hp;
                const hp01 = u.currentHp / u.hp;
                ctx.hpBar?.set?.(hp01);
                const spr = ctx.sprite;
                if (spr) { try { spr.setAlpha(0.7); this.tweens.add({ targets: spr, alpha: 1, duration: 160 }); } catch (e) {} }
              }
            }
          }

          // village boss extra random strike every 1s
          if (!isPlayer && u.id === 'bossVillage') {
            if (!ctx.villageNextAt) ctx.villageNextAt = (this.roundStartAt || now) + 1000;
            if (now >= ctx.villageNextAt) {
              const livingIdx = [];
              for (let j = 0; j < this.playerTeam.length; j++) if (this.playerTeam[j]?.isAlive) livingIdx.push(j);
              if (livingIdx.length > 0) {
                const targetIndex = livingIdx[Math.floor(Math.random()*livingIdx.length)];
                const target = this.playerTeam[targetIndex];
                const targetSprite = this.playerSprites[targetIndex];
                if (target && targetSprite) {
                  target.currentHp -= 300;
                  softFlash(targetSprite);
                  if (target.currentHp <= 0) {
                    target.currentHp = 0; target.isAlive = false;
                    const sprite = this.playerSprites[targetIndex];
                    if (sprite) this.tweens.add({ targets: sprite, alpha: 0, scale: 0.7, duration: 220, ease: 'Sine.easeIn', onComplete: () => { try { if (sprite && sprite.scene) sprite.setVisible(false); } catch (e) {} } });
                    this.playerHpBars[targetIndex]?.set?.(0);
                  } else {
                    const hp01 = target.currentHp / target.hp;
                    this.playerHpBars[targetIndex]?.set?.(hp01);
                  }
                }
              }
              ctx.villageNextAt = now + 1000;
            }
          }
        }
      };

      step(this.playerCtx, true);
      step(this.enemyCtx, false);
    } catch (err) {
      try { console.warn('Engine tick error', err); } catch (e) {}
    }
  }

  _attackUnit(ctx, isPlayer, opts = {}) {
    const unit = ctx.unit;
    const team = isPlayer ? this.playerTeam : this.enemyTeam;
    const opp = isPlayer ? this.enemyTeam : this.playerTeam;
    const hpBars = isPlayer ? this.enemyHpBars : this.playerHpBars;
    const sprites = isPlayer ? this.enemySprites : this.playerSprites;
    const selfSprites = isPlayer ? this.playerSprites : this.enemySprites;

    // find target nearest same row
    const living = opp.map(x => x && x.isAlive);
    const targetIndex = nearestLivingIndex(living, ctx.index);
    if (targetIndex === -1) { this._onTeamWiped(isPlayer ? 'enemy' : 'player'); return false; }
    const target = opp[targetIndex];

    // Bastin invuln
    if (!isPlayer && (target?.id === 'bastin' || target?.originalId === 'bastin') && (target.invulnUntil || 0) > this.time.now) return true;
    if (isPlayer && target?.originalId === 'bastin' && (target.invulnUntil || 0) > this.time.now) return true;

    // Beach boss special: replace regular hit with 2-target strike
    if (!isPlayer && unit.id === 'bossBeach' && !opts.special) {
      this._beachBossAttack(unit, opp, sprites, hpBars, selfSprites, ctx.index);
      return true;
    }

    let damage = unit.atk * (opts.multiplier || 1);
    if (isPlayer && (this.sunBuffUntil || 0) > this.time.now) damage *= 3;
    if (!isPlayer && (this.enemySunBuffUntil || 0) > this.time.now) damage *= 3;
    target.currentHp -= damage;

    // attack nudge
    const attacker = selfSprites[ctx.index];
    if (attacker) {
      const ox = attacker.x; const dx = ox + (isPlayer ? 8 : -8);
      this.tweens.add({ targets: attacker, x: dx, yoyo: true, duration: 80, onComplete: ()=> attacker.setX(ox) });
    }

    if (target.currentHp <= 0) {
      target.isAlive = false; target.currentHp = 0;
      const sprite = sprites[targetIndex];
      if (sprite) this.tweens.add({ targets: sprite, alpha: 0, scale: 0.7, duration: 220, ease: 'Sine.easeIn', onComplete: () => { try { if (sprite && sprite.scene) sprite.setVisible(false); } catch (e) {} } });
      if (isPlayer) { try { window.PathHeroesState?.addMonsterKill?.(); } catch (e) {} this.killedEnemies++; this._maybeBonusStone(); }
      hpBars[targetIndex]?.set?.(0);
      // Dungeon boss special: on kill, summon a random island6 monster on a random empty ENEMY slot (monsters' side)
      if (!isPlayer && unit.id === 'bossDungeon' && this.island === 6) {
        const emptyIdx = [];
        for (let j = 0; j < this.enemyTeam.length; j++) if (!this.enemyTeam[j]) emptyIdx.push(j);
        if (emptyIdx.length > 0) {
          const slot = emptyIdx[Math.floor(Math.random()*emptyIdx.length)];
          const s = getMonsterStats(6, 1);
          const summoned = { id: `m_spawn_${Date.now()%100000}`, name: 'Монстр', hp: s.hp, atk: s.atk, atkSpeed: s.atkSpeed, currentHp: s.hp, isAlive: true, spriteKey: 'stickman-red' };
          this.enemyTeam[slot] = summoned;
          const { width } = this.scale; const rightX = width * 0.75; const topY = 100; const gapY = 70; const y = topY + slot * gapY;
          const s2 = this.add.image(rightX, y, summoned.spriteKey).setDisplaySize(56, 56).setAlpha(0);
          this.tweens.add({ targets: s2, alpha: 1, duration: 250 });
          this.enemySprites[slot] = s2;
          const hp2 = drawHpBar(this, rightX - 80, y - 40, 120, 10, 0xff5a5a, 1);
          this.enemyHpBars[slot] = hp2;
          // add to ctx so it starts attacking
          const interval = 1000 / Math.max(0.0001, summoned.atkSpeed || 1);
          this.enemyCtx[slot] = {
            team: 'enemy', index: slot, unit: summoned, sprite: s2, hpBar: hp2,
            nextAttackAt: this.time.now + interval, atkInterval: interval,
            robotNextAt: Infinity, meteorNextAt: Infinity, starNextAt: Infinity, summonNextAt: Infinity,
          };
        }
      }
      // check wipe
      const still = opp.some(u => u && u.isAlive);
      if (!still) { this._onTeamWiped(isPlayer ? 'enemy' : 'player'); return false; }
    } else {
      const hp01 = target.currentHp / target.hp;
      hpBars[targetIndex]?.set?.(hp01);
    }
    return true;
  }

  _geomisMeteor(ctx, isPlayer) {
    const opp = isPlayer ? this.enemyTeam : this.playerTeam;
    const sprites = isPlayer ? this.enemySprites : this.playerSprites;
    const hpBars = isPlayer ? this.enemyHpBars : this.playerHpBars;
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
      try {
        meteor.destroy(); softFlash(targetSprite);
        let damage = ctx.unit.atk * 3;
        if (isPlayer && (this.sunBuffUntil || 0) > this.time.now) damage *= 3;
        if (!isPlayer && (this.enemySunBuffUntil || 0) > this.time.now) damage *= 3;
        target.currentHp -= damage;
        if (target.currentHp <= 0) {
          target.isAlive = false; target.currentHp = 0;
          const sprite = sprites[targetIndex];
          if (sprite) this.tweens.add({ targets: sprite, alpha: 0, scale: 0.7, duration: 220, ease: 'Sine.easeIn', onComplete: () => { try { if (sprite && sprite.scene) sprite.setVisible(false); } catch (e) {} } });
          hpBars[targetIndex]?.set?.(0);
          if (isPlayer) { try { window.PathHeroesState?.addMonsterKill?.(); } catch (e) {} this.killedEnemies++; this._maybeBonusStone(); }
          const still = opp.some(u => u && u.isAlive);
          if (!still) { this._onTeamWiped(isPlayer ? 'enemy' : 'player'); return; }
        } else {
          const hp01 = target.currentHp / target.hp;
          hpBars[targetIndex]?.set?.(hp01);
        }
      } catch (err) { try { console.warn('Meteor impact error', err); } catch (e) {} }
    }});
  }

  _starLordAoe(ctx, isPlayer) {
    const opp = isPlayer ? this.enemyTeam : this.playerTeam;
    const sprites = isPlayer ? this.enemySprites : this.playerSprites;
    const hpBars = isPlayer ? this.enemyHpBars : this.playerHpBars;
    const attackerSprite = (isPlayer ? this.playerSprites : this.enemySprites)[ctx.index];
    this._spawnStars(attackerSprite?.x || 0, attackerSprite?.y || 0, isPlayer ? 1 : -1, !isPlayer);
    for (let j = 0; j < opp.length; j++) {
      const target = opp[j]; if (!target || !target.isAlive) continue;
      const targetSprite = sprites[j];
      let damage = ctx.unit.atk * 2;
      if (isPlayer && (this.sunBuffUntil || 0) > this.time.now) damage *= 3;
      if (!isPlayer && (this.enemySunBuffUntil || 0) > this.time.now) damage *= 3;
      target.currentHp -= damage; softFlash(targetSprite);
      if (target.currentHp <= 0) {
        target.isAlive = false; target.currentHp = 0;
        const sprite = sprites[j];
        if (sprite) this.tweens.add({ targets: sprite, alpha: 0, scale: 0.7, duration: 220, ease: 'Sine.easeIn', onComplete: () => { try { if (sprite && sprite.scene) sprite.setVisible(false); } catch (e) {} } });
        hpBars[j]?.set?.(0);
        if (isPlayer) { try { window.PathHeroesState?.addMonsterKill?.(); } catch (e) {} this.killedEnemies++; this._maybeBonusStone(); }
      } else {
        const hp01 = target.currentHp / target.hp;
        hpBars[j]?.set?.(hp01);
      }
    }
    const still = opp.some(u => u && u.isAlive);
    if (!still) { this._onTeamWiped(isPlayer ? 'enemy' : 'player'); return; }
  }

  _cloudBossSummon() {
    // find empty enemy slots except index 2
    const emptyIdx = [];
    for (let j = 0; j < this.enemyTeam.length; j++) {
      if (j === 2) continue;
      if (!this.enemyTeam[j]) emptyIdx.push(j);
    }
    if (emptyIdx.length === 0) return;
    const slot = emptyIdx[Math.floor(Math.random()*emptyIdx.length)];
    const summoned = { id: `summonedBlue${Date.now()%100000}`, name: 'Призванный', hp: 5000, atk: 500, atkSpeed: 1, currentHp: 5000, isAlive: true, spriteKey: 'stickman-blue' };
    this.enemyTeam[slot] = summoned;
    // visuals
    const { width } = this.scale; const rightX = width * 0.75; const topY = 100; const gapY = 70; const y = topY + slot * gapY;
    const s2 = this.add.image(rightX, y, summoned.spriteKey).setDisplaySize(56, 56).setAlpha(0);
    this.tweens.add({ targets: s2, alpha: 1, duration: 250 });
    this.enemySprites[slot] = s2;
    const hp2 = drawHpBar(this, rightX - 80, y - 40, 120, 10, 0x66bbff, 1);
    this.enemyHpBars[slot] = hp2;
    this.tweens.add({ targets: s2, y: { from: y - 3, to: y + 3 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // scheduling
    const now = this.time.now;
    const interval = 1000 / Math.max(0.0001, summoned.atkSpeed || 1);
    this.enemyCtx[slot] = {
      team: 'enemy', index: slot, unit: summoned, sprite: s2, hpBar: hp2,
      nextAttackAt: now + interval, atkInterval: interval,
      robotNextAt: Infinity, meteorNextAt: Infinity, starNextAt: Infinity, summonNextAt: Infinity,
    };
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
      try {
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
          if (sprite) this.tweens.add({ targets: sprite, alpha: 0, scale: 0.7, duration: 220, ease: 'Sine.easeIn', onComplete: () => { try { if (sprite && sprite.scene) sprite.setVisible(false); } catch (e) {} } });
          // achievements: monsters killed +1 for player kills
          if (isPlayer) { try { window.PathHeroesState?.addMonsterKill?.(); } catch (e) {} }
          hpBars[targetIndex]?.set?.(0);
          // Bonus stones 50% only when player kills an enemy
          if (isPlayer) { this.killedEnemies++; this._maybeBonusStone(); }
          // check wipe
          const still = opp.some(u => u && u.isAlive);
          if (!still) { this._onTeamWiped(isPlayer ? 'enemy' : 'player'); return; }
        } else {
          const hp01 = target.currentHp / target.hp;
          hpBars[targetIndex]?.set?.(hp01);
        }
      } catch (err) {
        try { console.warn('Battle tick error', err); } catch (e) {}
      }
    }});

    // Robot faction special: every 2 seconds fire extra hit for 2x ATK with star particles
    if ((isPlayer && unit.faction === 'robot') || (!isPlayer && unit.faction === 'robot')) {
      unit.robotTimer = this.time.addEvent({ delay: 2000, loop: true, callback: () => {
        try {
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
            if (sprite) this.tweens.add({ targets: sprite, alpha: 0, scale: 0.7, duration: 220, ease: 'Sine.easeIn', onComplete: () => { try { if (sprite && sprite.scene) sprite.setVisible(false); } catch (e) {} } });
            hpBars[targetIndex]?.set?.(0);
            if (isPlayer) { try { window.PathHeroesState?.addMonsterKill?.(); } catch (e) {} this.killedEnemies++; this._maybeBonusStone(); }
            const still = opp.some(u => u && u.isAlive);
            if (!still) { this._onTeamWiped(isPlayer ? 'enemy' : 'player'); return; }
          } else {
            const hp01 = target.currentHp / target.hp;
            hpBars[targetIndex]?.set?.(hp01);
          }
        } catch (err) { try { console.warn('Robot tick error', err); } catch (e) {} }
      }});
    }

    // Geomis special: every 3 seconds drop a meteor on a random enemy for 3x ATK
    if ((isPlayer && unit.id === 'geomis') || (!isPlayer && unit.originalId === 'geomis')) {

      unit.meteorTimer = this.time.addEvent({ delay: 3000, loop: true, callback: () => {
        try {
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
            try {
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
                if (sprite) this.tweens.add({ targets: sprite, alpha: 0, scale: 0.7, duration: 220, ease: 'Sine.easeIn', onComplete: () => { try { if (sprite && sprite.scene) sprite.setVisible(false); } catch (e) {} } });
                hpBars[targetIndex]?.set?.(0);
                if (isPlayer) { try { window.PathHeroesState?.addMonsterKill?.(); } catch (e) {} this.killedEnemies++; this._maybeBonusStone(); }
                const still = opp.some(u => u && u.isAlive);
                if (!still) { this._onTeamWiped(isPlayer ? 'enemy' : 'player'); return; }
              } else {
                const hp01 = target.currentHp / target.hp;
                hpBars[targetIndex]?.set?.(hp01);
              }
            } catch (err) { try { console.warn('Meteor impact error', err); } catch (e) {} }
          }});
        } catch (err) { try { console.warn('Meteor tick error', err); } catch (e) {} }
      }});
    }

    // Star Lord special: every 5 seconds deal 2x ATK to all living enemies
    if ((isPlayer && unit.id === 'starlord') || (!isPlayer && unit.originalId === 'starlord')) {
      unit.starLordTimer = this.time.addEvent({ delay: 5000, loop: true, callback: () => {
        try {
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
              if (sprite) this.tweens.add({ targets: sprite, alpha: 0, scale: 0.7, duration: 220, ease: 'Sine.easeIn', onComplete: () => { try { if (sprite && sprite.scene) sprite.setVisible(false); } catch (e) {} } });
              hpBars[j]?.set?.(0);
              if (isPlayer) { try { window.PathHeroesState?.addMonsterKill?.(); } catch (e) {} this.killedEnemies++; this._maybeBonusStone(); }
            } else {
              const hp01 = target.currentHp / target.hp;
              hpBars[j]?.set?.(hp01);
            }
          }
          const still = opp.some(u => u && u.isAlive);
          if (!still) { this._onTeamWiped(isPlayer ? 'enemy' : 'player'); return; }
        } catch (err) { try { console.warn('StarLord tick error', err); } catch (e) {} }
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
    if (Math.random() < 0.5) { try { window.PathHeroesState?.addStones?.(1); } catch (e) {} }
  }

  _onTeamWiped(side) {
    // side: 'player' or 'enemy' wiped
    if (this.ended) return; this.ended = true;
    // stop timers
    if (this.engineTimer) { try { this.engineTimer.remove(false); } catch (e) {} this.engineTimer = null; }
    if (this.laneEngineTimer) { try { this.laneEngineTimer.remove(false); } catch (e) {} this.laneEngineTimer = null; }
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
        if (sprite) this.tweens.add({ targets: sprite, alpha: 0, scale: 0.7, duration: 220, ease: 'Sine.easeIn', onComplete: () => { try { if (sprite && sprite.scene) sprite.setVisible(false); } catch (e) {} } });
        hpBars[targetIdx]?.set?.(0);
      } else {
        const hp01 = target.currentHp / target.hp;
        hpBars[targetIdx]?.set?.(hp01);
      }
    }
    
    // Check if all players are dead
    const stillAlive = opp.some(u => u && u.isAlive);
    if (!stillAlive) {
      this._onTeamWiped('player');
    }
  }
}

