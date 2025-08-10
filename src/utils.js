export const ISLANDS = 5;

// Characters config (order controls inventory display order)
export const CHARACTERS = {
  executioner: { id: 'executioner', name: 'Палач', cls: 'мечник', faction: 'melee', hp: 280, atk: 30, atkSpeed: 1, chance: 30, sprite: 'executioner' },
  elder: { id: 'elder', name: 'Старейшина', cls: 'маг', faction: 'mage', hp: 440, atk: 75, atkSpeed: 0.5, chance: 20, sprite: 'elder' },
  r9: { id: 'r9', name: 'R-9', cls: 'робот', faction: 'robot', hp: 860, atk: 40, atkSpeed: 3, chance: 15, sprite: 'r9' },
  assassin: { id: 'assassin', name: 'Ассасин', cls: 'мечник', faction: 'melee', hp: 170, atk: 40, atkSpeed: 2, chance: 25, sprite: 'assassin' },
  fobos: { id: 'fobos', name: 'Fob0s', cls: 'робот', faction: 'robot', hp: 1320, atk: 25, atkSpeed: 7, chance: 5, sprite: 'fobos' },
  lord: { id: 'lord', name: 'Лорд', cls: 'мечник', faction: 'melee', hp: 1630, atk: 120, atkSpeed: 2, chance: 5, sprite: 'lord' },
  bastin: { id: 'bastin', name: 'Бастин', cls: 'мечник', faction: 'melee', hp: 2420, atk: 200, atkSpeed: 3, chance: 0, sprite: 'bastin' },
  geomis: { id: 'geomis', name: 'Геомис', cls: 'маг', faction: 'mage', hp: 2890, atk: 700, atkSpeed: 1, chance: 0, sprite: 'geomis' },
  anubis: { id: 'anubis', name: 'Анубис', cls: 'бог', faction: 'god', hp: 4350, atk: 350, atkSpeed: 3, chance: 0, sprite: 'anubis' },
  starlord: { id: 'starlord', name: 'Star Lord', cls: 'космос', faction: 'cosmos', hp: 7800, atk: 1500, atkSpeed: 1, chance: 0, sprite: 'starlord' },
};

export const CHARACTER_ORDER = ['executioner','elder','r9','assassin','fobos','lord','bastin','geomis','anubis','starlord'];

// Star summon pool and chances
export const STAR_SUMMON_ORDER = ['fobos','lord','bastin','geomis','anubis','starlord'];
export const STAR_SUMMON_CHANCES = {
  fobos: 30,
  lord: 30,
  bastin: 20,
  geomis: 10,
  anubis: 7,
  starlord: 3,
};

export function cloneDeep(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

export function randRange(min, max) { return Math.random() * (max - min) + min; }

export function choiceWeighted(entries) {
  // entries: [{key, weight}]
  const total = entries.reduce((a, e) => a + e.weight, 0);
  let r = Math.random() * total;
  for (const e of entries) {
    if ((r -= e.weight) <= 0) return e.key;
  }
  return entries[entries.length - 1].key;
}

export function getMonsterStats(island, level) {
  // Progressive across islands: baseIndex = (island-1)*10 + level
  // Example: Island1 L10 = 1000/100, Island2 L1 = 1100/110, etc.
  const baseIndex = (island - 1) * 10 + level;
  return { hp: 100 * baseIndex, atk: 10 * baseIndex, atkSpeed: 1 };
}

export function makeTextButton(scene, x, y, width, height, label, onClick, opts={}) {
  const radius = 10;
  const bg = scene.add.rectangle(x, y, width, height, 0x19324d, 0.9).setStrokeStyle(2, 0x50e3c2).setOrigin(0.5);
  const txt = scene.add.text(x, y, label, {
    fontFamily: 'Arial', fontSize: opts.fontSize || 24, color: '#e9f1ff', align: 'center', wordWrap: { width: width - 20 }
  }).setOrigin(0.5);
  bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
    bg.setFillStyle(0x255079, 1);
  }).on('pointerup', () => {
    bg.setFillStyle(0x19324d, 0.9);
    if (onClick) onClick();
  }).on('pointerout', () => bg.setFillStyle(0x19324d, 0.9));
  return { bg, txt, destroy: ()=>{ bg.destroy(); txt.destroy(); } };
}

export function drawHpBar(scene, x, y, width, height, color, value01) {
  const bg = scene.add.rectangle(x, y, width, height, 0x000000, 0.4).setOrigin(0, 0.5);
  const fg = scene.add.rectangle(x, y, Math.max(0, width * value01), height, color).setOrigin(0, 0.5);
  return {
    set(v) { fg.width = Math.max(0, width * clamp(v, 0, 1)); },
    destroy() { bg.destroy(); fg.destroy(); },
  };
}

export function formatStat(n) { return new Intl.NumberFormat('ru-RU').format(n); }

export function buildTeamFromSelection(state, selectedIdsWithInstance) {
  // selectedIdsWithInstance: array of { id, index } per instance
  return selectedIdsWithInstance.map(({ id, index }) => {
    const up = state.getUpgradeLevelInstance(id, index);
    const stats = state.getCharacterDisplayStatsForUpgrade(id, up);
    return { id, instanceIndex: index, name: CHARACTERS[id].name, faction: CHARACTERS[id].faction, ...stats, currentHp: stats.hp, isAlive: true, spriteKey: CHARACTERS[id].sprite };
  });
}

