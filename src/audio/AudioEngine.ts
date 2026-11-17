/**
 * AudioEngine — procedural 128 BPM electro-house track + beat clock + SFX.
 *
 * The whole soundtrack is synthesized live with Web Audio, so it is 100 % original,
 * the beat grid is exact (AudioContext.currentTime is the only clock), and sections
 * can loop on bar boundaries until the LevelDirector opens a gate.
 */
export type Section =
  | 'title' | 'intro' | 'intro2' | 'buildA' | 'breakdown' | 'buildB' | 'preDrop'
  | 'buildC' | 'silence' | 'drop' | 'drop2' | 'outro' | 'end';

interface SectionDef {
  bars: number;
  loopFrom?: number; // 0-based bar inside the section to loop back to while gated
  next: Section;
  kick?: boolean; hats?: 0 | 1 | 2; clap?: boolean; bass?: 0 | 1 | 2; pad?: boolean;
  chords?: boolean; lead?: boolean; riser?: boolean; roll?: boolean; filter?: number;
}

export const SECTIONS: Record<Section, SectionDef> = {
  title:     { bars: 8, loopFrom: 0, next: 'title', kick: true, hats: 1, bass: 1, pad: true, filter: 900 },
  intro:     { bars: 8, next: 'intro2', kick: true, pad: true, filter: 700 },
  intro2:    { bars: 8, next: 'buildA', kick: true, hats: 1, bass: 1, pad: true },
  buildA:    { bars: 16, loopFrom: 8, next: 'breakdown', kick: true, hats: 2, clap: true, bass: 1, pad: true },
  breakdown: { bars: 8, next: 'buildB', pad: true, chords: true, hats: 1 },
  buildB:    { bars: 16, loopFrom: 8, next: 'preDrop', kick: true, hats: 2, clap: true, bass: 2, chords: true },
  preDrop:   { bars: 8, next: 'buildC', kick: true, hats: 1, bass: 1, riser: true, pad: true },
  buildC:    { bars: 8, loopFrom: 0, next: 'silence', hats: 2, roll: true, riser: true, pad: true, bass: 1 },
  silence:   { bars: 1, next: 'drop' }, // last beat of bar is muted; see schedule()
  drop:      { bars: 16, loopFrom: 8, next: 'drop2', kick: true, hats: 2, clap: true, bass: 2, chords: true, lead: true },
  drop2:     { bars: 8, loopFrom: 0, next: 'outro', kick: true, hats: 2, clap: true, bass: 2, chords: true, lead: true, roll: false },
  outro:     { bars: 8, next: 'end', pad: true, chords: true, hats: 1, kick: true },
  end:       { bars: 4, loopFrom: 0, next: 'end', pad: true },
};

const BPM = 128;
const SPB = 60 / BPM; // seconds per beat
const STEP = SPB / 4; // 16th note
// A minor: Am  F  C  G
const PROG = [
  { root: 45, chord: [57, 60, 64] },
  { root: 41, chord: [57, 60, 65] },
  { root: 48, chord: [55, 60, 64] },
  { root: 43, chord: [55, 59, 62] },
];
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export type Judgement = 'perfect' | 'good' | 'off';

export class AudioEngine {
  ctx: AudioContext;
  master: GainNode;
  music: GainNode;
  musicFilter: BiquadFilterNode;
  sfx: GainNode;
  private pump: GainNode;
  private kickBus: GainNode;
  private noise: AudioBuffer;
  private engineOsc?: OscillatorNode;
  private engineGain?: GainNode;
  private engineFilter?: BiquadFilterNode;

  startTime = 0;
  offsetMs = 0;
  running = false;
  section: Section = 'title';
  sectionBar = 0;
  globalBar = 0;
  intensity = 0; // groove tier 0..3 adds layers
  grey = 1; // 1 = fully grey (muffled) 0 = full color
  private nextStepTime = 0;
  private step = 0; // 0..15 inside current bar
  private timer = 0;
  private forced = false;

  /** Return true to leave a looping section (the gate is open). */
  gate: (s: Section) => boolean = () => true;
  onBar: (globalBar: number, section: Section, sectionBar: number) => void = () => {};
  onSection: (s: Section) => void = () => {};
  onBeat: (beatInBar: number) => void = () => {};

  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.ratio.value = 4;
    this.master.connect(comp).connect(this.ctx.destination);
    this.musicFilter = this.ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 800;
    this.musicFilter.Q.value = 0.8;
    this.music = this.ctx.createGain();
    this.music.gain.value = 0.7;
    this.pump = this.ctx.createGain();
    this.music.connect(this.pump).connect(this.musicFilter).connect(this.master);
    this.kickBus = this.ctx.createGain();
    this.kickBus.gain.value = 0.7;
    this.kickBus.connect(this.musicFilter);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.8;
    this.sfx.connect(this.master);
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setVolumes(master: number, music: number, sfx: number) {
    this.master.gain.value = master;
    this.music.gain.value = music * 0.7;
    this.kickBus.gain.value = music * 0.7;
    this.sfx.gain.value = sfx * 0.8;
  }

