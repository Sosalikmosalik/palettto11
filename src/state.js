import { CHARACTERS, CHARACTER_ORDER, ISLANDS, cloneDeep, clamp, choiceWeighted } from './utils.js';

const STORAGE_KEY = 'pathheroes_save_v1';

export class State {
  constructor() {
    this._default = {
      version: 1,
      // Give 2 summon scrolls at the very start and after reset
      scrolls: 2,
      // Separate pool for star summons
      starScrolls: 0,
      voidScrolls: 0,
      lifeStones: 0,
      soundOn: true,
      graphicsQuality: 'high', // low|medium|high
      // owned: per character id -> array of instances, each { upgrade: number }
      owned: { executioner: [ { upgrade: 0 } ] }, // starter hero so the very first level is playable
      completed: this._makeCompleted(), // islandIndex -> bool[10]
      // Minimal achievements structure used by AchievementsScene and battle rewards
      achievements: {
        monstersKilled: 0,
        scrollsSpent: 0,
        series1_stage: 1,
        series2_stage: 1,
        series3_stage: 1,
      },
      // Minimal donation ("дерево даров") state used by DonationScene
      donation: {
        progress: 0, // current progress towards next gift cycle
        total: 0,    // lifetime donated
        target: null, // hidden target donations for current cycle
      },
    };
    this.data = this._load() || cloneDeep(this._default);
    this._normalize();
    this._save();
  }

  _makeCompleted() {
    const obj = {};
    for (let i = 1; i <= ISLANDS; i++) obj[i] = new Array(10).fill(false);
    return obj;
  }

  _normalize() {
    if (!this.data.completed) this.data.completed = this._makeCompleted();
    // Ensure completed arrays exist for all islands up to current ISLANDS
    for (let i = 1; i <= ISLANDS; i++) {
      if (!Array.isArray(this.data.completed[i])) this.data.completed[i] = new Array(10).fill(false);
      if (this.data.completed[i].length !== 10) this.data.completed[i] = new Array(10).fill(false);
    }
    if (!this.data.owned) this.data.owned = {};
    if (typeof this.data.scrolls !== 'number') this.data.scrolls = 0;
    if (typeof this.data.starScrolls !== 'number') this.data.starScrolls = 0;
    if (typeof this.data.voidScrolls !== 'number') this.data.voidScrolls = 0;
    if (!this.data.achievements) {
      this.data.achievements = cloneDeep(this._default.achievements);
    } else {
      // ensure required fields exist
      const a = this.data.achievements;
      if (typeof a.monstersKilled !== 'number') a.monstersKilled = 0;
      if (typeof a.scrollsSpent !== 'number') a.scrollsSpent = 0;
      if (typeof a.series1_stage !== 'number') a.series1_stage = 1;
      if (typeof a.series2_stage !== 'number') a.series2_stage = 1;
      if (typeof a.series3_stage !== 'number') a.series3_stage = 1;
    }
    if (!this.data.donation) {
      this.data.donation = cloneDeep(this._default.donation);
    } else {
      const d = this.data.donation;
      if (typeof d.progress !== 'number') d.progress = 0;
      if (typeof d.total !== 'number') d.total = 0;
      if (!this._isValidDonationTarget(d.target)) d.target = this._pickDonationTarget();
    }
    // migrate legacy owned structure { count, upgrade } to array instances
    Object.keys(this.data.owned).forEach((id) => {
      const entry = this.data.owned[id];
      if (!CHARACTERS[id]) { delete this.data.owned[id]; return; }
      if (Array.isArray(entry)) return; // already new format
      if (entry && typeof entry === 'object' && 'count' in entry) {
        const cnt = Math.max(0, entry.count | 0);
        const up = Math.max(0, Math.min(10, entry.upgrade | 0));
        this.data.owned[id] = Array.from({ length: cnt }, () => ({ upgrade: up }));
      } else {
        // if malformed, reset
        this.data.owned[id] = [];
      }
    });
  }

  hasAnyCharacters() { return Object.values(this.data.owned).some((arr) => Array.isArray(arr) && arr.length > 0); }

  getCompletedCountOnIsland(island) {
    return (this.data.completed[island] || []).filter(Boolean).length;
  }

