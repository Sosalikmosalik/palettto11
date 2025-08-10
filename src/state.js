import { CHARACTERS, CHARACTER_ORDER, ISLANDS, cloneDeep, clamp } from './utils.js';

const STORAGE_KEY = 'pathheroes_save_v1';

export class State {
  constructor() {
    this._default = {
      version: 1,
      scrolls: 0,
      lifeStones: 0,
      soundOn: true,
      graphicsQuality: 'high', // low|medium|high
      // owned: per character id -> array of instances, each { upgrade: number }
      owned: { executioner: [ { upgrade: 0 } ] }, // starter hero so the very first level is playable
      completed: this._makeCompleted(), // islandIndex -> bool[10]
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
    if (!this.data.owned) this.data.owned = {};
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
    return (this.data.completed[prev] || []).every(Boolean);
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
}

