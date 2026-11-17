import { create } from 'zustand';
import type { Zone } from './level';

export type Screen = 'loading' | 'title' | 'settings' | 'intro' | 'playing' | 'paused' | 'dead' | 'outro' | 'results' | 'credits';
export type Quality = 'low' | 'medium' | 'high';

export interface Settings {
  master: number; music: number; sfx: number;
  offsetMs: number; sensitivity: number; invertY: boolean;
  quality: Quality; shake: boolean; beatPulse: boolean;
}

const defaults: Settings = { master: 0.8, music: 0.8, sfx: 0.8, offsetMs: 0, sensitivity: 1, invertY: false, quality: 'high', shake: true, beatPulse: true };
const loadSettings = (): Settings => {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem('beattank.settings') ?? '{}') }; } catch { return defaults; }
};

export interface Stats {
  score: number; perfect: number; good: number; off: number; deaths: number; vinyls: number;
  remixed: number; enemies: number; citizens: number; time: number; maxCombo: number;
}
export const emptyStats = (): Stats => ({ score: 0, perfect: 0, good: 0, off: 0, deaths: 0, vinyls: 0, remixed: 0, enemies: 0, citizens: 0, time: 0, maxCombo: 0 });

export interface UIState {
  screen: Screen;
  loadProgress: number;
  hp: number; maxHp: number;
  combo: number; tier: number;
  meters: Record<Zone, number>;
  zone: Zone;
  objective: string;
  banner: { text: string; sub?: string; id: number } | null;
  toast: { text: string; id: number } | null;
  boss: { name: string; parts: number[]; phase: number } | null;
  special: { type: string; left: number } | null;
  bassDrop: number; boost: number;
  lastJudge: { j: 'perfect' | 'good' | 'off'; id: number } | null;
  hurt: number;
  stats: Stats;
  best: number;
  settings: Settings;
  set: (p: Partial<UIState>) => void;
  setSettings: (p: Partial<Settings>) => void;
}

export const useUI = create<UIState>((set, get) => ({
  screen: 'loading', loadProgress: 0,
  hp: 300, maxHp: 300, combo: 0, tier: 1,
  meters: { A: 0, B: 0, C: 0 }, zone: 'A', objective: '',
  banner: null, toast: null, boss: null, special: null, bassDrop: 0, boost: 1,
  lastJudge: null, hurt: 0, stats: emptyStats(),
  best: Number(localStorage.getItem('beattank.best') ?? 0),
  settings: loadSettings(),
  set: (p) => set(p),
  setSettings: (p) => {
    const s = { ...get().settings, ...p };
    localStorage.setItem('beattank.settings', JSON.stringify(s));
    set({ settings: s });
  },
}));

let bannerId = 0;
export const banner = (text: string, sub?: string) => useUI.getState().set({ banner: { text, sub, id: ++bannerId } });
export const toast = (text: string) => useUI.getState().set({ toast: { text, id: ++bannerId } });