  isIslandUnlocked(island) {
    if (island === 1) return true;
    const prev = island - 1;
    const prevArr = this.data.completed[prev];
    return Array.isArray(prevArr) && prevArr.length === 10 && prevArr.every(Boolean);
  }

  isLevelCompleted(island, level) {
    return !!this.data.completed[island]?.[level - 1];
  }

  canPlayLevel(island, level) {
    if (!this.isIslandUnlocked(island)) return false;
    return !this.isLevelCompleted(island, level);
  }

  markLevelCompleted(island, level) {
    if (!this.data.completed[island]) this.data.completed[island] = new Array(10).fill(false);
    this.data.completed[island][level - 1] = true;
    this._save();
  }

  addScrolls(amount) {
    this.data.scrolls = clamp((this.data.scrolls || 0) + amount, 0, 999999);
    this._save();
  }

  addStones(amount) {
    this.data.lifeStones = clamp((this.data.lifeStones || 0) + amount, 0, 999999);
    this._save();
  }

  useScroll() {
    if (this.data.scrolls <= 0) return false;
    this.data.scrolls -= 1;
    // track achievements: scrolls spent
    if (this.data.achievements) this.data.achievements.scrollsSpent = (this.data.achievements.scrollsSpent || 0) + 1;
    this._save();
    return true;
  }

  addStarScrolls(amount) {
    this.data.starScrolls = clamp((this.data.starScrolls || 0) + amount, 0, 999999);
    this._save();
  }

  addVoidScrolls(amount) {
    this.data.voidScrolls = clamp((this.data.voidScrolls || 0) + amount, 0, 999999);
    this._save();
  }

  // Safely increment monsters killed achievement counter
  addMonsterKill() {
    try {
      this._normalize();
      if (!this.data.achievements) this.data.achievements = { monstersKilled: 0, scrollsSpent: 0, series1_stage: 1, series2_stage: 1, series3_stage: 1 };
      const a = this.data.achievements;
      a.monstersKilled = (a.monstersKilled || 0) + 1;
      this._save();
    } catch (e) {
      // ignore to avoid breaking battle flow
    }
  }

  useStarScroll() {
    if ((this.data.starScrolls || 0) <= 0) return false;
    this.data.starScrolls -= 1;
    this._save();
    return true;
  }

  useVoidScroll() {
    if ((this.data.voidScrolls || 0) <= 0) return false;
    this.data.voidScrolls -= 1;
    this._save();
    return true;
  }

  ownCharacter(charId, countDelta = 1) {
    if (!this.data.owned[charId] || !Array.isArray(this.data.owned[charId])) this.data.owned[charId] = [];
    for (let i = 0; i < countDelta; i++) this.data.owned[charId].push({ upgrade: 0 });
    this._save();
  }

  getInstances(charId) { return this.data.owned[charId] || []; }
  totalOwned(charId) { return this.getInstances(charId).length; }
  getUpgradeLevelInstance(charId, index) { return this.getInstances(charId)[index]?.upgrade || 0; }

  canUpgradeInstance(charId, index) {
    const inst = this.getInstances(charId)[index];
    if (!inst) return false;
    return inst.upgrade < 10 && this.data.lifeStones >= this.getUpgradeCost(charId, inst.upgrade + 1);
  }

  getUpgradeCost(charId, targetLevel) {
    // cost formula: 5 * targetLevel
    return 5 * targetLevel;
  }

  applyUpgradeInstance(charId, index) {
    const inst = this.getInstances(charId)[index];
    if (!inst) return false;
    const target = clamp(inst.upgrade + 1, 0, 10);
    const cost = this.getUpgradeCost(charId, target);
    if (this.data.lifeStones < cost) return false;
    this.data.lifeStones -= cost;
    inst.upgrade = target;
    this._save();
    return true;
  }

  deleteInstance(charId, index) {
    const arr = this.getInstances(charId);
    if (!arr[index]) return false;
    arr.splice(index, 1);
    this.addStones(5);
    this._save();
    return true;
  }

  getCharacterDisplayStatsForUpgrade(charId, upgrade) {
    const base = CHARACTERS[charId];
    return { hp: base.hp + 50 * upgrade, atk: base.atk + 5 * upgrade, atkSpeed: base.atkSpeed };
  }