// Tuning: chance for zombie presence on Island 3, levels 1-9
export const ISLAND3_ZOMBIE_BASE_CHANCE = 0.2; // per level

export function generateMonsterTeam(island, level) {
  const s = getMonsterStats(island, level);
  const team = [];
  for (let i = 0; i < 5; i++) team.push({ id: `m${i}`, name: 'Монстр', hp: s.hp, atk: s.atk, atkSpeed: s.atkSpeed, currentHp: s.hp, isAlive: true, spriteKey: 'monster' });
  // Special boss: Island 5, Level 10 replaces third monster with a red boss
  if (island === 5 && level === 10) {
    team[2] = { id: 'bossRed', name: 'Красный монстр', hp: 20000, atk: 1750, atkSpeed: s.atkSpeed, currentHp: 20000, isAlive: true, spriteKey: 'boss-red', isBoss: true };
  }
  // Special boss: Island 1, Level 10 — single forest boss at third position
  if (island === 1 && level === 10) {
    for (let i = 0; i < 5; i++) team[i] = null;
    team[2] = { id: 'bossForest', name: 'Лесной босс', hp: 6500, atk: 250, atkSpeed: 2, currentHp: 6500, isAlive: true, spriteKey: 'boss-forest', isBoss: true };
  }
  // Special boss: Island 2, Level 10 — single beach boss at third position
  if (island === 2 && level === 10) {
    for (let i = 0; i < 5; i++) team[i] = null;
    team[2] = { id: 'bossBeach', name: 'Пляжный босс', hp: 12000, atk: 250, atkSpeed: 1, currentHp: 12000, isAlive: true, spriteKey: 'boss-beach', isBoss: true };
  }
  // Special boss: Island 3, Level 10 — single meat boss at third position, triggers zombie phases on death
  if (island === 3 && level === 10) {
    for (let i = 0; i < 5; i++) team[i] = null;
    team[2] = { id: 'bossMeat', name: 'Кровавый фарш', hp: 16000, atk: 350, atkSpeed: 1, currentHp: 16000, isAlive: true, spriteKey: 'boss-meat', isBoss: true };
  }
  // Special boss: Island 4, Level 10 — single cloud boss at third position
  if (island === 4 && level === 10) {
    for (let i = 0; i < 5; i++) team[i] = null;
    team[2] = { id: 'bossCloud', name: 'Облачный босс', hp: 12000, atk: 400, atkSpeed: 1, currentHp: 12000, isAlive: true, spriteKey: 'boss-cloud', isBoss: true };
  }
  // Imitator: Island 5 Levels 1-9 replace a random monster with imitator
  if (island === 5 && level >= 1 && level <= 9) {
    const idx = Math.floor(Math.random() * 5);
    const base = team[idx];
    team[idx] = { id: 'imitator', name: 'Имитатор', hp: base.hp, atk: base.atk, atkSpeed: base.atkSpeed, currentHp: base.hp, isAlive: true, spriteKey: 'imitator', isImitator: true };
  }
  // Zombies: Island 3 Levels 1-9 — parameterized random presence
  if (island === 3 && level >= 1 && level <= 9) {
    const chance = ISLAND3_ZOMBIE_BASE_CHANCE; // can be tuned from game settings later
    // With chance, replace middle-top line 2 (index 1) with a zombie
    if (Math.random() < chance) {
      const colorKey = Math.random() < 0.5 ? 'zombie-stickman-red' : 'zombie-stickman-green';
      team[1] = { id: `zombieStick_${Math.floor(Math.random()*100000)}`, name: 'Зомби', hp: 3500, atk: 200, atkSpeed: 2, currentHp: 3500, isAlive: true, spriteKey: colorKey };
    }
    // Additionally, up to 3 zombies may replace random positions of normal monsters
    const positions = [0,2,3,4];
    for (let i = 0; i < 3; i++) {
      if (Math.random() < chance) {
        const idx = positions[Math.floor(Math.random() * positions.length)];
        const colorKey = Math.random() < 0.5 ? 'zombie-stickman-red' : 'zombie-stickman-green';
        team[idx] = { id: `zombieStick_${Math.floor(Math.random()*100000)}`, name: 'Зомби', hp: 3500, atk: 200, atkSpeed: 2, currentHp: 3500, isAlive: true, spriteKey: colorKey };
      }
    }
  }
  return team;
}

export function nearestLivingIndex(livingFlags, startIndex) {
  // livingFlags: boolean array size N
  const n = livingFlags.length;
  let best = -1; let bestDist = Infinity;
  for (let i = 0; i < n; i++) {
    if (!livingFlags[i]) continue;
    const d = Math.abs(i - startIndex);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

export function softFlash(sprite) {
  if (!sprite) return;
  sprite.setAlpha(0.7);
  sprite.scene.tweens.add({ targets: sprite, alpha: 1, duration: 120, yoyo: false });
}