  // ───────────────────────── clock ─────────────────────────
  now() { return this.ctx.currentTime - this.startTime - this.offsetMs / 1000; }
  beat() { return this.now() / SPB; }
  /** 0..1 phase inside the current beat. */
  phase() { const b = this.beat(); return b - Math.floor(b); }
  judge(): { j: Judgement; ms: number } {
    const b = this.beat();
    const ms = Math.abs(b - Math.round(b)) * SPB * 1000;
    return { j: ms <= 55 ? 'perfect' : ms <= 105 ? 'good' : 'off', ms };
  }
  get spb() { return SPB; }

  async start(section: Section) {
    await this.ctx.resume();
    clearInterval(this.timer);
    this.section = section;
    this.sectionBar = 0;
    this.globalBar = 0;
    this.step = 0;
    this.startTime = this.ctx.currentTime + 0.1;
    this.nextStepTime = this.startTime;
    this.running = true;
    this.onSection(section);
    this.timer = window.setInterval(() => this.tick(), 25);
  }

  /** Jump at the next bar line (used for checkpoints / skipping). */
  jump(section: Section) { this.forced = true; this.pendingJump = section; }
  private pendingJump?: Section;

  stop() {
    this.running = false;
    clearInterval(this.timer);
  }

  private tick() {
    if (!this.running) return;
    // smooth grey filter: 650 Hz grey → 18 kHz neon
    const def = SECTIONS[this.section];
    const target = def.filter ?? 650 * Math.pow(18000 / 650, 1 - this.grey);
    this.musicFilter.frequency.setTargetAtTime(target, this.ctx.currentTime, 0.15);
    while (this.nextStepTime < this.ctx.currentTime + 0.12) {
      this.schedule(this.nextStepTime);
      this.nextStepTime += STEP;
      this.step++;
      if (this.step === 16) { this.step = 0; this.advanceBar(); }
    }
  }

  private advanceBar() {
    this.globalBar++;
    this.sectionBar++;
    const def = SECTIONS[this.section];
    let changed = false;
    if (this.forced && this.pendingJump) {
      this.section = this.pendingJump; this.sectionBar = 0; this.forced = false; this.pendingJump = undefined; changed = true;
    } else if (this.sectionBar >= def.bars) {
      if (def.loopFrom !== undefined && !this.gate(this.section)) this.sectionBar = def.loopFrom;
      else { this.section = def.next; this.sectionBar = 0; changed = true; }
    } else if (def.loopFrom !== undefined && this.sectionBar > def.loopFrom && this.section === 'buildC' && this.gate('buildC')) {
      // buildC exits as soon as the gate opens (on a bar line) so THE DROP lands right away
      this.section = def.next; this.sectionBar = 0; changed = true;
    }
    const when = this.nextStepTime;
    const s = this.section, sb = this.sectionBar, gb = this.globalBar;
    this.at(when, () => { if (changed) this.onSection(s); this.onBar(gb, s, sb); });
  }

  /** Run fn at an audio time (main-thread approximation, ±10 ms). */
  at(when: number, fn: () => void) {
    window.setTimeout(fn, Math.max(0, (when - this.ctx.currentTime) * 1000));
  }