  exportToFile() {
    const blob = new Blob([JSON.stringify(this.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pathheroes-save.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  importFromObject(obj) {
    try {
      if (!obj || typeof obj !== 'object') return false;
      this.data = Object.assign({}, this._default, obj);
      this._normalize();
      this._save();
      return true;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  }

  resetProgress() {
    this.data = cloneDeep(this._default);
    this._save();
  }

  // Donation ("дерево даров"): donate one life stone and maybe receive a reward
  donateOneStone() {
    if ((this.data.lifeStones || 0) <= 0) return { ok: false };
    this.data.lifeStones -= 1;
    this.data.donation.progress = (this.data.donation.progress || 0) + 1;
    this.data.donation.total = (this.data.donation.total || 0) + 1;
    if (!this._isValidDonationTarget(this.data.donation.target)) this.data.donation.target = this._pickDonationTarget();
    let reward = null;
    let completed = false;
    // Check completion
    if (this.data.donation.progress >= this.data.donation.target) {
      reward = this._rollDonationReward(this.data.donation.target);
      completed = true;
      // reset cycle
      this.data.donation.progress = 0;
      this.data.donation.target = this._pickDonationTarget();
    }
    this._save();
    return { ok: true, reward, completed };
  }

  _isValidDonationTarget(v) {
    return v === 2 || v === 5 || v === 7 || v === 10 || v === 15 || v === 17 || v === 20 || v === 25;
  }

  _pickDonationTarget() {
    const options = [2,5,7,10,15,17,20,25];
    const idx = Math.floor(Math.random() * options.length);
    return options[idx];
  }

  _rollDonationReward(target) {
    // Tables per requirement
    const roll = (pairs) => choiceWeighted(pairs.map(([key, w]) => ({ key, weight: w })));
    switch (target) {
      case 2: {
        const res = roll([[{ type: 'none' }, 75],[{ type: 'character', value: 'executioner' }, 22],[{ type: 'scroll', value: 1 }, 3]]);
        return res.type === 'none' ? null : res;
      }
      case 5: {
        const res = roll([[{ type: 'none' }, 50],[{ type: 'character', value: 'executioner' }, 30],[{ type: 'character', value: 'elder' }, 15],[{ type: 'scroll', value: 1 }, 5]]);
        return res.type === 'none' ? null : res;
      }
      case 7: {
        const res = roll([[{ type: 'none' }, 45],[{ type: 'character', value: 'r9' }, 35],[{ type: 'scroll', value: 1 }, 15],[{ type: 'character', value: 'fobos' }, 5]]);
        return res.type === 'none' ? null : res;
      }
      case 10: {
        const res = roll([[{ type: 'none' }, 40],[{ type: 'character', value: 'r9' }, 30],[{ type: 'scroll', value: 1 }, 20],[{ type: 'character', value: 'fobos' }, 10]]);
        return res.type === 'none' ? null : res;
      }
      case 15: {
        const res = roll([[{ type: 'none' }, 30],[{ type: 'scroll', value: 1 }, 35],[{ type: 'character', value: 'lord' }, 20],[{ type: 'character', value: 'fobos' }, 15]]);
        return res.type === 'none' ? null : res;
      }
      case 17: {
        const res = roll([[{ type: 'none' }, 20],[{ type: 'scroll', value: 1 }, 40],[{ type: 'character', value: 'lord' }, 20],[{ type: 'character', value: 'fobos' }, 17],[{ type: 'starScroll', value: 1 }, 3]]);
        return res.type === 'none' ? null : res;
      }
      case 20: {
        const res = roll([[{ type: 'none' }, 10],[{ type: 'character', value: 'lord' }, 40],[{ type: 'character', value: 'fobos' }, 40],[{ type: 'starScroll', value: 1 }, 10]]);
        return res.type === 'none' ? null : res;
      }
      case 25: {
        const res = roll([[{ type: 'none' }, 0],[{ type: 'character', value: 'lord' }, 25],[{ type: 'character', value: 'bastin' }, 25],[{ type: 'starScroll', value: 1 }, 50]]);
        return res.type === 'none' ? null : res;
      }
      default:
        return null;
    }
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('LocalStorage save failed', e);
    }
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('LocalStorage load failed', e);
      return null;
    }
  }

  // Public: ensure save structure is present; safe to call from any scene before accessing nested fields
  ensureIntegrity() {
    this._normalize();
    this._save();
  }
}

