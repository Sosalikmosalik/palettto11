import { makeTextButton, formatStat } from '../utils.js';
import { music } from '../music.js';

const SERIES1 = [
  { id: '1',   icon: 'ach-1',   name: 'Убийца',        need: 100,  desc: 'Убить 100 монстров',   reward: { star: 0, scroll: 2 } },
  { id: '1.2', icon: 'ach-1-2', name: 'Наёмник',       need: 250,  desc: 'Убить 250 монстров',   reward: { star: 0, scroll: 5 } },
  { id: '1.3', icon: 'ach-1-3', name: 'Киллер',        need: 500,  desc: 'Убить 500 монстров',   reward: { star: 1, scroll: 0 } },
  { id: '1.4', icon: 'ach-1-4', name: 'Уничтожитель',  need: 1000, desc: 'Убить 1000 монстров',  reward: { star: 2, scroll: 0 } },
];
const SERIES2 = [
  { id: '2',   icon: 'ach-2',   name: 'Призыватель',   need: 50,   desc: 'Потратить 50 свитков',  reward: { star: 1, scroll: 0 } },
  { id: '2.2', icon: 'ach-2-2', name: 'Призыватель',   need: 200,  desc: 'Потратить 200 свитков', reward: { star: 4, scroll: 0 } },
];
const SERIES3 = [
  { id: '3',   icon: 'ach-3',   name: 'Первые шаги',   need: 1,    desc: 'Пройти первый остров', reward: { star: 0, scroll: 5 } },
  { id: '3.2', icon: 'ach-3-2', name: 'Отдых',         need: 2,    desc: 'Пройти второй остров', reward: { star: 0, scroll: 7, stones: 50 } },
  { id: '3.3', icon: 'ach-3-3', name: 'Зомби-сити',    need: 3,    desc: 'Пройти третий остров', reward: { star: 1, scroll: 0, stones: 100 } },
  { id: '3.4', icon: 'ach-3-4', name: 'Небеса',        need: 4,    desc: 'Пройти четвёртый остров', reward: { star: 3, scroll: 0, stones: 150 } },
  { id: '3.5', icon: 'ach-3-5', name: 'Пирамиды',      need: 5,    desc: 'Пройти пятый остров',  reward: { star: 5, scroll: 0, stones: 250 } },
];

export class AchievementsScene extends Phaser.Scene {
  constructor() { super('Achievements'); }
  create() {
    // Ensure save structure exists to avoid runtime errors when opening this scene on old saves
    try { window.PathHeroesState?.ensureIntegrity?.(); } catch (e) {}
    music.stop(); music.playMenuTheme();
    const state = window.PathHeroesState;
    const { width, height } = this.scale;
    this.add.text(24, 20, 'Достижения', { fontSize: 28, color: '#e9f1ff' });
    makeTextButton(this, width - 90, 32, 140, 44, 'Назад', () => this.scene.start('MainMenu'), { fontSize: 18 });

    this.page = 0;
    this.container = this.add.container(width/2, height/2);
    this.renderPage();

    this.prevBtn = makeTextButton(this, width/2 - 180, height - 60, 80, 40, '<', () => { this.page = Math.max(0, this.page - 1); this.renderPage(); });
    this.nextBtn = makeTextButton(this, width/2 + 180, height - 60, 80, 40, '>', () => { this.page = Math.min(2, this.page + 1); this.renderPage(); });
  }

  renderPage() {
    for (const n of this.container.list) n.destroy(); this.container.removeAll(true);
    const s = window.PathHeroesState.data;
    const entries = this.getEntriesForPage();
    
    if (entries.length === 0) {
      // Show message when no achievements available on this page
      const msg = this.page === 0 ? 'Все достижения завершены!' : 'Нет доступных достижений';
      const emptyText = this.add.text(0, 0, msg, { fontSize: 24, color: '#a8c3e6' }).setOrigin(0.5);
      this.container.add(emptyText);
      return;
    }
    
    let y = -120;
    for (const ent of entries) {
      const bg = this.add.rectangle(0, y, Math.min(640, this.scale.width*0.9), 90, 0x0a1421, 0.9).setStrokeStyle(2, 0x50e3c2).setOrigin(0.5);
      const icon = this.add.image(-bg.width/2 + 48, y, ent.icon).setDisplaySize(56, 56);
      const title = this.add.text(-bg.width/2 + 90, y - 20, ent.name, { fontSize: 18, color: '#e9f1ff' }).setOrigin(0, 0.5);
      const desc = this.add.text(-bg.width/2 + 90, y + 8, ent.desc, { fontSize: 14, color: '#a8c3e6' }).setOrigin(0, 0.5);
      const { progress, need, claimable } = this.getProgress(ent);
      // progress bar
      const barBg = this.add.rectangle(bg.width/2 - 220, y + 20, 200, 12, 0x123048).setOrigin(0.5);
      const barFg = this.add.rectangle(barBg.x - 100, y + 20, Math.max(0, 200 * Math.min(1, progress/need)), 12, 0x50e3c2).setOrigin(0,0.5);
      const pct = Math.floor(100 * Math.min(1, progress/need));
      const counter = this.add.text(barBg.x + 120, y + 20, `${formatStat(progress)} / ${formatStat(need)} (${pct}%)`, { fontSize: 14, color: '#cde2ff' }).setOrigin(0.5);
      const btn = makeTextButton(this, bg.width/2 - 80, y - 4, 140, 36, claimable ? 'Забрать' : '—', () => claimable && this.claim(ent));
      if (!claimable) btn.bg.disableInteractive();
      this.container.add([bg, icon, title, desc, barBg, barFg, counter, btn.bg, btn.txt]);
      y += 110;
    }
  }

