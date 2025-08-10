// Lightweight procedural music manager using WebAudio (royalty-free, generated on the fly)
// Plays a gentle, original menu theme. No external assets required.

class MusicManager {
  constructor() {
    this.audioCtx = null;
    this.master = null;
    this.bus = null;
    this.lpFilter = null;
    this.lfo = null; this.lfoGain = null;
    this.pluckBus = null; this.hatBus = null; this.bassBus = null;
    this.fxDelay = null; this.fxDelayFeedback = null; this.fxDelayWet = null;
    this.isPlaying = false;
    this.schedulerTimer = null;
    this.nextNoteTime = 0;
    this.tempo = 96; // BPM
    this.lookaheadMs = 100; // scheduler interval
    this.scheduleAheadTime = 0.4; // seconds
    this.step = 0; // short step for sixteenths (0..15)
    this.longStep = 0; // long-running step for long pattern
    this.patternLengthSteps = 512; // 512 sixteenths at 96 BPM ≈ 80s before full repeat
  }

  _ensureContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
      this.master = this.audioCtx.createGain();
      this.master.gain.value = this._volumeFromState();

      // Music bus with gentle lowpass movement
      this.bus = this.audioCtx.createGain();
      this.lpFilter = this.audioCtx.createBiquadFilter();
      this.lpFilter.type = 'lowpass';
      this.lpFilter.frequency.value = 2400;
      this.lpFilter.Q.value = 0.3;

      // LFO for subtle filter motion
      this.lfo = this.audioCtx.createOscillator();
      this.lfo.frequency.value = 0.05; // slow
      this.lfoGain = this.audioCtx.createGain();
      this.lfoGain.gain.value = 600; // +/- 600 Hz
      this.lfo.connect(this.lfoGain).connect(this.lpFilter.frequency);
      try { this.lfo.start(); } catch (e) {}

      // Pluck bus with a gentle feedback delay (1/8 note)
      this.pluckBus = this.audioCtx.createGain();
      this.fxDelay = this.audioCtx.createDelay(1.0);
      this.fxDelay.delayTime.value = (60 / this.tempo) / 2; // eighth
      this.fxDelayFeedback = this.audioCtx.createGain();
      this.fxDelayFeedback.gain.value = 0.18;
      this.fxDelayWet = this.audioCtx.createGain();
      this.fxDelayWet.gain.value = 0.25;
      // feedback loop
      this.fxDelay.connect(this.fxDelayFeedback).connect(this.fxDelay);
      // routing: pluck -> (dry) bus, and pluck -> delay -> wet -> bus
      this.pluckBus.connect(this.bus);
      this.pluckBus.connect(this.fxDelay);
      this.fxDelay.connect(this.fxDelayWet).connect(this.bus);

      // Other buses
      this.hatBus = this.audioCtx.createGain(); this.hatBus.gain.value = 0.5; this.hatBus.connect(this.bus);
      this.bassBus = this.audioCtx.createGain(); this.bassBus.gain.value = 0.8; this.bassBus.connect(this.bus);