  // ───────────────────────── music ─────────────────────────
  private schedule(t: number) {
    const def = SECTIONS[this.section];
    const st = this.step;
    const chord = PROG[(this.sectionBar) % 4];
    const sec = this.section;
    if (st % 4 === 0) { const b = st / 4; this.at(t, () => this.onBeat(b)); }
    if (sec === 'silence' && st >= 12) return; // the 1-beat hole before THE DROP
    const energy = this.intensity;

    if (def.kick && st % 4 === 0) this.kick(t);
    if (def.clap && (st === 4 || st === 12)) this.clap(t);
    if (def.hats) {
      if (st % 4 === 2) this.hat(t, 0.12, true);
      if (def.hats === 2 && st % 2 === 1) this.hat(t, 0.05, false);
    }
    if (def.roll) {
      const prog = this.sectionBar / SECTIONS[sec].bars;
      const div = prog < 0.5 ? 4 : prog < 0.75 ? 2 : 1;
      if (st % div === 0) this.snare(t, 0.08 + prog * 0.18);
    }
    if (def.bass) {
      if (st % 4 === 2) this.bass(t, chord.root, STEP * 1.6, def.bass === 2 ? 0.32 : 0.22);
      if (def.bass === 2 && st % 4 === 3) this.bass(t, chord.root + 12, STEP * 0.8, 0.12);
    }
    if (def.pad && st === 0) this.pad(t, chord.chord, SPB * 4);
    if (def.chords && (st === 2 || st === 6 || st === 10 || (st === 13 && energy > 0))) this.stab(t, chord.chord);
    if ((def.lead || energy >= 2) && def.kick && st % 2 === 0) {
      const tones = [...chord.chord, chord.chord[0] + 12, chord.chord[1] + 12];
      const n = tones[(st / 2 + this.sectionBar * 3) % tones.length] + 12;
      this.lead(t, n, STEP * 1.6, def.lead ? 0.06 : 0.035);
    }
    if (def.riser && st === 0) this.riser(t, SPB * 4, this.sectionBar / def.bars);
    if (sec === 'drop' && this.sectionBar === 0 && st === 0) { this.crash(t); this.boom(t); }
  }

  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private kick(t: number) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    this.env(g, t, 0.002, 1.0, 0.32);
    o.connect(g).connect(this.kickBus);
    o.start(t); o.stop(t + 0.4);
    // sidechain pump: everything else on the music bus ducks under the kick
    this.pump.gain.setTargetAtTime(0.5, t, 0.005);
    this.pump.gain.setTargetAtTime(1, t + 0.05, 0.07);
  }
  private noiseHit(t: number, type: BiquadFilterType, freq: number, q: number, peak: number, dur: number, dest: AudioNode = this.music) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); this.env(g, t, 0.002, peak, dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  private clap(t: number) { this.noiseHit(t, 'bandpass', 1400, 1.2, 0.5, 0.16); this.noiseHit(t + 0.012, 'bandpass', 1100, 1, 0.3, 0.12); }
  private snare(t: number, v: number) { this.noiseHit(t, 'bandpass', 1800, 0.8, v, 0.1); }
  private hat(t: number, v: number, open: boolean) { this.noiseHit(t, 'highpass', 8000, 0.7, v, open ? 0.14 : 0.04); }
  private crash(t: number) { this.noiseHit(t, 'highpass', 5000, 0.4, 0.35, 1.6); }
  private boom(t: number) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(30, t + 1.2);
    this.env(g, t, 0.005, 0.9, 1.4); o.connect(g).connect(this.music); o.start(t); o.stop(t + 1.5);
  }
  private bass(t: number, midi: number, dur: number, v: number) {
    const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(midi);
    const o2 = this.ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = mtof(midi - 12);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(2200, t); f.frequency.exponentialRampToValueAtTime(220, t + dur);
    const g = this.ctx.createGain(); this.env(g, t, 0.004, v, dur);
    o.connect(f); o2.connect(f); f.connect(g).connect(this.music);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  private pad(t: number, notes: number[], dur: number) {
    for (const n of notes) for (const det of [-7, 7]) {
      const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(n); o.detune.value = det;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.music); o.start(t); o.stop(t + dur + 0.05);
    }
  }
  private stab(t: number, notes: number[]) {
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(5000, t); f.frequency.exponentialRampToValueAtTime(600, t + 0.2);
    const g = this.ctx.createGain(); this.env(g, t, 0.003, 0.09, 0.22);
    f.connect(g).connect(this.music);
    for (const n of notes) for (const det of [-14, 0, 14]) {
      const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n + 12); o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + 0.3);
    }
  }
  private lead(t: number, n: number, dur: number, v: number) {
    const o = this.ctx.createOscillator(); o.type = 'square'; o.frequency.value = mtof(n);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200; f.Q.value = 4;
    const g = this.ctx.createGain(); this.env(g, t, 0.003, v, dur);
    o.connect(f).connect(g).connect(this.music); o.start(t); o.stop(t + dur + 0.05);
  }
  private riser(t: number, dur: number, prog: number) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(400 + prog * 4000, t); f.frequency.exponentialRampToValueAtTime(600 + (prog + 0.125) * 6000, t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.02 + prog * 0.08, t); g.gain.linearRampToValueAtTime(0.03 + prog * 0.1, t + dur);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.02);
    s.connect(f).connect(g).connect(this.music); s.start(t); s.stop(t + dur + 0.05);
  }

  // ───────────────────────── SFX ─────────────────────────
  private get t() { return this.ctx.currentTime; }
  sfxShoot(j: Judgement) {
    const t = this.t;
    const o = this.ctx.createOscillator(); o.type = j === 'off' ? 'triangle' : 'sawtooth';
    const base = j === 'perfect' ? 880 : j === 'good' ? 660 : 330;
    o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base / 4, t + 0.18);
    const g = this.ctx.createGain(); this.env(g, t, 0.003, j === 'off' ? 0.12 : 0.22, 0.2);
    o.connect(g).connect(this.sfx); o.start(t); o.stop(t + 0.25);
    this.noiseHit(t, 'lowpass', 900, 0.7, 0.35, 0.18, this.sfx);
  }
  sfxRemix(combo: number) {
    const t = this.t;
    const chord = PROG[(this.sectionBar) % 4].chord;
    const lift = Math.min(12, Math.floor(combo / 5) * 2);
    chord.forEach((n, i) => {
      const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(n + 12 + lift);
      const g = this.ctx.createGain(); this.env(g, t + i * 0.035, 0.005, 0.1, 0.5);
      o.connect(g).connect(this.sfx); o.start(t + i * 0.035); o.stop(t + 0.7);
    });
    const z = this.ctx.createOscillator(); z.type = 'sine';
    z.frequency.setValueAtTime(400, t); z.frequency.exponentialRampToValueAtTime(2400, t + 0.25);
    const zg = this.ctx.createGain(); this.env(zg, t, 0.01, 0.06, 0.25); z.connect(zg).connect(this.sfx); z.start(t); z.stop(t + 0.3);
  }
  sfxExplode(big = false) {
    const t = this.t;
    this.noiseHit(t, 'lowpass', big ? 500 : 1200, 0.5, big ? 0.9 : 0.45, big ? 1.1 : 0.4, this.sfx);
    const o = this.ctx.createOscillator(); o.frequency.setValueAtTime(big ? 120 : 200, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.4);
    const g = this.ctx.createGain(); this.env(g, t, 0.003, big ? 0.7 : 0.35, 0.45); o.connect(g).connect(this.sfx); o.start(t); o.stop(t + 0.5);
  }
  sfxHurt() {
    const t = this.t;
    const o = this.ctx.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(140, t); o.frequency.linearRampToValueAtTime(70, t + 0.2);
    const g = this.ctx.createGain(); this.env(g, t, 0.003, 0.25, 0.25); o.connect(g).connect(this.sfx); o.start(t); o.stop(t + 0.3);
  }
  sfxEnemyShot() {
    const t = this.t;
    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.3);
    const g = this.ctx.createGain(); this.env(g, t, 0.01, 0.08, 0.3); o.connect(g).connect(this.sfx); o.start(t); o.stop(t + 0.35);
  }
  sfxPickup() {
    const t = this.t;
    [72, 76, 79, 84].forEach((n, i) => {
      const o = this.ctx.createOscillator(); o.type = 'square'; o.frequency.value = mtof(n);
      const g = this.ctx.createGain(); this.env(g, t + i * 0.06, 0.004, 0.07, 0.12);
      o.connect(g).connect(this.sfx); o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.15);
    });
  }
  sfxUi() { const t = this.t; const o = this.ctx.createOscillator(); o.frequency.value = 1200; const g = this.ctx.createGain(); this.env(g, t, 0.002, 0.05, 0.05); o.connect(g).connect(this.sfx); o.start(t); o.stop(t + 0.08); }
  sfxHorn() {
    const t = this.t;
    for (const det of [-20, 0, 20]) {
      const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(52, t + 1.4); o.detune.value = det;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
      const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.18, t + 0.3); g.gain.linearRampToValueAtTime(0.0001, t + 1.5);
      o.connect(f).connect(g).connect(this.sfx); o.start(t); o.stop(t + 1.6);
    }
  }
  sfxFirework() { const t = this.t + Math.random() * 0.05; this.noiseHit(t, 'bandpass', 2500, 0.5, 0.25, 0.6, this.sfx); }
  sfxCheer() { const t = this.t; for (let i = 0; i < 5; i++) this.noiseHit(t + i * 0.08, 'bandpass', 900 + Math.random() * 1200, 2, 0.12, 1.5, this.sfx); }
  sfxBoost() { const t = this.t; this.noiseHit(t, 'bandpass', 700, 1, 0.3, 0.6, this.sfx); }

  engineStart() {
    if (this.engineOsc) return;
    const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 38;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
    const g = this.ctx.createGain(); g.gain.value = 0.0;
    o.connect(f).connect(g).connect(this.sfx); o.start();
    this.engineOsc = o; this.engineGain = g; this.engineFilter = f;
  }
  engineSet(speed01: number) {
    if (!this.engineOsc) return;
    const t = this.t;
    this.engineOsc.frequency.setTargetAtTime(36 + speed01 * 50, t, 0.1);
    this.engineFilter!.frequency.setTargetAtTime(220 + speed01 * 500, t, 0.1);
    this.engineGain!.gain.setTargetAtTime(0.05 + speed01 * 0.07, t, 0.1);
  }
  engineStop() { this.engineOsc?.stop(); this.engineOsc = undefined; }
}

let _engine: AudioEngine | undefined;
export const audio = () => (_engine ??= new AudioEngine());