  getEntriesForPage() {
    const s = window.PathHeroesState.data;
    const list = [];
    // page 0: series1 current stage, series2 current stage, series3 current stage
    if (this.page === 0) {
      const entry1 = this.getSeriesEntry(SERIES1, s.achievements.series1_stage);
      const entry2 = this.getSeriesEntry(SERIES2, s.achievements.series2_stage);
      const entry3 = this.getSeriesEntry(SERIES3, s.achievements.series3_stage);
      if (entry1) list.push(entry1);
      if (entry2) list.push(entry2);
      if (entry3) list.push(entry3);
    } else if (this.page === 1) {
      // show next stages as preview (if any)
      const entry1 = this.getSeriesEntry(SERIES1, s.achievements.series1_stage + 1, true);
      const entry2 = this.getSeriesEntry(SERIES2, s.achievements.series2_stage + 1, true);
      const entry3 = this.getSeriesEntry(SERIES3, s.achievements.series3_stage + 1, true);
      if (entry1) list.push(entry1);
      if (entry2) list.push(entry2);
      if (entry3) list.push(entry3);
    } else {
      // archives: last stage
      list.push(SERIES1[SERIES1.length-1]);
      list.push(SERIES2[SERIES2.length-1]);
      list.push(SERIES3[SERIES3.length-1]);
    }
    return list;
  }

  getSeriesEntry(series, stage, preview=false) {
    const idx = (stage|0) - 1; if (idx < 0 || idx >= series.length) return null;
    const base = series[idx];
    return base;
  }

  getProgress(ent) {
    const s = window.PathHeroesState.data;
    if (ent.id.startsWith('1')) {
      const progress = s.achievements.monstersKilled || 0;
      const currentStage = s.achievements.series1_stage || 1;
      // Parse stage: '1' -> 1, '1.2' -> 2, '1.3' -> 3, etc.
      const entryStage = ent.id === '1' ? 1 : parseInt(ent.id.split('.')[1], 10);
      const alreadyClaimed = currentStage > entryStage;
      return { progress, need: ent.need, claimable: !alreadyClaimed && progress >= ent.need };
    } else if (ent.id.startsWith('2')) {
      const progress = s.achievements.scrollsSpent || 0;
      const currentStage = s.achievements.series2_stage || 1;
      const entryStage = ent.id === '2' ? 1 : parseInt(ent.id.split('.')[1], 10);
      const alreadyClaimed = currentStage > entryStage;
      return { progress, need: ent.need, claimable: !alreadyClaimed && progress >= ent.need };
    } else {
      // series 3: islands completed
      const progress = Object.keys(s.completed).reduce((acc, k) => acc + (s.completed[k]?.every?.(Boolean) ? 1 : 0), 0);
      const currentStage = s.achievements.series3_stage || 1;
      const entryStage = ent.id === '3' ? 1 : parseInt(ent.id.split('.')[1], 10);
      const alreadyClaimed = currentStage > entryStage;
      return { progress, need: ent.need, claimable: !alreadyClaimed && progress >= ent.need };
    }
  }

  claim(ent) {
    const s = window.PathHeroesState;
    // give reward
    const r = ent.reward || {};
    if (r.scroll) s.addScrolls(r.scroll|0);
    if (r.star) s.addStarScrolls(r.star|0);
    if (r.stones) s.addStones(r.stones|0);
    // advance stage
    if (ent.id.startsWith('1')) s.data.achievements.series1_stage = Math.min((s.data.achievements.series1_stage||1) + 1, SERIES1.length + 1);
    if (ent.id.startsWith('2')) s.data.achievements.series2_stage = Math.min((s.data.achievements.series2_stage||1) + 1, SERIES2.length + 1);
    if (ent.id.startsWith('3')) s.data.achievements.series3_stage = Math.min((s.data.achievements.series3_stage||1) + 1, SERIES3.length + 1);
    s._save();

    // drop reward animation
    const { width, height } = this.scale;
    const tex = r.star ? 'reward-star-scroll' : (r.scroll ? 'reward-scroll' : null);
    if (tex) {
      const img = this.add.image(width/2, -60, tex).setDisplaySize(80, 80);
      this.tweens.add({ targets: img, y: height/2, duration: 700, ease: 'Quad.easeOut', onComplete: () => {
        this.time.delayedCall(600, () => this.tweens.add({ targets: img, y: height + 60, alpha: 0, duration: 500, ease: 'Sine.easeIn', onComplete: () => img.destroy() }));
      }});
    }
    this.renderPage();
  }
}