      // Final chain
      this.bus.connect(this.lpFilter).connect(this.master).connect(this.audioCtx.destination);
    }
  }

  _volumeFromState() {
    const v = window.PathHeroesState?.data?.musicVolume || 'medium';
    if (v === 'low') return 0.08;
    if (v === 'high') return 0.22;
    return 0.15;
  }

  applyVolumeFromState() {
    if (!this.master) return;
    try {
      const v = this._volumeFromState();
      const t = this.audioCtx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(v, t, 0.05);
    } catch (e) {}
  }

  attachUnlock(sceneOrDom) {
    // Call once per app; resumes context on first user gesture
    this._ensureContext();
    const resume = () => { try { this.audioCtx.resume(); } catch (e) {} };
    const dom = sceneOrDom?.input?.manager?.canvas || document.body;
    const onFirst = () => {
      resume();
      dom.removeEventListener('pointerdown', onFirst);
      dom.removeEventListener('keydown', onFirst);
    };
    dom.addEventListener('pointerdown', onFirst, { once: true });
    dom.addEventListener('keydown', onFirst, { once: true });
  }

  _noteFreq(semitonesFromA4) {
    return 440 * Math.pow(2, semitonesFromA4 / 12);
  }

  _playTone(time, freq, dur, type = 'sine', gain = 0.4, pan = 0, dest = null) {
    const osc = this.audioCtx.createOscillator();
    const g = this.audioCtx.createGain();
    const p = this.audioCtx.createStereoPanner();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    // Simple ADSR
    const a = 0.01, d = 0.08, s = 0.6, r = Math.max(0.05, dur * 0.25);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + a);
    g.gain.linearRampToValueAtTime(gain * s, time + a + d);
    g.gain.setValueAtTime(gain * s, time + Math.max(0, dur - r));
    g.gain.linearRampToValueAtTime(0, time + dur);
    p.pan.value = pan;
    const target = dest || this.bus;
    osc.connect(g).connect(p).connect(target);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  _playHat(time, dur = 0.05, gain = 0.3, pan = 0) {
    // Simple filtered noise hat
    const sr = this.audioCtx.sampleRate;
    const length = Math.max(1, Math.floor(sr * dur));
    const buffer = this.audioCtx.createBuffer(1, length, sr);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.audioCtx.createBufferSource(); src.buffer = buffer;
    const hp = this.audioCtx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000;
    const g = this.audioCtx.createGain(); g.gain.setValueAtTime(gain, time); g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    const p = this.audioCtx.createStereoPanner(); p.pan.value = pan;
    src.connect(hp).connect(g).connect(p).connect(this.hatBus);
    src.start(time); src.stop(time + dur + 0.02);
  }

  _scheduleStep(stepIdx, longIdx, when) {
    // C minor pentatonic to avoid specific melody references
    const scale = [0, 3, 5, 7, 10]; // semitones in octave (relative)
    const root = -9; // C4 relative to A4
    const beat = 60 / this.tempo; // quarter note
    const isDownbeat = (stepIdx % 4 === 0);

    // Section logic: 4 bars per section, 8 sections => 32 bars (~80s)
    const sixteenthPerBar = 16; // 4/4
    const barIndex = Math.floor(longIdx / sixteenthPerBar);
    const section = Math.floor(barIndex / 4) % 8;

    // 8-section chord progression around Cm: C, Ab, Bb, G, C, Bb, Ab, G
    const chordOffsets = [0, -4, -2, -7, 0, -2, -4, -7];
    const chordRoot = root + chordOffsets[section];

    // Pad chord on downbeats (triangle)
    if (isDownbeat) {
      [0, 7, 10].forEach(iv => this._playTone(when, this._noteFreq(chordRoot + iv), beat * 1.9, 'triangle', 0.16, 0, this.bus));
    }

    // Gentle pluck arpeggio (sine), vary octave per section
    const octaveBump = (section % 2 === 0 ? 12 : 0);
    const arpDir = (section % 4 < 2) ? 1 : -1;
    const idx = (stepIdx + (arpDir > 0 ? 2 : 5)) % scale.length;
    const note = chordRoot + scale[idx] + octaveBump;
    const jitter = (Math.random() - 0.5) * 0.005;
    const pan = (Math.random() - 0.5) * 0.4;
    this._playTone(when + jitter, this._noteFreq(note), beat * 0.45, 'sine', 0.22, pan, this.pluckBus);

    // Occasional higher sparkle
    if (stepIdx % 8 === 4) {
      const n2 = chordRoot + 12 + scale[(stepIdx + 1) % scale.length] + 12;
      this._playTone(when + beat * 0.25 + jitter, this._noteFreq(n2), beat * 0.35, 'sine', 0.12, -pan, this.pluckBus);
    }

    // Soft bass pulse on bars 1 and 3 in each 4-bar section
    if (isDownbeat && (barIndex % 4 === 0 || barIndex % 4 === 2)) {
      const bass = chordRoot - 12;
      this._playTone(when, this._noteFreq(bass), beat * 0.5, 'sine', 0.12, 0, this.bassBus);
    }

    // Hats: vary density by section (more sparse on even sections)
    const hatDensity = (section % 2 === 0) ? 0.6 : 0.85;
    if (stepIdx % 2 === 1 && Math.random() < hatDensity) {
      const panH = (Math.random() - 0.5) * 0.6;
      this._playHat(when, 0.04, 0.22, panH);
    }
  }

  _scheduler() {
    const now = this.audioCtx.currentTime;
    while (this.nextNoteTime < now + this.scheduleAheadTime) {
      // update delay time just in case tempo changed
      if (this.fxDelay) this.fxDelay.delayTime.setValueAtTime((60 / this.tempo) / 2, this.nextNoteTime);
      this._scheduleStep(this.step, this.longStep, this.nextNoteTime);
      const sixteenth = (60 / this.tempo) / 4;
      this.nextNoteTime += sixteenth;
      this.step = (this.step + 1) % 16;
      this.longStep = (this.longStep + 1) % this.patternLengthSteps;
    }
  }

  playMenuTheme() {
    if (this.isPlaying) return;
    if (!window.PathHeroesState?.data?.soundOn) return;
    this._ensureContext();
    this.attachUnlock();
    try { this.audioCtx.resume(); } catch (e) {}
    this.isPlaying = true;
    this.nextNoteTime = this.audioCtx.currentTime + 0.05;
    this.step = 0;
    this.longStep = 0;
    this.schedulerTimer = setInterval(() => this._scheduler(), this.lookaheadMs);
  }

  stop() {
    if (!this.audioCtx) return;
    this.isPlaying = false;
    if (this.schedulerTimer) { clearInterval(this.schedulerTimer); this.schedulerTimer = null; }
    // quick fade out
    if (this.master) {
      try {
        const t = this.audioCtx.currentTime;
        this.master.gain.cancelScheduledValues(t);
        this.master.gain.setTargetAtTime(0, t, 0.08);
      } catch (e) {}
    }
  }
}

export const music = new MusicManager();


